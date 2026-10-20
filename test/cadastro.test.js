// Cadastro de produto novo: Conta Azul + planilha (com a API e a planilha simuladas).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-cadastro-'));
process.env.PASTA_DADOS = pasta;
process.env.CONTAAZUL_CLIENT_ID = 'id';
process.env.CONTAAZUL_CLIENT_SECRET = 'segredo';

const { gravarJson, lerJson } = await import('../src/armazenamento.js');
const { nomeProduto, proximoSku, montarProduto, validarProdutoNovo, cadastrarProduto } = await import('../src/produtoNovo.js');
const { linhasPendentes, reenviarPendentes } = await import('../src/planilha.js');

gravarJson('tokens.json', { vinhedo: { access_token: 'tok', refresh_token: 'ref', expiraEm: Date.now() + 3_600_000 } });
const fetchOriginal = globalThis.fetch;
after(() => {
  globalThis.fetch = fetchOriginal;
  fs.rmSync(pasta, { recursive: true, force: true });
});

const dados = {
  sku: 'ht0807', endereco: '7-7', codFabricante: 'wk58', marca: 'Mann', descricao: 'Filtro de óleo',
  montadora: '', modelo: '', grandeza: 'UND', equivalencia: '',
  ncmId: '123', ncmTexto: '8421.23.00 – Filtros', unidadeId: '10801', origem: 'NACIONAL', tipo: 'MERCADORIA_PARA_REVENDA',
  valorVenda: '45.5', custo: '',
};

test('nome igual à fórmula da planilha e próximo SKU da sequência', () => {
  assert.equal(nomeProduto(dados), 'FILTRO DE ÓLEO MANN - WK58');
  assert.equal(nomeProduto({ descricao: 'Oleo motor', marca: 'Motul', codFabricante: '' }), 'OLEO MOTOR MOTUL');
  assert.equal(proximoSku(['HT0805', 'HT0806', 'XPTO', 'ht0799']), 'HT0807');
  assert.equal(proximoSku(['ABC']), '');
});

test('corpo do produto no formato do Conta Azul, com saldo zero', () => {
  assert.deepEqual(montarProduto(dados), {
    nome: 'FILTRO DE ÓLEO MANN - WK58',
    codigo_sku: 'HT0807',
    status: 'ATIVO',
    formato: 'SIMPLES',
    fiscal: { ncm: { id: 123 }, origem: 'NACIONAL', tipo_produto: 'MERCADORIA_PARA_REVENDA', unidade_medida: { id: 10801 } },
    estoque: { estoque_disponivel: 0, valor_venda: 45.5 },
  });
  const problemas = validarProdutoNovo({ ...dados, sku: '', ncmId: '', origem: 'X', marca: '' });
  for (const p of ['SKU', 'NCM', 'origem', 'marca']) assert.ok(problemas.some((m) => m.includes(p)), p);
});

test('cria no Conta Azul e na planilha; recusa SKU repetido', async () => {
  process.env.PLANILHA_URL = 'https://script.google.com/macros/s/x/exec';
  process.env.PLANILHA_TOKEN = 'senha';
  gravarJson('catalogo-vinhedo.json', { itens: [] });
  const enviados = { ca: [], planilha: [] };
  globalThis.fetch = async (url, opcoes = {}) => {
    const u = new URL(url);
    if (u.host === 'script.google.com') {
      enviados.planilha.push(JSON.parse(opcoes.body));
      return new Response(JSON.stringify({ ok: true, linha: 808 }));
    }
    if (u.pathname === '/v1/produtos' && opcoes.method === 'GET') {
      const existe = u.searchParams.get('sku') === 'HT0001';
      return new Response(JSON.stringify({ items: existe ? [{ id: 'old', codigo: 'HT0001' }] : [] }));
    }
    if (u.pathname === '/v1/produtos' && opcoes.method === 'POST') {
      enviados.ca.push(JSON.parse(opcoes.body));
      return new Response(JSON.stringify({ id: 'novo-uuid' }), { status: 201 });
    }
    return new Response('{}', { status: 404 });
  };

  const r = await cadastrarProduto('vinhedo', dados);
  assert.equal(r.erroPlanilha, null);
  assert.equal(r.produto.id, 'novo-uuid');
  assert.equal(enviados.ca[0].codigo_sku, 'HT0807');
  assert.deepEqual(
    { ...enviados.planilha[0] },
    {
      token: 'senha', sku: 'HT0807', endereco: '7-7', codFabricante: 'WK58', marca: 'MANN', descricao: 'FILTRO DE ÓLEO',
      montadora: '', modelo: '', grandeza: 'UND', equivalencia: '', nome: 'FILTRO DE ÓLEO MANN - WK58',
    },
  );
  assert.equal(lerJson('catalogo-vinhedo.json').itens[0].codigo, 'HT0807');
  assert.equal(lerJson('preferencias-produto.json').origem, 'NACIONAL');

  const repetido = await cadastrarProduto('vinhedo', { ...dados, sku: 'HT0001' });
  assert.match(repetido.problemas[0], /Já existe um produto com o SKU HT0001/);
  assert.equal(enviados.ca.length, 1);
});

test('planilha fora do ar: produto fica guardado e é reenviado depois', async () => {
  let planilhaNoAr = false;
  globalThis.fetch = async (url, opcoes = {}) => {
    const u = new URL(url);
    if (u.host === 'script.google.com') {
      return planilhaNoAr ? new Response('{"ok":true}') : new Response('<html>erro</html>', { status: 500 });
    }
    if (opcoes.method === 'GET') return new Response('{"items":[]}');
    return new Response(JSON.stringify({ id: 'outro' }));
  };
  const r = await cadastrarProduto('vinhedo', { ...dados, sku: 'HT0808' });
  assert.match(r.erroPlanilha, /inesperado/);
  assert.equal(linhasPendentes().length, 1);
  planilhaNoAr = true;
  assert.deepEqual(await reenviarPendentes(), { enviadas: 1, restantes: 0 });
  assert.equal(linhasPendentes().length, 0);
});

// ---- Script do Google (docs/planilha/apps-script.gs) contra uma planilha simulada ----

function planilhaFalsa() {
  // Linha 1: título; linha 2: cabeçalho; linhas 3-4: dados; J = fórmula.
  const cab = ['SKU', 'Endereço', 'Cód. Fabricante', 'Marca', 'Descrição', 'Montadora', 'Modelo', 'Grandeza', 'Equivalência', 'Nome Completo'];
  const linhas = [
    ['Inventário', '', '', '', '', '', '', '', '', ''],
    cab,
    ['HT0805', '7-7', 'MOTRIO 0W20', 'RENAULT', 'OLEO MOTOR', 'RENAULT', '', 'UND', '', 'OLEO MOTOR RENAULT - MOTRIO 0W20'],
    ['HT0806', '7-7', '0W30 INEO FIRST', 'TOTAL', 'OLEO MOTOR', '', '', 'UND', '', 'OLEO MOTOR TOTAL - 0W30 INEO FIRST'],
  ];
  const formulas = { '3,10': '=R[0]C[-5]&" "&R[0]C[-6]&" - "&R[0]C[-7]', '4,10': '=R[0]C[-5]&" "&R[0]C[-6]&" - "&R[0]C[-7]' };
  const celula = (l, c) => ({
    getFormulaR1C1: () => formulas[`${l},${c}`] ?? '',
    setFormulaR1C1: (f) => { formulas[`${l},${c}`] = f; },
    setValue: (v) => {
      while (linhas.length < l) linhas.push(Array(10).fill(''));
      linhas[l - 1][c - 1] = v;
    },
  });
  const aba = {
    getLastColumn: () => 10,
    getLastRow: () => linhas.length,
    getRange: (l, c, nl, nc) =>
      nl === undefined ? celula(l, c) : { getValues: () => linhas.slice(l - 1, l - 1 + nl).map((x) => x.slice(c - 1, c - 1 + nc)) },
  };
  return { linhas, formulas, aba };
}

function rodarScript(planilha, pedido) {
  const codigo = fs.readFileSync(new URL('../docs/planilha/apps-script.gs', import.meta.url), 'utf8').replace("'TROQUE-POR-UMA-SENHA'", "'senha'");
  const contexto = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === 'Inventário' ? planilha.aba : null) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }) },
  };
  vm.createContext(contexto);
  vm.runInContext(codigo, contexto);
  return contexto.doPost({ postData: { contents: JSON.stringify(pedido) } });
}

test('script da planilha: próximo SKU, nova linha no lugar certo e fórmula copiada', () => {
  const p = planilhaFalsa();
  assert.deepEqual(rodarScript(p, { token: 'senha', acao: 'proximoSku' }), { ok: true, sku: 'HT0807' });
  assert.equal(rodarScript(p, { token: 'errada', sku: 'X' }).ok, false);

  const r = rodarScript(p, {
    token: 'senha', sku: 'HT0807', endereco: '7-7', codFabricante: 'WK58', marca: 'MANN', descricao: 'FILTRO DE ÓLEO',
    grandeza: 'UND', nome: 'FILTRO DE ÓLEO MANN - WK58',
  });
  assert.deepEqual(r, { ok: true, linha: 5 });
  assert.deepEqual(p.linhas[4].slice(0, 9), ['HT0807', '7-7', 'WK58', 'MANN', 'FILTRO DE ÓLEO', '', '', 'UND', '']);
  assert.equal(p.linhas[4][9], '', 'Nome Completo não recebe texto: vira fórmula');
  assert.equal(p.formulas['5,10'], p.formulas['4,10']);

  assert.match(rodarScript(p, { token: 'senha', sku: 'ht0807' }).erro, /já está na planilha/);
});

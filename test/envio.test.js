// Testa o envio com a API do Conta Azul simulada: nada sai deste computador.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-teste-'));
process.env.PASTA_DADOS = pasta;
process.env.ENVIO_REAL = 'true';
process.env.CONTAAZUL_CLIENT_ID = 'id';
process.env.CONTAAZUL_CLIENT_SECRET = 'segredo';

const { gravarJson, obterOs } = await import('../src/armazenamento.js');
const { importarOs, aprovarEEnviar, executarAcao } = await import('../src/processamento.js');
const { lerOsDeCsv } = await import('../src/hts/importarCsv.js');
const { lerOsDePdf } = await import('../src/hts/lerPdf.js');
const { buscarCliente } = await import('../src/contaazul/cliente.js');

const fetchOriginal = globalThis.fetch;
let respostaVenda;
const chamadas = [];
const corpos = [];

before(() => {
  fs.copyFileSync(new URL('../exemplos/mapeamento-exemplo.csv', import.meta.url), path.join(pasta, 'mapeamento.csv'));
  gravarJson('tokens.json', { vinhedo: { access_token: 'tok', refresh_token: 'ref', expiraEm: Date.now() + 3_600_000 } });
  const csv = fs.readFileSync(new URL('../exemplos/os-exemplo.csv', import.meta.url), 'utf8');
  importarOs(lerOsDeCsv(csv), 'teste');

  globalThis.fetch = async (url, opcoes = {}) => {
    const u = new URL(url);
    chamadas.push(`${opcoes.method ?? 'GET'} ${u.pathname}`);
    if (u.pathname === '/v1/pessoas') {
      const cadastro = [
        { id: 'cli-1', nome: 'Cliente Exemplo Um', documento: '123.456.789-09', email: 'um@exemplo.com' },
        { id: 'cli-2', nome: 'Cliente Ficticio da Silva', documento: '', email: 'outro@exemplo.com' },
        { id: 'cli-3', nome: 'Homônimo', documento: '', email: '' },
        { id: 'cli-4', nome: 'Homônimo', documento: '', email: '' },
      ];
      const q = u.searchParams;
      const pessoas = cadastro.filter((p) =>
        (q.get('documentos') && p.documento.replace(/\D/g, '') === q.get('documentos'))
        || (q.get('emails') && p.email === q.get('emails'))
        || (q.get('nomes') && p.nome.includes(q.get('nomes')))
        || (q.get('busca') && p.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q.get('busca'))));
      return new Response(JSON.stringify({ items: pessoas, totalItems: pessoas.length }), { status: 200 });
    }
    if (u.pathname === '/v1/venda/proximo-numero') return new Response('4512', { status: 200 });
    if (u.pathname === '/v1/venda') {
      corpos.push(JSON.parse(opcoes.body));
      return respostaVenda();
    }
    return new Response('{}', { status: 404 });
  };
});

after(() => {
  globalThis.fetch = fetchOriginal;
  fs.rmSync(pasta, { recursive: true, force: true });
});

test('cria a venda e não deixa enviar a mesma OS duas vezes', async () => {
  respostaVenda = () => new Response(JSON.stringify({ id: 'venda-1', numero: 321 }), { status: 200 });
  const os1 = await aprovarEEnviar('vinhedo:1001');
  assert.equal(os1.status, 'venda_criada');
  assert.equal(os1.venda.numero, 321);
  await assert.rejects(aprovarEEnviar('vinhedo:1001'), /não pode ser enviada/);
  assert.equal(chamadas.filter((c) => c === 'POST /v1/venda').length, 1);

  // Campos obrigatórios do OpenAPI (CriacaoVendaRequest).
  const [enviada] = corpos;
  for (const campo of ['id_cliente', 'numero', 'situacao', 'data_venda', 'itens', 'condicao_pagamento']) {
    assert.ok(enviada[campo] !== undefined, campo);
  }
  assert.equal(enviada.id_cliente, 'cli-1');
  assert.equal(enviada.numero, 4512);
  assert.ok(enviada.itens.every((i) => i.id && i.quantidade > 0 && i.valor >= 0));

  executarAcao('vinhedo:1001', 'marcar_nf_emitida');
  assert.equal(obterOs('vinhedo:1001').status, 'nf_emitida');
});

test('cliente não cadastrado vira problema e nada é enviado', async () => {
  const antes = chamadas.length;
  const os2 = await aprovarEEnviar('vinhedo:1002');
  assert.equal(os2.status, 'com_erro');
  assert.match(os2.problemas[0], /Nenhum cliente com CPF\/CNPJ/);
  assert.ok(!chamadas.slice(antes).includes('POST /v1/venda'));
});

test('recusa do Conta Azul (4xx) deixa corrigir; queda (5xx) trava até conferir', async () => {
  const csv = 'unidade;numero_os;data_fechamento;cliente_nome;cliente_documento;placa;tipo;codigo_hts;descricao;quantidade;valor_unitario;desconto\n'
    + 'vinhedo;2001;15/10/2026;A;12345678909;AAA0000;servico;MO-DIAGNOSTICO;Diag;1;100;0\n'
    + 'vinhedo;2002;15/10/2026;B;12345678909;AAA0000;servico;MO-DIAGNOSTICO;Diag;1;100;0\n';
  importarOs(lerOsDeCsv(csv), 'teste');

  respostaVenda = () => new Response('{"erro":"campo invalido"}', { status: 400 });
  assert.equal((await aprovarEEnviar('vinhedo:2001')).status, 'com_erro');

  respostaVenda = () => new Response('falhou', { status: 502 });
  const travada = await aprovarEEnviar('vinhedo:2002');
  assert.equal(travada.status, 'enviando');
  await assert.rejects(aprovarEEnviar('vinhedo:2002'), /não pode ser enviada/);

  // Reimportar o CSV não destrava a OS.
  importarOs(lerOsDeCsv(csv), 'teste');
  assert.equal(obterOs('vinhedo:2002').status, 'enviando');

  executarAcao('vinhedo:2002', 'reabrir');
  assert.equal(obterOs('vinhedo:2002').status, 'pendente');
});

test('acha o cliente da OS em PDF pelo nome quando o e-mail não bate', async () => {
  const os = await lerOsDePdf(fs.readFileSync(new URL('./fixtures/os-vinhedo-ficticia.pdf', import.meta.url)));
  assert.equal((await buscarCliente('vinhedo', os.cliente)).cliente.id, 'cli-2');
});

test('busca de cliente: por e-mail, por documento, e recusa nome repetido', async () => {
  assert.equal((await buscarCliente('vinhedo', { email: 'UM@exemplo.com', nome: 'x' })).cliente.id, 'cli-1');
  assert.equal((await buscarCliente('vinhedo', { documento: '12345678909' })).cliente.id, 'cli-1');
  assert.match((await buscarCliente('vinhedo', { nome: 'Homonimo' })).problema, /Há 2 clientes/);
  assert.match((await buscarCliente('vinhedo', { nome: 'Ninguém' })).problema, /Nenhum cliente/);
});

test('trava de CNPJ: empresa errada desfaz a conexão e bloqueia o envio', async () => {
  const { conferirEmpresa } = await import('../src/contaazul/cliente.js');
  const { unidadeAutorizada } = await import('../src/contaazul/auth.js');
  const fetchAntes = globalThis.fetch;
  process.env.CNPJ_BARUERI = '52.273.172/0001-32';
  gravarJson('tokens.json', { ...JSON.parse(fs.readFileSync(path.join(pasta, 'tokens.json'), 'utf8')), barueri: { access_token: 't', refresh_token: 'r', expiraEm: Date.now() + 3_600_000 } });
  globalThis.fetch = async () => new Response(JSON.stringify({ razao_social: 'OUTRA EMPRESA', documento: '24614991000160' }));
  await assert.rejects(conferirEmpresa('barueri'), /empresa errada: OUTRA EMPRESA \(CNPJ 24614991000160\).*52273172000132/);
  assert.equal(unidadeAutorizada('barueri'), false);

  gravarJson('tokens.json', { barueri: { access_token: 't', refresh_token: 'r', expiraEm: Date.now() + 3_600_000 } });
  globalThis.fetch = async () => new Response(JSON.stringify({ razao_social: 'KAIZEN', documento: '52273172000132' }));
  await conferirEmpresa('barueri');
  assert.equal(unidadeAutorizada('barueri'), true);
  globalThis.fetch = fetchAntes;
  delete process.env.CNPJ_BARUERI;
});

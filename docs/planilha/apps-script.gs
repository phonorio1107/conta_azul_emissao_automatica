/**
 * Script da planilha de SKUs (aba "Inventário") para o painel NFs pelo Conta Azul.
 * Fica num projeto SEPARADO (script.google.com → Novo projeto), para não interferir
 * em outros scripts da planilha. Instalação: veja docs/PLANILHA.md.
 *
 * TOKEN: uma senha só sua; a mesma vai em PLANILHA_TOKEN no .env do painel.
 * PLANILHA_ID: o trecho do link da planilha entre "/d/" e "/edit".
 */
const TOKEN = 'TROQUE-POR-UMA-SENHA';
const PLANILHA_ID = 'COLE-AQUI-O-ID-DA-PLANILHA';
const ABA = 'Inventário';

// Cabeçalho da planilha (sem acento/maiúsculas) -> campo enviado pelo painel.
const CAMPOS = {
  'sku': 'sku',
  'endereco': 'endereco',
  'cod. fabricante': 'codFabricante',
  'cod fabricante': 'codFabricante',
  'marca': 'marca',
  'descricao': 'descricao',
  'montadora': 'montadora',
  'modelo': 'modelo',
  'grandeza': 'grandeza',
  'equivalencia': 'equivalencia',
  'nome completo': 'nome',
};

// Teste pelo navegador: abra  <link /exec>?token=SUA_SENHA
// Responde se a senha confere, se achou a planilha/aba e qual o próximo SKU.
function doGet(e) {
  const token = e && e.parameter ? e.parameter.token : '';
  if (!token) return responder({ ok: false, erro: 'Acesso OK. Para testar, coloque ?token=SUA_SENHA no fim do link.' });
  if (token !== TOKEN) return responder({ ok: false, erro: 'A senha do link é DIFERENTE da senha (TOKEN) do script.' });
  const aba = abrirAba();
  if (aba.erro) return responder({ ok: false, erro: aba.erro });
  const mapa = lerCabecalho(aba.aba);
  if (!mapa) return responder({ ok: false, erro: 'Achei a aba, mas não achei a coluna "SKU" no cabeçalho.' });
  return responder({ ok: true, mensagem: 'Tudo certo! Senha, planilha e aba conferem.', proximoSku: proximoSku(aba.aba, mapa) });
}

function abrirAba() {
  let planilha;
  try {
    planilha = SpreadsheetApp.openById(PLANILHA_ID);
  } catch (erro) {
    return { erro: 'Não consegui abrir a planilha. Confira o PLANILHA_ID no script (' + erro.message + ').' };
  }
  const aba = planilha.getSheetByName(ABA);
  if (!aba) {
    const nomes = planilha.getSheets().map(function (a) { return a.getName(); }).join(', ');
    return { erro: 'Não achei a aba "' + ABA + '". Abas desta planilha: ' + nomes + '. Ajuste a linha const ABA no script.' };
  }
  return { aba: aba };
}

function doPost(e) {
  let dados;
  try {
    dados = JSON.parse(e.postData.contents);
  } catch (erro) {
    return responder({ ok: false, erro: 'Pedido inválido.' });
  }
  if (dados.token !== TOKEN) return responder({ ok: false, erro: 'Senha (token) inválida.' });

  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const aberta = abrirAba();
    if (aberta.erro) return responder({ ok: false, erro: aberta.erro });
    const aba = aberta.aba;
    const mapa = lerCabecalho(aba);
    if (!mapa) return responder({ ok: false, erro: 'Não achei a coluna "SKU" no cabeçalho.' });

    if (dados.acao === 'proximoSku') return responder({ ok: true, sku: proximoSku(aba, mapa) });

    const sku = String(dados.sku || '').trim().toUpperCase();
    if (!sku) return responder({ ok: false, erro: 'SKU vazio.' });
    if (skus(aba, mapa).indexOf(sku) >= 0) return responder({ ok: false, erro: 'O SKU ' + sku + ' já está na planilha.' });

    const ultima = ultimaLinha(aba, mapa);
    const nova = ultima + 1;
    for (let coluna = 1; coluna <= mapa.colunas; coluna++) {
      const destino = aba.getRange(nova, coluna);
      const formula = ultima > mapa.linhaCabecalho ? aba.getRange(ultima, coluna).getFormulaR1C1() : '';
      if (formula) {
        destino.setFormulaR1C1(formula); // ex.: "Nome Completo" continua sendo a fórmula
        continue;
      }
      const campo = mapa.campos[coluna];
      if (campo && dados[campo] !== undefined && dados[campo] !== '') destino.setValue(dados[campo]);
    }
    return responder({ ok: true, linha: nova });
  } finally {
    trava.releaseLock();
  }
}

function lerCabecalho(aba) {
  const colunas = aba.getLastColumn();
  const topo = aba.getRange(1, 1, Math.min(10, aba.getLastRow()), colunas).getValues();
  for (let i = 0; i < topo.length; i++) {
    const nomes = topo[i].map(normalizar);
    const colSku = nomes.indexOf('sku');
    if (colSku >= 0) {
      const campos = {};
      nomes.forEach(function (nome, j) {
        if (CAMPOS[nome]) campos[j + 1] = CAMPOS[nome];
      });
      return { linhaCabecalho: i + 1, colunaSku: colSku + 1, colunas: colunas, campos: campos };
    }
  }
  return null;
}

function skus(aba, mapa) {
  const total = aba.getLastRow() - mapa.linhaCabecalho;
  if (total <= 0) return [];
  return aba.getRange(mapa.linhaCabecalho + 1, mapa.colunaSku, total, 1).getValues()
    .map(function (l) { return String(l[0]).trim().toUpperCase(); });
}

// Última linha com SKU preenchido (ignora linhas que só têm fórmula).
function ultimaLinha(aba, mapa) {
  const lista = skus(aba, mapa);
  for (let i = lista.length - 1; i >= 0; i--) if (lista[i]) return mapa.linhaCabecalho + 1 + i;
  return mapa.linhaCabecalho;
}

function proximoSku(aba, mapa) {
  let maior = 0;
  let largura = 4;
  skus(aba, mapa).forEach(function (s) {
    const m = s.match(/^HT(\d+)$/);
    if (m) {
      maior = Math.max(maior, Number(m[1]));
      largura = Math.max(largura, m[1].length);
    }
  });
  let numero = String(maior + 1);
  while (numero.length < largura) numero = '0' + numero;
  return 'HT' + numero;
}

function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

// Painel local: http://localhost:3000
// Só aceita conexões do próprio computador, porque não tem login.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config, UNIDADES, PASTA_ENTRADA } from '../config.js';
import { listarOs, obterOs, lerJson } from '../armazenamento.js';
import { linkDeAutorizacao, concluirAutorizacao, unidadeAutorizada } from '../contaazul/auth.js';
import {
  STATUS, ACOES, importarPastaDeEntrada, revalidarPendentes, prepararVenda, aprovarEEnviar, executarAcao,
  itensSemMapeamento, escolherProduto, limparEscolha,
} from '../processamento.js';
import { adicionarMapeamentos, chaveMapa, carregarMapeamento } from '../mapeamento.js';
import { obterCatalogo, buscarNoCatalogo } from '../catalogo.js';
import { totalOs, tipoOs } from '../validacao.js';
import { reais } from '../numeros.js';
import { pagina, esc } from './html.js';

const app = express();
app.use(express.urlencoded({ extended: false }));

const rotaOs = (chave) => `/os/${encodeURIComponent(chave)}`;
const dataBr = (iso) => (iso ? iso.split('-').reverse().join('/') : '—');
const etiqueta = (status) => `<span class="etiqueta ${status}">${esc(STATUS[status] ?? status)}</span>`;

function responder(res, titulo, corpo, aviso) {
  res.send(pagina(titulo, corpo, { envioReal: config().envioReal, aviso }));
}

function voltar(res, destino, aviso) {
  const url = new URL(destino, 'http://x');
  if (aviso) url.searchParams.set('aviso', aviso);
  res.redirect(url.pathname + url.search + url.hash);
}

app.get('/', (req, res) => {
  const { status, unidade } = req.query;
  const todas = listarOs();
  const filtradas = todas.filter((o) => (!status || o.status === status) && (!unidade || o.unidade === unidade));

  const contagem = Object.fromEntries(Object.keys(STATUS).map((s) => [s, todas.filter((o) => o.status === s).length]));
  const cartoes = ['pendente', 'com_erro', 'venda_criada', 'enviando']
    .filter((s) => s !== 'enviando' || contagem.enviando)
    .map((s) => `<a class="cartao" href="/?status=${s}" style="color:inherit;text-decoration:none">${etiqueta(s)}<b>${contagem[s]}</b></a>`)
    .join('');

  const pendentesMapa = itensSemMapeamento().length;
  const unidades = Object.entries(UNIDADES)
    .map(([id, nome]) =>
      unidadeAutorizada(id)
        ? `<span>${esc(nome)}: conectada ✔</span>`
        : `<a class="botao secundario" href="/autorizar/${id}">Conectar ${esc(nome)} ao Conta Azul</a>`,
    )
    .join(' ');

  const linhas = filtradas
    .map(
      (o) => `<tr>
        <td><a href="${rotaOs(o.chave)}">${esc(o.numero)}</a></td>
        <td>${esc(UNIDADES[o.unidade] ?? o.unidade)}</td>
        <td class="esconder-celular">${dataBr(o.dataFechamento)}</td>
        <td>${esc(o.cliente?.nome)}</td>
        <td class="esconder-celular">${esc(o.placa)}</td>
        <td class="esconder-celular">${tipoOs(o)}</td>
        <td class="num">${reais(totalOs(o))}</td>
        <td>${etiqueta(o.status)}</td>
      </tr>`,
    )
    .join('');

  const filtroStatus = ['', ...Object.keys(STATUS)]
    .map((s) => `<a href="/?${new URLSearchParams({ ...(s && { status: s }), ...(unidade && { unidade }) })}">${s ? esc(STATUS[s]) : 'Todas'}</a>`)
    .join('');

  responder(
    res,
    'Ordens de Serviço',
    `<div class="acoes">${unidades}</div>
     <div class="cartoes">${cartoes}</div>
     <div class="acoes">
       <label class="botao">Enviar PDFs das OS
         <input id="arquivos" type="file" accept=".pdf,.csv" multiple hidden onchange="enviarArquivos(this.files)">
       </label>
       <form class="inline" method="post" action="/importar"><button class="secundario">Importar da pasta "entrada"</button></form>
       ${pendentesMapa ? `<a class="botao secundario" href="/mapeamento">Mapear serviços (${pendentesMapa} pendente${pendentesMapa > 1 ? 's' : ''})</a>` : ''}
     </div>
     <script>
       async function enviarArquivos(arquivos) {
         for (const arquivo of arquivos) {
           const r = await fetch('/enviar?nome=' + encodeURIComponent(arquivo.name), {
             method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: arquivo,
           });
           if (!r.ok) { alert('Não foi possível enviar ' + arquivo.name + ': ' + await r.text()); return; }
         }
         const f = document.createElement('form');
         f.method = 'post'; f.action = '/importar';
         document.body.appendChild(f); f.submit();
       }
     </script>
     <p class="filtros">${filtroStatus}</p>
     <table>
       <thead><tr><th>OS</th><th>Unidade</th><th class="esconder-celular">Fechada em</th><th>Cliente</th>
       <th class="esconder-celular">Placa</th><th class="esconder-celular">Tipo</th><th class="num">Total</th><th>Status</th></tr></thead>
       <tbody>${linhas || '<tr><td colspan="8">Nenhuma OS aqui ainda. Coloque os PDFs das OS (ou uma planilha CSV) na pasta "entrada" e clique em Importar.</td></tr>'}</tbody>
     </table>`,
    req.query.aviso,
  );
});

app.post('/importar', async (req, res) => {
  const r = await importarPastaDeEntrada();
  const partes = [
    `${r.arquivos} arquivo(s) lido(s): ${r.novas} OS nova(s), ${r.atualizadas} atualizada(s), ${r.jaEnviadas} já enviada(s) (ignoradas).`,
    ...r.erros,
  ];
  voltar(res, '/', partes.join('\n'));
});

app.post('/revalidar', (req, res) => {
  revalidarPendentes();
  voltar(res, '/', 'OS ainda não enviadas foram conferidas de novo.');
});

app.get('/os/:chave', async (req, res) => {
  const os = obterOs(req.params.chave);
  if (!os) return voltar(res, '/', 'OS não encontrada.');

  const travada = ['enviando', 'venda_criada', 'nf_emitida'].includes(os.status);
  const mapeamento = carregarMapeamento();
  const buscandoItem = req.query.item !== undefined ? Number(req.query.item) : null;
  const termo = String(req.query.q ?? '');

  // Resultado da busca de produto (só quando o usuário pesquisou um item).
  let resultados = null;
  let avisoBusca = '';
  if (buscandoItem !== null && termo.trim()) {
    if (!unidadeAutorizada(os.unidade)) avisoBusca = 'Conecte a unidade ao Conta Azul para buscar produtos.';
    else {
      try {
        resultados = buscarNoCatalogo(await obterCatalogo(os.unidade), 'produto', termo);
      } catch (erro) {
        avisoBusca = `Não consegui consultar o Conta Azul: ${erro.message}`;
      }
    }
  }

  const celulaContaAzul = (item, i) => {
    const fixo = mapeamento.get(chaveMapa(os.unidade, item.tipo, item.codigoHts));
    if (item.tipo === 'servico') {
      return fixo ? `${esc(fixo.nome || 'mapeado')}` : '<span class="problema">falta mapear</span> · <a href="/mapeamento">Mapear serviços</a>';
    }
    if (item.escolha?.id) {
      const trocar = travada
        ? ''
        : ` <form class="inline" method="post" action="${rotaOs(os.chave)}/item/${i}/limpar"><button class="link">trocar</button></form>`;
      return `<b>${esc(item.escolha.codigo)}</b> ${esc(item.escolha.nome)}${trocar}`;
    }
    const busca = travada
      ? ''
      : `<form method="get" action="${rotaOs(os.chave)}#item-${i}" class="busca">
           <input type="hidden" name="item" value="${i}">
           <input name="q" value="${buscandoItem === i ? esc(termo) : ''}" placeholder="nome ou SKU anotado pelo orçamentista" size="28">
           <button class="secundario">Buscar</button>
         </form>`;
    return fixo ? `${esc(fixo.nome || 'mapeado')} <small>(sempre)</small>${busca ? `<details><summary>usar outro</summary>${busca}</details>` : ''}` : busca;
  };

  const linhaResultados = (i) => {
    if (buscandoItem !== i || !termo.trim()) return '';
    if (avisoBusca) return `<tr><td colspan="6" class="problema">${esc(avisoBusca)}</td></tr>`;
    if (!resultados.length) {
      return `<tr><td colspan="6">Nada encontrado para "${esc(termo)}". Tente outra palavra ou só parte do SKU.
        Se o produto foi cadastrado agora no Conta Azul:
        <form class="inline" method="post" action="/mapeamento/atualizar-catalogo"><input type="hidden" name="voltar" value="${esc(`${rotaOs(os.chave)}?item=${i}&q=${encodeURIComponent(termo)}#item-${i}`)}"><button class="link">atualizar a lista do Conta Azul</button></form></td></tr>`;
    }
    const item = os.itens[i];
    const opcoes = resultados
      .map(
        (p) => `<tr><td><b>${esc(p.codigo)}</b></td><td>${esc(p.nome)}</td><td class="num">${p.saldo ?? '—'}</td>
          <td><form class="inline" method="post" action="${rotaOs(os.chave)}/item/${i}/escolher">
            <input type="hidden" name="id" value="${esc(p.id)}">
            <button>Usar</button>
            <button class="secundario" name="sempre" value="1" title="Usar este SKU sempre que a OS trouxer &quot;${esc(item.codigoHts)}&quot;">Usar sempre</button>
          </form></td></tr>`,
      )
      .join('');
    return `<tr><td colspan="6"><table class="resultados"><thead><tr><th>SKU</th><th>Produto no Conta Azul</th><th class="num">Saldo*</th><th></th></tr></thead>
      <tbody>${opcoes}</tbody></table><small>* saldo na última atualização da lista.</small></td></tr>`;
  };

  const itens = os.itens
    .map(
      (item, i) => `<tr id="item-${i}"><td>${item.tipo === 'servico' ? 'Serviço' : 'Produto'}</td><td>${esc(item.descricao)}</td>
       <td class="num">${item.quantidade}</td><td class="num">${reais(item.valorUnitario)}</td>
       <td class="num">${reais(item.quantidade * item.valorUnitario - (item.desconto || 0))}</td>
       <td>${celulaContaAzul(item, i)}</td></tr>${linhaResultados(i)}`,
    )
    .join('');

  const acoes = Object.entries(ACOES)
    .filter(([, a]) => a.de.includes(os.status))
    .map(([id, a]) => `<form class="inline" method="post" action="${rotaOs(os.chave)}/acao"><input type="hidden" name="acao" value="${id}"><button class="secundario">${esc(a.rotulo)}</button></form>`)
    .join('');

  const enviar =
    os.status === 'pendente'
      ? `<a class="botao secundario" href="${rotaOs(os.chave)}/previa">Ver o que seria enviado</a>
         <form class="inline" method="post" action="${rotaOs(os.chave)}/enviar"
           onsubmit="return confirm('Criar a venda da OS ${esc(os.numero)} no Conta Azul?')">
           <button ${config().envioReal ? '' : 'disabled title="Modo simulação"'}>Aprovar e criar venda</button></form>`
      : '';

  const historico = (os.historico ?? [])
    .slice()
    .reverse()
    .map((h) => `<li>${new Date(h.em).toLocaleString('pt-BR')} – ${esc(h.mensagem)}</li>`)
    .join('');

  responder(
    res,
    `OS ${os.numero}`,
    `<p><a href="/">← voltar</a></p>
     <h1>OS ${esc(os.numero)} · ${esc(UNIDADES[os.unidade] ?? os.unidade)} ${etiqueta(os.status)}</h1>
     <p><b>Cliente:</b> ${esc(os.cliente?.nome)}${os.cliente?.documento ? ` · ${esc(os.cliente.documento)}` : ''}${os.cliente?.email ? ` · ${esc(os.cliente.email)}` : ''}<br>
        <b>Placa:</b> ${esc(os.placa)} · <b>Fechada em:</b> ${dataBr(os.dataFechamento)} · <b>Tipo:</b> ${tipoOs(os)}
        ${os.venda?.numero ? `<br><b>Venda no Conta Azul:</b> nº ${esc(os.venda.numero)}` : ''}</p>
     ${os.problemas?.length ? `<ul class="problemas">${os.problemas.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
     ${os.status === 'venda_criada' ? '<p class="aviso">Venda criada. Abra-a no Conta Azul, confira e clique em "Emitir nota fiscal". Depois marque aqui como "NF emitida".</p>' : ''}
     <div class="acoes">${enviar}${acoes}</div>
     <table><thead><tr><th>Tipo</th><th>Item na OS</th><th class="num">Qtd</th><th class="num">Unitário</th><th class="num">Total</th><th>No Conta Azul</th></tr></thead>
       <tbody>${itens}</tbody>
       <tfoot><tr><th colspan="4">Total da OS</th><th class="num">${reais(totalOs(os))}</th><th></th></tr></tfoot></table>
     <h3>Histórico</h3><ul>${historico}</ul>`,
    req.query.aviso,
  );
});

app.get('/os/:chave/previa', async (req, res) => {
  const os = obterOs(req.params.chave);
  if (!os) return voltar(res, '/', 'OS não encontrada.');
  try {
    const { venda, cliente, problemas } = await prepararVenda(os);
    responder(
      res,
      `Prévia OS ${os.numero}`,
      `<p><a href="${rotaOs(os.chave)}">← voltar para a OS</a></p>
       <h1>O que seria enviado ao Conta Azul (OS ${esc(os.numero)})</h1>
       ${
         problemas
           ? `<ul class="problemas">${problemas.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
           : `<p><b>Cliente encontrado no Conta Azul:</b> ${esc(cliente.nome)} ${cliente.documento ? `· ${esc(cliente.documento)}` : ''}${cliente.email ? ` · ${esc(cliente.email)}` : ''}</p>
              <p><b>Número da venda:</b> ${esc(venda.numero)} (o próximo livre agora; pode mudar até o envio)</p>
              <pre>${esc(JSON.stringify(venda, null, 2))}</pre>`
       }
       <p>Nada foi criado no Conta Azul. Esta tela só consulta o cadastro do cliente e o próximo número de venda.</p>`,
    );
  } catch (erro) {
    voltar(res, rotaOs(os.chave), erro.message);
  }
});

app.post('/os/:chave/enviar', async (req, res) => {
  try {
    const os = await aprovarEEnviar(req.params.chave);
    voltar(res, rotaOs(os.chave), os.status === 'venda_criada' ? 'Venda criada no Conta Azul.' : 'Não foi possível criar a venda. Veja os problemas abaixo.');
  } catch (erro) {
    voltar(res, rotaOs(req.params.chave), erro.message);
  }
});

app.post('/os/:chave/item/:i/escolher', (req, res) => {
  const chave = req.params.chave;
  try {
    const os = obterOs(chave);
    const produto = lerJson(`catalogo-${os?.unidade}.json`, { itens: [] }).itens.find((p) => p.id === req.body.id);
    if (!produto) throw new Error('Produto não encontrado na lista do Conta Azul. Atualize a lista e busque de novo.');
    escolherProduto(chave, Number(req.params.i), produto, { sempre: req.body.sempre === '1' });
    voltar(res, `${rotaOs(chave)}#item-${req.params.i}`, req.body.sempre === '1' ? 'Produto escolhido e guardado para as próximas OS.' : 'Produto escolhido.');
  } catch (erro) {
    voltar(res, rotaOs(chave), erro.message);
  }
});

app.post('/os/:chave/item/:i/limpar', (req, res) => {
  try {
    limparEscolha(req.params.chave, Number(req.params.i));
    voltar(res, `${rotaOs(req.params.chave)}?item=${req.params.i}#item-${req.params.i}`);
  } catch (erro) {
    voltar(res, rotaOs(req.params.chave), erro.message);
  }
});

app.post('/os/:chave/acao', (req, res) => {
  try {
    executarAcao(req.params.chave, req.body.acao);
    voltar(res, rotaOs(req.params.chave), 'Feito.');
  } catch (erro) {
    voltar(res, rotaOs(req.params.chave), erro.message);
  }
});

// Recebe um arquivo escolhido no navegador e salva na pasta "entrada".
app.post('/enviar', express.raw({ type: 'application/octet-stream', limit: '25mb' }), (req, res) => {
  const nome = path.basename(String(req.query.nome ?? '')).replace(/[^\w.\- ()]/g, '_');
  if (!/\.(pdf|csv)$/i.test(nome)) return res.status(400).send('Só aceito arquivos .pdf ou .csv.');
  fs.mkdirSync(PASTA_ENTRADA, { recursive: true });
  fs.writeFileSync(path.join(PASTA_ENTRADA, nome), req.body);
  res.send('ok');
});

// Tela de mapeamento: liga cada item das OS a um produto/serviço do Conta Azul.
app.get('/mapeamento', async (req, res) => {
  const pendentes = itensSemMapeamento();
  if (!pendentes.length) {
    return responder(res, 'Mapear serviços', '<p><a href="/">← voltar</a></p><h1>Mapear serviços</h1><p>Nenhum serviço pendente. Tudo mapeado.</p>', req.query.aviso);
  }

  const catalogos = {};
  const avisos = [];
  for (const unidade of new Set(pendentes.map((p) => p.unidade))) {
    if (!unidadeAutorizada(unidade)) {
      avisos.push(`${UNIDADES[unidade] ?? unidade}: conecte a unidade ao Conta Azul para ver o catálogo.`);
      continue;
    }
    try {
      catalogos[unidade] = await obterCatalogo(unidade);
    } catch (erro) {
      avisos.push(`${UNIDADES[unidade] ?? unidade}: não consegui baixar o catálogo (${erro.message}).`);
    }
  }

  const linhas = pendentes
    .map((p, i) => {
      const catalogo = catalogos[p.unidade];
      const opcoes = (catalogo?.itens ?? []).filter((c) => c.tipo === p.tipo);
      const sugestao = opcoes.find((c) => chaveMapa('', '', c.nome) === chaveMapa('', '', p.codigoHts));
      const select = catalogo
        ? `<select name="id_${i}" style="max-width:100%">
             <option value="">— escolher depois —</option>
             ${opcoes
               .map((c) => `<option value="${esc(c.id)}"${c === sugestao ? ' selected' : ''}>${esc(c.nome)}${c.codigo ? ` · ${esc(c.codigo)}` : ''}</option>`)
               .join('')}
           </select>`
        : '<em>catálogo indisponível</em>';
      return `<tr>
        <td>${esc(UNIDADES[p.unidade] ?? p.unidade)}</td>
        <td>${p.tipo === 'servico' ? 'Serviço' : 'Produto'}</td>
        <td><b>${esc(p.codigoHts)}</b><br><small>OS ${p.oss.map(esc).join(', ')}</small>
          <input type="hidden" name="unidade_${i}" value="${esc(p.unidade)}">
          <input type="hidden" name="tipo_${i}" value="${esc(p.tipo)}">
          <input type="hidden" name="codigo_${i}" value="${esc(p.codigoHts)}"></td>
        <td>${select}</td>
        <td><input name="fator_${i}" value="1" size="4" title="Quantas unidades do Conta Azul valem 1 unidade da OS"></td>
      </tr>`;
    })
    .join('');

  responder(
    res,
    'Mapear serviços',
    `<p><a href="/">← voltar</a></p>
     <h1>Mapear serviços</h1>
     <p>Para cada serviço das OS, escolha o serviço correspondente no Conta Azul. Isso é feito <b>uma vez só</b>:
        da próxima vez que ele aparecer, o sistema já sabe. (Peças são escolhidas dentro de cada OS, pelo SKU.)</p>
     ${avisos.length ? `<ul class="problemas">${avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
     <form method="post" action="/mapeamento">
       <input type="hidden" name="n" value="${pendentes.length}">
       <table>
         <thead><tr><th>Unidade</th><th>Tipo</th><th>Serviço na OS</th><th>Serviço no Conta Azul</th><th>Fator</th></tr></thead>
         <tbody>${linhas}</tbody>
       </table>
       <div class="acoes"><button>Salvar mapeamento</button></div>
     </form>
     <form method="post" action="/mapeamento/atualizar-catalogo">
       <p>Cadastrou um produto ou serviço novo no Conta Azul? <button class="secundario">Atualizar a lista do Conta Azul</button></p>
     </form>`,
    req.query.aviso,
  );
});

app.post('/mapeamento', (req, res) => {
  const n = Number(req.body.n) || 0;
  const linhas = [];
  for (let i = 0; i < n; i++) {
    const id = req.body[`id_${i}`];
    if (!id) continue;
    const unidade = req.body[`unidade_${i}`];
    const nome = nomeNoCatalogo(unidade, id);
    linhas.push({
      unidade,
      tipo: req.body[`tipo_${i}`],
      codigoHts: req.body[`codigo_${i}`],
      idContaAzul: id,
      fator: String(req.body[`fator_${i}`] || '1').replace(',', '.'),
      observacao: nome,
    });
  }
  adicionarMapeamentos(linhas);
  revalidarPendentes();
  voltar(res, '/', `${linhas.length} item(ns) mapeado(s). As OS foram conferidas de novo.`);
});

app.post('/mapeamento/atualizar-catalogo', async (req, res) => {
  try {
    for (const unidade of Object.keys(UNIDADES)) {
      if (unidadeAutorizada(unidade)) await obterCatalogo(unidade, { atualizar: true });
    }
    const destino = String(req.body?.voltar || '/mapeamento');
    voltar(res, destino.startsWith('/') ? destino : '/mapeamento', 'Lista do Conta Azul atualizada.');
  } catch (erro) {
    voltar(res, '/mapeamento', erro.message);
  }
});

function nomeNoCatalogo(unidade, id) {
  return lerJson(`catalogo-${unidade}.json`, { itens: [] }).itens.find((c) => c.id === id)?.nome ?? '';
}

app.get('/autorizar/:unidade', (req, res) => {
  try {
    res.redirect(linkDeAutorizacao(req.params.unidade));
  } catch (erro) {
    voltar(res, '/', erro.message);
  }
});

app.get('/oauth/retorno', async (req, res) => {
  try {
    if (req.query.error) throw new Error(`O Conta Azul não autorizou: ${req.query.error_description ?? req.query.error}`);
    const unidade = await concluirAutorizacao({ code: req.query.code, state: req.query.state });
    voltar(res, '/', `${UNIDADES[unidade]} conectada ao Conta Azul.`);
  } catch (erro) {
    voltar(res, '/', erro.message);
  }
});

const { porta } = config();
app.listen(porta, '127.0.0.1', () => {
  console.log(`Painel aberto em http://localhost:${porta}`);
  console.log(config().envioReal ? 'ENVIO REAL ligado.' : 'Modo SIMULAÇÃO (ENVIO_REAL=false).');
});

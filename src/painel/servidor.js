// Painel local: http://localhost:3000
// Só aceita conexões do próprio computador, porque não tem login.
import express from 'express';
import { config, UNIDADES } from '../config.js';
import { listarOs, obterOs } from '../armazenamento.js';
import { linkDeAutorizacao, concluirAutorizacao, unidadeAutorizada } from '../contaazul/auth.js';
import {
  STATUS, ACOES, importarPastaDeEntrada, revalidarPendentes, prepararVenda, aprovarEEnviar, executarAcao,
} from '../processamento.js';
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
  res.redirect(url.pathname + url.search);
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
       <form class="inline" method="post" action="/importar"><button>Importar OS da pasta "entrada"</button></form>
       <form class="inline" method="post" action="/revalidar"><button class="secundario">Revalidar (depois de mexer no mapeamento)</button></form>
     </div>
     <p class="filtros">${filtroStatus}</p>
     <table>
       <thead><tr><th>OS</th><th>Unidade</th><th class="esconder-celular">Fechada em</th><th>Cliente</th>
       <th class="esconder-celular">Placa</th><th class="esconder-celular">Tipo</th><th class="num">Total</th><th>Status</th></tr></thead>
       <tbody>${linhas || '<tr><td colspan="8">Nenhuma OS aqui ainda. Coloque o CSV do HTS na pasta "entrada" e clique em Importar.</td></tr>'}</tbody>
     </table>`,
    req.query.aviso,
  );
});

app.post('/importar', (req, res) => {
  const r = importarPastaDeEntrada();
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

app.get('/os/:chave', (req, res) => {
  const os = obterOs(req.params.chave);
  if (!os) return voltar(res, '/', 'OS não encontrada.');

  const itens = os.itens
    .map(
      (i) => `<tr><td>${i.tipo === 'servico' ? 'Serviço' : 'Produto'}</td><td>${esc(i.codigoHts)}</td><td>${esc(i.descricao)}</td>
       <td class="num">${i.quantidade}</td><td class="num">${reais(i.valorUnitario)}</td><td class="num">${reais(i.desconto)}</td>
       <td class="num">${reais(i.quantidade * i.valorUnitario - (i.desconto || 0))}</td></tr>`,
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
     <p><b>Cliente:</b> ${esc(os.cliente?.nome)} · ${esc(os.cliente?.documento)}<br>
        <b>Placa:</b> ${esc(os.placa)} · <b>Fechada em:</b> ${dataBr(os.dataFechamento)} · <b>Tipo:</b> ${tipoOs(os)}
        ${os.venda?.numero ? `<br><b>Venda no Conta Azul:</b> nº ${esc(os.venda.numero)}` : ''}</p>
     ${os.problemas?.length ? `<ul class="problemas">${os.problemas.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
     ${os.status === 'venda_criada' ? '<p class="aviso">Venda criada. Abra-a no Conta Azul, confira e clique em "Emitir nota fiscal". Depois marque aqui como "NF emitida".</p>' : ''}
     <div class="acoes">${enviar}${acoes}</div>
     <table><thead><tr><th>Tipo</th><th>Código HTS</th><th>Descrição</th><th class="num">Qtd</th><th class="num">Unitário</th><th class="num">Desconto</th><th class="num">Total</th></tr></thead>
       <tbody>${itens}</tbody>
       <tfoot><tr><th colspan="6">Total da OS</th><th class="num">${reais(totalOs(os))}</th></tr></tfoot></table>
     <h3>Histórico</h3><ul>${historico}</ul>`,
    req.query.aviso,
  );
});

app.get('/os/:chave/previa', async (req, res) => {
  const os = obterOs(req.params.chave);
  if (!os) return voltar(res, '/', 'OS não encontrada.');
  try {
    const { venda, problemas } = await prepararVenda(os);
    responder(
      res,
      `Prévia OS ${os.numero}`,
      `<p><a href="${rotaOs(os.chave)}">← voltar para a OS</a></p>
       <h1>O que seria enviado ao Conta Azul (OS ${esc(os.numero)})</h1>
       ${problemas ? `<ul class="problemas">${problemas.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : `<pre>${esc(JSON.stringify(venda, null, 2))}</pre>`}
       <p>Nada foi criado no Conta Azul. Esta tela só consulta o cadastro do cliente.</p>`,
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

app.post('/os/:chave/acao', (req, res) => {
  try {
    executarAcao(req.params.chave, req.body.acao);
    voltar(res, rotaOs(req.params.chave), 'Feito.');
  } catch (erro) {
    voltar(res, rotaOs(req.params.chave), erro.message);
  }
});

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

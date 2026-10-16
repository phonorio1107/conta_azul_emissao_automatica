// Regras do fluxo: importar OS -> validar -> (Pedro aprova) -> criar venda no Conta Azul.
// A NF continua sendo emitida pelo Pedro no Conta Azul, a partir da venda criada (cenário B).
import fs from 'node:fs';
import path from 'node:path';
import { PASTA_ENTRADA, config } from './config.js';
import { listarOs, obterOs, salvarOs, registrarHistorico } from './armazenamento.js';
import { lerOsDeCsv } from './hts/importarCsv.js';
import { lerOsDePdf } from './hts/lerPdf.js';
import { carregarMapeamento, chaveMapa } from './mapeamento.js';
import { validarOs } from './validacao.js';
import { montarVenda } from './contaazul/montarVenda.js';
import { buscarCliente, criarVenda, proximoNumeroVenda } from './contaazul/cliente.js';
import { normalizarFormaPagamento } from './pagamento.js';

export const STATUS = {
  pendente: 'Pronta para aprovar',
  com_erro: 'Com problema',
  enviando: 'Enviando…',
  venda_criada: 'Venda criada – emitir NF',
  nf_emitida: 'NF emitida',
  ignorada: 'Ignorada',
};

// Depois de enviada, a OS não é mais sobrescrita por uma nova importação.
const TRAVADOS = new Set(['enviando', 'venda_criada', 'nf_emitida', 'ignorada']);

// Lê a pasta "entrada": planilhas .csv (várias OS) e PDFs de OS do HTS (uma OS cada).
export async function importarPastaDeEntrada() {
  fs.mkdirSync(PASTA_ENTRADA, { recursive: true });
  const arquivos = fs.readdirSync(PASTA_ENTRADA).filter((a) => /\.(csv|pdf)$/i.test(a));
  const resumo = { arquivos: arquivos.length, novas: 0, atualizadas: 0, jaEnviadas: 0, erros: [] };
  const processados = path.join(PASTA_ENTRADA, 'processados');

  for (const arquivo of arquivos) {
    const caminho = path.join(PASTA_ENTRADA, arquivo);
    try {
      const lista = /\.pdf$/i.test(arquivo)
        ? [await lerOsDePdf(fs.readFileSync(caminho))]
        : lerOsDeCsv(fs.readFileSync(caminho, 'utf8'));
      const contagem = importarOs(lista, arquivo);
      resumo.novas += contagem.novas;
      resumo.atualizadas += contagem.atualizadas;
      resumo.jaEnviadas += contagem.jaEnviadas;
      fs.mkdirSync(processados, { recursive: true });
      fs.renameSync(caminho, path.join(processados, `${Date.now()}-${arquivo}`));
    } catch (erro) {
      resumo.erros.push(`${arquivo}: ${erro.message}`);
    }
  }
  return resumo;
}

export function importarOs(lista, origem) {
  const mapeamento = carregarMapeamento();
  const contagem = { novas: 0, atualizadas: 0, jaEnviadas: 0 };
  for (const nova of lista) {
    const existente = obterOs(nova.chave);
    if (existente && TRAVADOS.has(existente.status)) {
      contagem.jaEnviadas++;
      continue;
    }
    const os = { ...nova, historico: existente?.historico ?? [] };
    aplicarValidacao(os, mapeamento);
    registrarHistorico(os, `${existente ? 'Reimportada' : 'Importada'} de ${origem}.`);
    salvarOs(os);
    existente ? contagem.atualizadas++ : contagem.novas++;
  }
  return contagem;
}

// Útil depois de completar o mapeamento: revalida tudo que ainda não foi enviado.
export function revalidarPendentes() {
  const mapeamento = carregarMapeamento();
  for (const os of listarOs()) {
    if (TRAVADOS.has(os.status)) continue;
    aplicarValidacao(os, mapeamento);
    salvarOs(os);
  }
}

function aplicarValidacao(os, mapeamento) {
  os.problemas = validarOs(os, mapeamento);
  os.status = os.problemas.length ? 'com_erro' : 'pendente';
}

// Itens das OS ainda não enviadas que não têm correspondente no Conta Azul,
// sem repetição. Alimenta a tela de mapeamento.
export function itensSemMapeamento() {
  const mapeamento = carregarMapeamento();
  const pendentes = new Map();
  for (const os of listarOs()) {
    if (TRAVADOS.has(os.status)) continue;
    for (const item of os.itens ?? []) {
      if (item.tipo !== 'produto' && item.tipo !== 'servico') continue;
      const chave = chaveMapa(os.unidade, item.tipo, item.codigoHts);
      if (mapeamento.has(chave)) continue;
      if (!pendentes.has(chave)) {
        pendentes.set(chave, { chave, unidade: os.unidade, tipo: item.tipo, codigoHts: item.codigoHts, descricao: item.descricao, oss: [] });
      }
      const p = pendentes.get(chave);
      if (!p.oss.includes(os.numero)) p.oss.push(os.numero);
    }
  }
  return [...pendentes.values()];
}

// Monta a venda consultando o cliente e o próximo número de venda no Conta Azul
// (só leitura). Não cria nada.
export async function prepararVenda(os) {
  const mapeamento = carregarMapeamento();
  const problemas = validarOs(os, mapeamento);
  if (problemas.length) return { problemas };

  const { cliente, problema } = await buscarCliente(os.unidade, os.cliente);
  if (problema) return { problemas: [problema] };
  const c = config();
  if (!['APROVADO', 'EM_ANDAMENTO'].includes(c.situacaoVenda)) {
    throw new Error(`SITUACAO_VENDA no .env deve ser APROVADO ou EM_ANDAMENTO (está "${c.situacaoVenda}").`);
  }
  const venda = montarVenda(os, {
    idCliente: cliente.id,
    numero: await proximoNumeroVenda(os.unidade),
    mapeamento,
    situacao: c.situacaoVenda,
    formaPagamento: normalizarFormaPagamento(os.formaPagamento) || normalizarFormaPagamento(c.formaPagamentoPadrao) || '',
  });
  return { venda, cliente };
}

export async function aprovarEEnviar(chave) {
  if (!config().envioReal) throw new Error('Modo simulação ativo (ENVIO_REAL=false). Nada foi enviado.');
  const os = obterOs(chave);
  if (!os) throw new Error('OS não encontrada.');
  if (os.status !== 'pendente') throw new Error(`Esta OS está como "${STATUS[os.status]}" e não pode ser enviada.`);

  const { venda, problemas } = await prepararVenda(os);
  if (problemas) {
    os.problemas = problemas;
    os.status = 'com_erro';
    salvarOs(os);
    return os;
  }

  // Marca antes de chamar a API: se algo cair no meio, a OS não é enviada duas vezes.
  os.status = 'enviando';
  salvarOs(os);
  try {
    const resposta = await criarVenda(os.unidade, venda);
    os.status = 'venda_criada';
    os.venda = { id: resposta?.id ?? null, numero: resposta?.numero ?? null };
    registrarHistorico(os, `Venda criada no Conta Azul${os.venda.numero ? ` (nº ${os.venda.numero})` : ''}.`);
  } catch (erro) {
    if (erro.status && erro.status < 500) {
      // O Conta Azul recusou com certeza: pode corrigir e tentar de novo.
      os.status = 'com_erro';
      os.problemas = [erro.message];
    } else {
      // Rede caiu ou erro do servidor: não dá para saber se a venda foi criada.
      // Fica "enviando" até o Pedro conferir no Conta Azul.
      os.problemas = [`Sem confirmação do Conta Azul (${erro.message}). Confira se a venda foi criada antes de qualquer coisa.`];
    }
    registrarHistorico(os, `Falha no envio: ${erro.message}`);
  }
  salvarOs(os);
  return os;
}

// Ações manuais do Pedro no painel.
export const ACOES = {
  marcar_nf_emitida: { de: ['venda_criada'], rotulo: 'NF emitida' },
  ignorar: { de: ['pendente', 'com_erro'], rotulo: 'Ignorar esta OS' },
  // Para OS presa em "enviando": Pedro conferiu no Conta Azul.
  venda_existe: { de: ['enviando'], rotulo: 'A venda existe no Conta Azul' },
  reabrir: { de: ['ignorada', 'enviando'], rotulo: 'Reabrir' },
};

export function executarAcao(chave, acao) {
  const os = obterOs(chave);
  if (!os) throw new Error('OS não encontrada.');
  if (!ACOES[acao]?.de.includes(os.status)) {
    throw new Error(`A ação "${acao}" não vale para uma OS "${STATUS[os.status]}".`);
  }
  if (acao === 'marcar_nf_emitida') os.status = 'nf_emitida';
  if (acao === 'ignorar') os.status = 'ignorada';
  if (acao === 'venda_existe') {
    os.status = 'venda_criada';
    os.problemas = [];
  }
  if (acao === 'reabrir') aplicarValidacao(os, carregarMapeamento());
  registrarHistorico(os, `Ação manual: ${ACOES[acao].rotulo}.`);
  salvarOs(os);
  return os;
}

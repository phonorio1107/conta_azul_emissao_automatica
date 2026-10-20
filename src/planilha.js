// Envia o produto novo para a planilha de SKUs (Google Sheets), por meio do script
// do Google colado na própria planilha (docs/planilha/apps-script.gs).
// Configuração no .env: PLANILHA_URL (link do "app da Web") e PLANILHA_TOKEN (a senha do script).
// Se a planilha estiver fora do ar, a linha fica guardada e pode ser reenviada pelo painel.
import { lerJson, gravarJson } from './armazenamento.js';

const ARQUIVO_PENDENTES = 'planilha-pendentes.json';

export function planilhaConfigurada() {
  return Boolean(process.env.PLANILHA_URL && process.env.PLANILHA_TOKEN);
}

export function linhasPendentes() {
  return lerJson(ARQUIVO_PENDENTES, []);
}

// Devolve null se deu certo, ou a mensagem de erro (e guarda a linha para reenviar).
export async function enviarParaPlanilha(linha) {
  try {
    await postar(linha);
    return null;
  } catch (erro) {
    gravarJson(ARQUIVO_PENDENTES, [...linhasPendentes(), linha]);
    return erro.message;
  }
}

export async function reenviarPendentes() {
  const restantes = [];
  let enviadas = 0;
  for (const linha of linhasPendentes()) {
    try {
      await postar(linha);
      enviadas++;
    } catch {
      restantes.push(linha);
    }
  }
  gravarJson(ARQUIVO_PENDENTES, restantes);
  return { enviadas, restantes: restantes.length };
}

// Pergunta à planilha qual o próximo SKU da sequência (HT....). null se não der.
export async function proximoSkuDaPlanilha() {
  if (!planilhaConfigurada()) return null;
  try {
    return (await postar({ acao: 'proximoSku' })).sku ?? null;
  } catch {
    return null;
  }
}

async function postar(linha) {
  if (!planilhaConfigurada()) throw new Error('Planilha não configurada (PLANILHA_URL e PLANILHA_TOKEN no .env).');
  const resposta = await fetch(process.env.PLANILHA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: process.env.PLANILHA_TOKEN, ...linha }),
  });
  const texto = await resposta.text();
  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(`A planilha respondeu algo inesperado (HTTP ${resposta.status}). Confira o link do script.`);
  }
  if (!dados.ok) throw new Error(`A planilha recusou: ${dados.erro ?? 'erro desconhecido'}`);
  return dados;
}

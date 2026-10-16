// Autorização OAuth 2.0 com o Conta Azul.
// 1. Pedro abre o link de autorização e entra com o login da unidade.
// 2. O Conta Azul devolve um "code" na URL de retorno.
// 3. Trocamos o code por um access_token (curta duração) e um refresh_token.
// 4. Quando o access_token vence, renovamos sozinhos com o refresh_token.
import crypto from 'node:crypto';
import { config, exigirCredenciais, validarUnidade } from '../config.js';
import { lerJson, gravarJson } from '../armazenamento.js';
import { AUTORIZACAO, TOKEN } from './endpoints.js';

// state = "<unidade>.<aleatório>": diz de qual unidade é o retorno e impede
// que um link forjado seja aceito.
export function linkDeAutorizacao(unidade) {
  validarUnidade(unidade);
  const c = exigirCredenciais();
  const state = `${unidade}.${crypto.randomBytes(8).toString('hex')}`;
  const pendentes = lerJson('autorizacoes-pendentes.json', {});
  pendentes[state] = Date.now();
  gravarJson('autorizacoes-pendentes.json', pendentes);

  const parametros = new URLSearchParams({
    response_type: 'code',
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    state,
    scope: c.scope,
  });
  return `${AUTORIZACAO}?${parametros}`;
}

export async function concluirAutorizacao({ code, state }) {
  const pendentes = lerJson('autorizacoes-pendentes.json', {});
  if (!state || !pendentes[state]) {
    throw new Error('Retorno de autorização desconhecido ou já usado. Gere um link novo e tente de novo.');
  }
  delete pendentes[state];
  gravarJson('autorizacoes-pendentes.json', pendentes);

  const unidade = validarUnidade(state.split('.')[0]);
  const c = exigirCredenciais();
  const tokens = await pedirToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: c.redirectUri,
  });
  salvarTokens(unidade, tokens);
  return unidade;
}

export function unidadeAutorizada(unidade) {
  return Boolean(lerJson('tokens.json', {})[unidade]);
}

export async function accessToken(unidade) {
  const salvo = lerJson('tokens.json', {})[unidade];
  if (!salvo) {
    throw new Error(`A unidade ${unidade} ainda não foi autorizada. Rode "npm run autorizar -- ${unidade}".`);
  }
  // Renova com 2 minutos de folga.
  if (Date.now() < salvo.expiraEm - 120_000) return salvo.access_token;

  const tokens = await pedirToken({ grant_type: 'refresh_token', refresh_token: salvo.refresh_token });
  salvarTokens(unidade, { refresh_token: salvo.refresh_token, ...tokens });
  return tokens.access_token;
}

async function pedirToken(corpo) {
  const c = exigirCredenciais();
  const basic = Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64');
  const resposta = await fetch(TOKEN, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(corpo),
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    throw new Error(`O Conta Azul recusou o token (HTTP ${resposta.status}): ${texto}`);
  }
  return JSON.parse(texto);
}

function salvarTokens(unidade, tokens) {
  const todos = lerJson('tokens.json', {});
  todos[unidade] = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiraEm: Date.now() + Number(tokens.expires_in ?? 3600) * 1000,
  };
  gravarJson('tokens.json', todos);
}

export { config };

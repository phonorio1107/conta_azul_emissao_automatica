import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// O .env, os dados (tokens, OS, mapeamento) e os PDFs ficam FORA da pasta do projeto,
// em <pasta do usuário>/nf-conta-azul. Assim, baixar uma versão nova do projeto não
// apaga nada. No Windows: C:\Users\<usuário>\nf-conta-azul
export const PASTA_USUARIO = process.env.NF_CONTA_AZUL_HOME ?? path.join(os.homedir(), 'nf-conta-azul');
export const ARQUIVO_ENV = path.join(PASTA_USUARIO, '.env');
// Os testes trocam estas pastas por temporárias via variável de ambiente.
export const PASTA_DADOS = process.env.PASTA_DADOS ?? path.join(PASTA_USUARIO, 'dados');
export const PASTA_ENTRADA = process.env.PASTA_ENTRADA ?? path.join(PASTA_USUARIO, 'entrada');

// Dentro do "npm test" não mexe em nada do usuário.
if (!process.env.NODE_TEST_CONTEXT) {
  migrarDaPastaDoProjeto();
  carregarEnv(ARQUIVO_ENV);
  carregarEnv(path.join(RAIZ, '.env'));
}

// Versões antigas guardavam .env e dados/ dentro do projeto: copia uma vez para fora.
function migrarDaPastaDoProjeto() {
  const envAntigo = path.join(RAIZ, '.env');
  if (fs.existsSync(envAntigo) && !fs.existsSync(ARQUIVO_ENV)) {
    fs.mkdirSync(PASTA_USUARIO, { recursive: true });
    fs.copyFileSync(envAntigo, ARQUIVO_ENV);
  }
  const dadosAntigos = path.join(RAIZ, 'dados');
  if (!process.env.PASTA_DADOS && fs.existsSync(dadosAntigos)) {
    fs.mkdirSync(PASTA_DADOS, { recursive: true });
    for (const nome of fs.readdirSync(dadosAntigos)) {
      const destino = path.join(PASTA_DADOS, nome);
      if (nome !== '.gitkeep' && !fs.existsSync(destino)) fs.copyFileSync(path.join(dadosAntigos, nome), destino);
    }
  }
}

// Lê um .env sem sobrescrever o que já veio do ambiente.
function carregarEnv(arquivo) {
  if (!fs.existsSync(arquivo)) return;
  for (const [chave, valor] of Object.entries(parseEnv(fs.readFileSync(arquivo, 'utf8')))) {
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}

// Unidades próprias que usam o Conta Azul. Cada uma autoriza o aplicativo
// separadamente e guarda o próprio token.
export const UNIDADES = {
  vinhedo: 'Vinhedo',
  barueri: 'Barueri (Kaizen)',
};

export function config() {
  return {
    clientId: process.env.CONTAAZUL_CLIENT_ID ?? '',
    clientSecret: process.env.CONTAAZUL_CLIENT_SECRET ?? '',
    redirectUri: process.env.CONTAAZUL_REDIRECT_URI ?? 'http://localhost:3000/oauth/retorno',
    scope: process.env.CONTAAZUL_SCOPE ?? 'openid profile aws.cognito.signin.user.admin',
    envioReal: process.env.ENVIO_REAL === 'true',
    // Situação com que a venda nasce no Conta Azul: APROVADO ou EM_ANDAMENTO.
    situacaoVenda: process.env.SITUACAO_VENDA || 'APROVADO',
    // Usada quando a OS não informa a forma de pagamento. Vazio = não informar.
    formaPagamentoPadrao: process.env.FORMA_PAGAMENTO_PADRAO ?? '',
    porta: Number(process.env.PORTA ?? 3000),
  };
}

export function exigirCredenciais() {
  const c = config();
  if (!c.clientId || !c.clientSecret) {
    throw new Error(`Preencha CONTAAZUL_CLIENT_ID e CONTAAZUL_CLIENT_SECRET no arquivo ${ARQUIVO_ENV} (veja docs/GUIA.md).`);
  }
  return c;
}

export function validarUnidade(unidade) {
  if (!UNIDADES[unidade]) {
    throw new Error(`Unidade desconhecida: "${unidade}". Use: ${Object.keys(UNIDADES).join(', ')}.`);
  }
  return unidade;
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Os testes trocam esta pasta por uma temporária via variável de ambiente.
export const PASTA_DADOS = process.env.PASTA_DADOS ?? path.join(RAIZ, 'dados');
export const PASTA_ENTRADA = path.join(RAIZ, 'entrada');

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
    throw new Error('Preencha CONTAAZUL_CLIENT_ID e CONTAAZUL_CLIENT_SECRET no arquivo .env (veja docs/GUIA.md).');
  }
  return c;
}

export function validarUnidade(unidade) {
  if (!UNIDADES[unidade]) {
    throw new Error(`Unidade desconhecida: "${unidade}". Use: ${Object.keys(UNIDADES).join(', ')}.`);
  }
  return unidade;
}

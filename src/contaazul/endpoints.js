// Todos os endereços da API do Conta Azul ficam aqui, num lugar só.
// Conferidos com os arquivos OpenAPI oficiais em docs/openapi/ e com o
// passo a passo do portal do desenvolvedor.

export const AUTORIZACAO = 'https://login.contaazul.com/#/oauth/authorize';
export const TOKEN = 'https://api-v2.contaazul.com/oauth/token';
export const API = 'https://api-v2.contaazul.com';

export const CAMINHOS = {
  contaConectada: '/v1/pessoas/conta-conectada', // dados da empresa dona do token
  buscarVendas: '/v1/venda/busca',
  criarVenda: '/v1/venda',
  proximoNumeroVenda: '/v1/venda/proximo-numero',
  pessoas: '/v1/pessoas',
  produtos: '/v1/produtos',
  ncm: '/v1/produtos/ncm',
  unidadesMedida: '/v1/produtos/unidades-medida',
  servicos: '/v1/servicos',
};

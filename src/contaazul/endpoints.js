// Todos os endereços da API do Conta Azul ficam aqui, num lugar só.
//
// CONFIRMADO = visto na documentação oficial (developers.contaazul.com).
// A CONFIRMAR = caminho provável; conferir no portal antes de ligar o ENVIO_REAL.
// Se algum mudar, basta corrigir esta lista.

export const AUTORIZACAO = 'https://login.contaazul.com/#/oauth/authorize'; // CONFIRMADO (changelog)
export const TOKEN = 'https://api-v2.contaazul.com/oauth/token'; // CONFIRMADO (FAQ e changelog)
export const API = 'https://api-v2.contaazul.com';

export const CAMINHOS = {
  buscarVendas: '/v1/venda/busca', // CONFIRMADO
  criarVenda: '/v1/venda', // CONFIRMADO ("Criar uma nova venda")
  pessoas: '/v1/pessoas', // A CONFIRMAR
  produtos: '/v1/produtos', // A CONFIRMAR
  servicos: '/v1/servicos', // A CONFIRMAR
};

// Formas de pagamento aceitas pelo Conta Azul (campo tipo_pagamento da venda),
// com apelidos para facilitar o preenchimento da planilha.
export const FORMAS_PAGAMENTO = [
  'BOLETO_BANCARIO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'CARTEIRA_DIGITAL', 'CASHBACK', 'CHEQUE',
  'CREDITO_LOJA', 'CREDITO_VIRTUAL', 'DEPOSITO_BANCARIO', 'DINHEIRO', 'OUTRO', 'DEBITO_AUTOMATICO',
  'LINK_PAGAMENTO', 'PIX_PAGAMENTO_INSTANTANEO', 'COBRANCA_PIX', 'PROGRAMA_FIDELIDADE', 'SEM_PAGAMENTO',
  'TRANSFERENCIA_BANCARIA', 'VALE_ALIMENTACAO', 'VALE_COMBUSTIVEL', 'VALE_PRESENTE', 'VALE_REFEICAO',
];

const APELIDOS = {
  pix: 'PIX_PAGAMENTO_INSTANTANEO',
  dinheiro: 'DINHEIRO',
  especie: 'DINHEIRO',
  credito: 'CARTAO_CREDITO',
  'cartao de credito': 'CARTAO_CREDITO',
  debito: 'CARTAO_DEBITO',
  'cartao de debito': 'CARTAO_DEBITO',
  boleto: 'BOLETO_BANCARIO',
  transferencia: 'TRANSFERENCIA_BANCARIA',
  ted: 'TRANSFERENCIA_BANCARIA',
  cheque: 'CHEQUE',
  outro: 'OUTRO',
};

// "Pix" -> "PIX_PAGAMENTO_INSTANTANEO" | "" -> "" | algo desconhecido -> null
export function normalizarFormaPagamento(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return '';
  if (FORMAS_PAGAMENTO.includes(t.toUpperCase())) return t.toUpperCase();
  const simples = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return APELIDOS[simples] ?? null;
}

// Transforma uma OS do HTS no corpo de "Criar uma nova venda" (POST /v1/venda),
// conforme o OpenAPI oficial (docs/openapi/vendas.json, schema CriacaoVendaRequest).
//
// Não colocamos CFOP, natureza de operação nem tributação aqui: isso fica na
// configuração fiscal de cada produto/serviço no próprio Conta Azul, como hoje.
import { chaveMapa } from '../mapeamento.js';
import { totalOs } from '../validacao.js';

export function montarVenda(os, { idCliente, numero, mapeamento, situacao, formaPagamento }) {
  const descontoTotal = arredondar(os.itens.reduce((soma, i) => soma + (i.desconto || 0), 0), 2);

  const venda = {
    id_cliente: idCliente,
    numero,
    situacao,
    data_venda: os.dataFechamento,
    observacoes: `OS ${os.numero} (HTS) – placa ${os.placa || 'não informada'}`,
    itens: os.itens.map((item) => {
      // Produto escolhido nesta OS tem prioridade sobre o mapeamento fixo.
      const mapa = item.escolha?.id
        ? { idContaAzul: item.escolha.id, fator: 1 }
        : mapeamento.get(chaveMapa(os.unidade, item.tipo, item.codigoHts));
      const quantidade = arredondar(item.quantidade * mapa.fator, 4);
      return {
        id: mapa.idContaAzul,
        descricao: item.descricao,
        quantidade,
        // Mantém o total da linha igual ao da OS mesmo quando há conversão de unidade.
        valor: arredondar((item.quantidade * item.valorUnitario) / quantidade, 2),
      };
    }),
    // A API só aceita desconto no total da venda, então somamos os descontos da OS.
    ...(descontoTotal > 0 ? { composicao_de_valor: { desconto: { tipo: 'VALOR', valor: descontoTotal } } } : {}),
    condicao_pagamento: {
      ...(formaPagamento ? { tipo_pagamento: formaPagamento } : {}),
      opcao_condicao_pagamento: 'À vista',
      parcelas: [{ data_vencimento: os.dataFechamento, valor: arredondar(totalOs(os), 2) }],
    },
  };
  return venda;
}

function arredondar(valor, casas) {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}

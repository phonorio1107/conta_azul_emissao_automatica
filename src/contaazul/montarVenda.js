// Transforma uma OS do HTS no corpo de "Criar uma nova venda" (POST /v1/venda).
//
// ATENÇÃO: confirmados na documentação oficial só "id_cliente" (UUID do cliente)
// e "itens" (lista obrigatória). Os demais nomes de campo seguem o padrão da API v2,
// mas precisam ser conferidos no OpenAPI de Vendas do portal antes de ligar o
// ENVIO_REAL. Se algo estiver diferente, o ajuste é só neste arquivo.
//
// Não colocamos CFOP, natureza de operação nem tributação aqui: isso fica na
// configuração fiscal de cada produto/serviço no próprio Conta Azul, como hoje.
import { chaveMapa } from '../mapeamento.js';

export function montarVenda(os, { idCliente, mapeamento }) {
  return {
    id_cliente: idCliente,
    data_venda: os.dataFechamento,
    situacao: 'APROVADO',
    observacoes: `OS ${os.numero} (HTS) – placa ${os.placa || 'não informada'}`,
    itens: os.itens.map((item) => {
      const mapa = mapeamento.get(chaveMapa(os.unidade, item.tipo, item.codigoHts));
      const quantidade = arredondar(item.quantidade * mapa.fator, 4);
      return {
        id: mapa.idContaAzul,
        descricao: item.descricao,
        quantidade,
        // Mantém o total da linha igual ao da OS mesmo quando há conversão de unidade.
        valor: arredondar((item.quantidade * item.valorUnitario) / quantidade, 2),
        ...(item.desconto ? { desconto: arredondar(item.desconto, 2) } : {}),
      };
    }),
  };
}

function arredondar(valor, casas) {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}

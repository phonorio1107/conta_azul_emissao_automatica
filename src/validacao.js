// Confere a OS antes de qualquer envio. Devolve a lista de problemas em português;
// lista vazia = OS pronta para aprovar.
import { UNIDADES } from './config.js';
import { chaveMapa } from './mapeamento.js';
import { normalizarFormaPagamento } from './pagamento.js';

export function validarOs(os, mapeamento) {
  const problemas = [];

  if (!UNIDADES[os.unidade]) problemas.push(`Unidade "${os.unidade}" desconhecida (use vinhedo ou barueri).`);
  if (!os.numero) problemas.push('OS sem número.');
  if (!os.dataFechamento) problemas.push('Data de fechamento ausente ou fora do formato dd/mm/aaaa.');

  problemas.push(...(os.problemasLeitura ?? []));

  // Com CPF/CNPJ (planilha) o cliente é achado pelo documento; sem ele (PDF),
  // pelo e-mail ou pelo nome.
  const doc = os.cliente?.documento ?? '';
  if (!os.cliente?.nome) problemas.push('Cliente sem nome.');
  if (doc && doc.length !== 11 && doc.length !== 14) problemas.push('CPF/CNPJ do cliente inválido (precisa de 11 ou 14 dígitos).');

  if (normalizarFormaPagamento(os.formaPagamento) === null) {
    problemas.push(`Forma de pagamento "${os.formaPagamento}" não reconhecida (use Pix, Dinheiro, Crédito, Débito, Boleto...).`);
  }

  if (!os.itens?.length) problemas.push('OS sem itens.');
  os.itens?.forEach((item, i) => {
    const qual = `Item ${i + 1} (${item.codigoHts || 'sem código'} – ${item.descricao || 'sem descrição'})`;
    if (item.tipo !== 'produto' && item.tipo !== 'servico') problemas.push(`${qual}: tipo deve ser "produto" ou "servico".`);
    if (!(item.quantidade > 0)) problemas.push(`${qual}: quantidade inválida.`);
    if (!(item.valorUnitario >= 0)) problemas.push(`${qual}: valor unitário inválido.`);
    if (!(item.desconto >= 0)) problemas.push(`${qual}: desconto inválido.`);
    if (!mapeamento.has(chaveMapa(os.unidade, item.tipo, item.codigoHts))) {
      problemas.push(`${qual}: sem correspondente no Conta Azul. Inclua no dados/mapeamento.csv.`);
    }
  });

  if (os.itens?.length && totalOs(os) <= 0) problemas.push('Total da OS é zero ou negativo.');
  return problemas;
}

export function totalOs(os) {
  return (os.itens ?? []).reduce((soma, i) => soma + i.quantidade * i.valorUnitario - (i.desconto || 0), 0);
}

export function tipoOs(os) {
  const tipos = new Set((os.itens ?? []).map((i) => i.tipo));
  if (tipos.has('produto') && tipos.has('servico')) return 'Produto e serviço';
  if (tipos.has('servico')) return 'Só serviço';
  if (tipos.has('produto')) return 'Só produto';
  return '—';
}

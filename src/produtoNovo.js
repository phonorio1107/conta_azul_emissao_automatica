// Cadastro de produto novo: cria no Conta Azul (saldo zero) e adiciona na planilha de SKUs
// (aba "Inventário": SKU, Endereço, Cód. Fabricante, Marca, Descrição, Montadora, Modelo,
// Grandeza, Equivalência, Nome Completo).
import { lerJson, gravarJson } from './armazenamento.js';
import { criarProduto, produtoPorSku } from './contaazul/cliente.js';
import { enviarParaPlanilha } from './planilha.js';

// Códigos de origem da mercadoria (tabela do ICMS) como o Conta Azul nomeia.
export const ORIGENS = {
  NACIONAL: '0 – Nacional',
  ESTRANGEIRA_IMPORTACAO_DIRETA: '1 – Estrangeira, importação direta',
  ESTRANGEIRA_ADQUIRIDA_INTERNAMENTE: '2 – Estrangeira, adquirida no mercado interno',
  NACIONAL_IMPORTACAO_SUPERIOR_40: '3 – Nacional, importação acima de 40%',
  NACIONAL_PRODUCAO_CONFORMIDADE: '4 – Nacional, processos produtivos básicos',
  NACIONAL_IMPORTACAO_INFERIOR_40: '5 – Nacional, importação até 40%',
  ESTRANGEIRA_IMPORTACAO_DIRETA_CAMEX: '6 – Estrangeira, importação direta, sem similar (CAMEX)',
  ESTRANGEIRA_ADQUIRIDA_INTERNAMENTE_CAMEX: '7 – Estrangeira, mercado interno, sem similar (CAMEX)',
  NACIONAL_MERCDORIA_BEM_IMPORTACAO_SUPERIOR_70: '8 – Nacional, importação acima de 70%',
};

export const TIPOS = {
  MERCADORIA_PARA_REVENDA: 'Mercadoria para revenda',
  MATERIAL_DE_USO_E_CONSUMO: 'Material de uso e consumo',
  MATERIA_PRIMA: 'Matéria-prima',
  PRODUTO_ACABADO: 'Produto acabado',
  OUTRAS: 'Outras',
};

// Mesmo nome que a fórmula da coluna "Nome Completo" monta: DESCRIÇÃO MARCA - CÓD. FABRICANTE
export function nomeProduto({ descricao, marca, codFabricante }) {
  const base = [descricao, marca].map((t) => String(t ?? '').trim()).filter(Boolean).join(' ');
  const cod = String(codFabricante ?? '').trim();
  return (cod ? `${base} - ${cod}` : base).toUpperCase();
}

// Próximo SKU da sequência HT0001, HT0002... a partir dos SKUs já existentes.
export function proximoSku(skus) {
  const numeros = skus.map((s) => String(s ?? '').trim().toUpperCase().match(/^HT(\d+)$/)?.[1]).filter(Boolean);
  if (!numeros.length) return '';
  const largura = Math.max(...numeros.map((n) => n.length));
  return `HT${String(Math.max(...numeros.map(Number)) + 1).padStart(largura, '0')}`;
}

export function validarProdutoNovo(d) {
  const problemas = [];
  if (!d.descricao?.trim()) problemas.push('Informe a descrição.');
  if (!d.marca?.trim()) problemas.push('Informe a marca.');
  if (!d.codFabricante?.trim()) problemas.push('Informe o código do fabricante.');
  if (!d.sku?.trim()) problemas.push('Informe o SKU.');
  if (d.sku && d.sku.trim().length > 20) problemas.push('O SKU pode ter no máximo 20 caracteres.');
  if (!d.ncmId) problemas.push('Escolha o NCM.');
  if (!d.unidadeId) problemas.push('Escolha a unidade.');
  if (!ORIGENS[d.origem]) problemas.push('Escolha a origem.');
  if (!TIPOS[d.tipo]) problemas.push('Escolha o tipo.');
  for (const [campo, rotulo] of [['valorVenda', 'Valor de venda'], ['custo', 'Custo']]) {
    if (d[campo] !== '' && d[campo] !== undefined && !(Number(d[campo]) >= 0)) problemas.push(`${rotulo} inválido.`);
  }
  if (nomeProduto(d).length > 100) problemas.push('O nome (descrição + marca + cód. fabricante) passa de 100 caracteres.');
  return problemas;
}

// Corpo de "Criar um novo produto" (POST /v1/produtos, schema CriacaoProduto).
export function montarProduto(d) {
  const estoque = { estoque_disponivel: 0 };
  if (d.valorVenda !== '' && d.valorVenda !== undefined) estoque.valor_venda = Number(d.valorVenda);
  if (d.custo !== '' && d.custo !== undefined) estoque.custo_medio = Number(d.custo);
  return {
    nome: nomeProduto(d),
    codigo_sku: d.sku.trim().toUpperCase(),
    status: 'ATIVO',
    formato: 'SIMPLES',
    fiscal: {
      ncm: { id: Number(d.ncmId) },
      origem: d.origem,
      tipo_produto: d.tipo,
      unidade_medida: { id: Number(d.unidadeId) },
    },
    estoque,
  };
}

// Lembra NCM, unidade, origem e tipo do último cadastro, para vir preenchido no próximo.
export function preferencias() {
  return lerJson('preferencias-produto.json', {});
}

export async function cadastrarProduto(unidade, d) {
  const problemas = validarProdutoNovo(d);
  if (problemas.length) return { problemas };

  const sku = d.sku.trim().toUpperCase();
  if (await produtoPorSku(unidade, sku)) {
    return { problemas: [`Já existe um produto com o SKU ${sku} no Conta Azul. Use a busca da OS para escolhê-lo.`] };
  }

  const corpo = montarProduto(d);
  const criado = await criarProduto(unidade, corpo);
  const produto = { tipo: 'produto', id: criado?.id, codigo: sku, nome: corpo.nome, saldo: 0 };
  if (!produto.id) throw new Error('O Conta Azul não devolveu o id do produto criado. Confira no Conta Azul antes de tentar de novo.');

  gravarJson('preferencias-produto.json', { ncmId: d.ncmId, ncmTexto: d.ncmTexto, unidadeId: d.unidadeId, origem: d.origem, tipo: d.tipo });
  const catalogo = lerJson(`catalogo-${unidade}.json`, null);
  if (catalogo) gravarJson(`catalogo-${unidade}.json`, { ...catalogo, itens: [...catalogo.itens, produto] });

  const maiusculo = (v) => String(v ?? '').trim().toUpperCase();
  const erroPlanilha = await enviarParaPlanilha({
    sku,
    endereco: maiusculo(d.endereco),
    codFabricante: maiusculo(d.codFabricante),
    marca: maiusculo(d.marca),
    descricao: maiusculo(d.descricao),
    montadora: maiusculo(d.montadora),
    modelo: maiusculo(d.modelo),
    grandeza: maiusculo(d.grandeza) || 'UND',
    equivalencia: maiusculo(d.equivalencia),
    nome: corpo.nome,
  });
  return { produto, erroPlanilha };
}

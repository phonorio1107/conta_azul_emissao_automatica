// Catálogo de produtos e serviços do Conta Azul de cada unidade, guardado em
// dados/catalogo-<unidade>.json para a tela de mapeamento não consultar a API toda hora.
import { lerJson, gravarJson } from './armazenamento.js';
import { listarTudo } from './contaazul/cliente.js';
import { CAMINHOS } from './contaazul/endpoints.js';

export async function obterCatalogo(unidade, { atualizar = false } = {}) {
  const arquivo = `catalogo-${unidade}.json`;
  const salvo = lerJson(arquivo, null);
  if (salvo && !atualizar) return salvo;

  const produtos = await listarTudo(unidade, CAMINHOS.produtos);
  const servicos = await listarTudo(unidade, CAMINHOS.servicos);
  const catalogo = {
    atualizadoEm: new Date().toISOString(),
    itens: [
      ...produtos.map((p) => ({ tipo: 'produto', id: p.id, codigo: p.codigo ?? '', nome: p.nome ?? '', saldo: p.saldo ?? null })),
      ...servicos.map((s) => ({ tipo: 'servico', id: s.id, codigo: s.codigo ?? '', nome: s.descricao ?? s.nome ?? '' })),
    ]
      .filter((i) => i.id)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
  gravarJson(arquivo, catalogo);
  return catalogo;
}

// Procura no catálogo por nome ou SKU. Todas as palavras digitadas precisam aparecer,
// sem diferença de acento ou maiúscula. "filtro psl55" acha "Filtro de óleo Tecfil PSL55".
export function buscarNoCatalogo(catalogo, tipo, termo, limite = 30) {
  const palavras = normalizar(termo).split(' ').filter(Boolean);
  if (!palavras.length) return [];
  return catalogo.itens
    .filter((i) => i.tipo === tipo)
    .filter((i) => {
      const texto = normalizar(`${i.codigo} ${i.nome}`);
      return palavras.every((p) => texto.includes(p));
    })
    .slice(0, limite);
}

function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

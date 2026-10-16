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
      ...produtos.map((p) => ({ tipo: 'produto', id: p.id, codigo: p.codigo ?? '', nome: p.nome ?? '' })),
      ...servicos.map((s) => ({ tipo: 'servico', id: s.id, codigo: s.codigo ?? '', nome: s.descricao ?? s.nome ?? '' })),
    ]
      .filter((i) => i.id)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
  gravarJson(arquivo, catalogo);
  return catalogo;
}

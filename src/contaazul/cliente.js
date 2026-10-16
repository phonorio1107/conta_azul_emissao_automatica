// Chamadas à API do Conta Azul, sempre em nome de uma unidade.
import { accessToken } from './auth.js';
import { API, CAMINHOS } from './endpoints.js';

export async function chamar(unidade, metodo, caminho, { consulta, corpo } = {}) {
  const url = new URL(caminho, API);
  for (const [chave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== '') url.searchParams.set(chave, valor);
  }
  const resposta = await fetch(url, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${await accessToken(unidade)}`,
      Accept: 'application/json',
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  const dados = texto ? tentarJson(texto) : null;
  if (!resposta.ok) {
    const erro = new Error(`Conta Azul respondeu HTTP ${resposta.status} em ${metodo} ${caminho}: ${texto.slice(0, 500)}`);
    erro.status = resposta.status;
    erro.detalhes = dados;
    throw erro;
  }
  return dados;
}

function tentarJson(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

// Cada lista da API vem num formato: pessoas e produtos em "items", vendas em
// "itens", e serviços como uma lista de páginas, cada uma com "itens".
export function extrairLista(dados) {
  if (Array.isArray(dados)) {
    return dados.some((d) => Array.isArray(d?.itens)) ? dados.flatMap((d) => d.itens ?? []) : dados;
  }
  return dados?.items ?? dados?.itens ?? [];
}

// Junta todas as páginas de uma lista.
export async function listarTudo(unidade, caminho, consulta = {}, tamanho = 100) {
  const todos = [];
  for (let pagina = 1; pagina <= 200; pagina++) {
    const dados = await chamar(unidade, 'GET', caminho, {
      consulta: { ...consulta, pagina, tamanho_pagina: tamanho },
    });
    const itens = extrairLista(dados);
    todos.push(...itens);
    if (itens.length < tamanho) break;
  }
  return todos;
}

export async function contaConectada(unidade) {
  return chamar(unidade, 'GET', CAMINHOS.contaConectada);
}

export async function buscarClientePorDocumento(unidade, documento) {
  const digitos = String(documento ?? '').replace(/\D/g, '');
  const dados = await chamar(unidade, 'GET', CAMINHOS.pessoas, {
    consulta: { documentos: digitos, pagina: 1, tamanho_pagina: 10 },
  });
  // Confere de novo aqui: o cadastro pode guardar o documento com pontos e traço.
  return extrairLista(dados).find((p) => String(p.documento ?? '').replace(/\D/g, '') === digitos) ?? null;
}

export async function proximoNumeroVenda(unidade) {
  return Number(await chamar(unidade, 'GET', CAMINHOS.proximoNumeroVenda));
}

export async function criarVenda(unidade, venda) {
  return chamar(unidade, 'POST', CAMINHOS.criarVenda, { corpo: venda });
}

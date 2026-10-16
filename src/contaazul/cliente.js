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

// A API pagina as listas; a resposta costuma vir em "itens". Junta todas as páginas.
export async function listarTudo(unidade, caminho, consulta = {}, tamanho = 100) {
  const todos = [];
  for (let pagina = 1; pagina <= 200; pagina++) {
    const dados = await chamar(unidade, 'GET', caminho, {
      consulta: { ...consulta, pagina, tamanho_pagina: tamanho },
    });
    const itens = Array.isArray(dados) ? dados : dados?.itens ?? [];
    todos.push(...itens);
    if (itens.length < tamanho) break;
  }
  return todos;
}

export async function buscarVendas(unidade, consulta = {}) {
  return chamar(unidade, 'GET', CAMINHOS.buscarVendas, { consulta: { pagina: 1, tamanho_pagina: 10, ...consulta } });
}

export async function buscarClientePorDocumento(unidade, documento) {
  const dados = await chamar(unidade, 'GET', CAMINHOS.pessoas, {
    consulta: { busca: documento, pagina: 1, tamanho_pagina: 10 },
  });
  const itens = Array.isArray(dados) ? dados : dados?.itens ?? [];
  const so = (v) => String(v ?? '').replace(/\D/g, '');
  return itens.find((p) => so(p.documento ?? p.cpf ?? p.cnpj) === so(documento)) ?? null;
}

export async function criarVenda(unidade, venda) {
  return chamar(unidade, 'POST', CAMINHOS.criarVenda, { corpo: venda });
}

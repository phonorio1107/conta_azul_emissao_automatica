// Chamadas à API do Conta Azul, sempre em nome de uma unidade.
import { accessToken, removerTokens } from './auth.js';
import { cnpjEsperado, UNIDADES } from '../config.js';
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

// Trava de segurança: confere se a conexão da unidade é com o CNPJ certo.
// Se não for, desfaz a conexão (para nunca criar venda na empresa errada) e explica.
const conferidas = new Set();
export async function conferirEmpresa(unidade, { desconectarSeErrada = true } = {}) {
  const esperado = cnpjEsperado(unidade);
  if (!esperado || conferidas.has(unidade)) return;
  const empresa = await contaConectada(unidade);
  const conectado = String(empresa?.documento ?? '').replace(/\D/g, '');
  if (conectado !== esperado) {
    if (desconectarSeErrada) removerTokens(unidade);
    throw new Error(
      `${UNIDADES[unidade] ?? unidade} foi conectada à empresa errada: ${empresa?.razao_social ?? empresa?.nome_fantasia ?? '?'} ` +
      `(CNPJ ${conectado || '?'}). O esperado é o CNPJ ${esperado}. A conexão foi desfeita: ` +
      'entre no Conta Azul com a empresa certa ativa e conecte de novo.',
    );
  }
  conferidas.add(unidade);
}

// Procura o cliente da OS no Conta Azul: pelo CPF/CNPJ quando a OS traz (planilha),
// senão pelo e-mail e depois pelo nome (PDF). Só aceita quando acha exatamente um.
// Devolve { cliente } ou { problema }.
export async function buscarCliente(unidade, { documento, email, nome }) {
  const pessoas = async (filtro) =>
    extrairLista(await chamar(unidade, 'GET', CAMINHOS.pessoas, { consulta: { ...filtro, pagina: 1, tamanho_pagina: 10 } }));

  if (documento) {
    const digitos = soDigitos(documento);
    // Confere de novo aqui: o cadastro pode guardar o documento com pontos e traço.
    const achados = (await pessoas({ documentos: digitos })).filter((p) => soDigitos(p.documento) === digitos);
    return unico(achados, `CPF/CNPJ ${documento}`);
  }

  if (email) {
    const alvo = email.trim().toLowerCase();
    const achados = (await pessoas({ emails: alvo })).filter((p) =>
      String(p.email ?? '').toLowerCase().split(/[,;\s]+/).includes(alvo),
    );
    if (achados.length) return unico(achados, `e-mail ${email}`);
  }

  if (nome) {
    const alvo = normalizarNome(nome);
    const mesmoNome = (lista) => lista.filter((p) => normalizarNome(p.nome) === alvo);
    let achados = mesmoNome(await pessoas({ nomes: nome.trim() }));
    // Se o filtro exato não achar (acento, espaço), tenta a busca textual da API.
    if (!achados.length) achados = mesmoNome(await pessoas({ busca: nome.trim() }));
    return unico(achados, `nome "${nome}"`);
  }

  return { problema: 'A OS não traz CPF/CNPJ, e-mail nem nome do cliente.' };
}

function unico(achados, como) {
  if (achados.length === 1) return { cliente: achados[0] };
  if (achados.length === 0) return { problema: `Nenhum cliente com ${como} no Conta Azul. Cadastre e tente de novo.` };
  return { problema: `Há ${achados.length} clientes com ${como} no Conta Azul. Deixe só um (ou ajuste o cadastro) e tente de novo.` };
}

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');
const normalizarNome = (v) =>
  String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export async function proximoNumeroVenda(unidade) {
  return Number(await chamar(unidade, 'GET', CAMINHOS.proximoNumeroVenda));
}

export async function criarVenda(unidade, venda) {
  return chamar(unidade, 'POST', CAMINHOS.criarVenda, { corpo: venda });
}

// ---- Cadastro de produto ----

export async function buscarNcm(unidade, termo) {
  return extrairLista(await chamar(unidade, 'GET', CAMINHOS.ncm, { consulta: { busca_textual: termo, pagina: 1, tamanho_pagina: 20 } }));
}

export async function listarUnidadesMedida(unidade) {
  return listarTudo(unidade, CAMINHOS.unidadesMedida);
}

export async function produtoPorSku(unidade, sku) {
  const lista = extrairLista(await chamar(unidade, 'GET', CAMINHOS.produtos, { consulta: { sku, pagina: 1, tamanho_pagina: 10 } }));
  return lista.find((p) => String(p.codigo ?? p.codigo_sku ?? '').toUpperCase() === sku.toUpperCase()) ?? null;
}

export async function criarProduto(unidade, produto) {
  return chamar(unidade, 'POST', CAMINHOS.produtos, { corpo: produto });
}

// Catálogo de peças do painel (substitui a planilha de SKUs).
// Fica em dados/pecas-<unidade>.json. Cada peça tem os campos da antiga planilha e o
// id do produto correspondente no Conta Azul (ligado pelo SKU).
import { parse } from 'csv-parse/sync';
import { lerJson, gravarJson } from './armazenamento.js';
import { nomeProduto } from './produtoNovo.js';

export const CAMPOS_PECA = [
  ['sku', 'SKU'],
  ['endereco', 'Endereço'],
  ['codFabricante', 'Cód. Fabricante'],
  ['marca', 'Marca'],
  ['descricao', 'Descrição'],
  ['montadora', 'Montadora'],
  ['modelo', 'Modelo'],
  ['grandeza', 'Grandeza'],
  ['equivalencia', 'Equivalência'],
];

// Cabeçalho da planilha (sem acento/maiúsculas) -> campo.
const CABECALHOS = {
  'sku': 'sku',
  'endereco': 'endereco',
  'cod. fabricante': 'codFabricante',
  'cod fabricante': 'codFabricante',
  'codigo fabricante': 'codFabricante',
  'codigo do fabricante': 'codFabricante',
  'marca': 'marca',
  'descricao': 'descricao',
  'montadora': 'montadora',
  'modelo': 'modelo',
  'grandeza': 'grandeza',
  'equivalencia': 'equivalencia',
};

const arquivo = (unidade) => `pecas-${unidade}.json`;

export function carregarPecas(unidade) {
  return lerJson(arquivo(unidade), { itens: [] }).itens;
}

function salvarPecas(unidade, itens) {
  itens.sort((a, b) => a.sku.localeCompare(b.sku, 'pt-BR', { numeric: true }));
  gravarJson(arquivo(unidade), { atualizadoEm: new Date().toISOString(), itens });
}

export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const maiusculo = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

export function nomeCompleto(peca) {
  return nomeProduto(peca);
}

// Lê o CSV baixado da planilha (Google Sheets: Arquivo → Fazer download → CSV).
// Acha sozinho a linha do cabeçalho (a que tem "SKU") e ignora linhas sem SKU.
export function lerPecasDeCsv(conteudo) {
  const texto = String(conteudo).replace(/^﻿/, '');
  const primeira = texto.split(/\r?\n/).find((l) => /sku/i.test(l)) ?? '';
  const delimitador = primeira.split(';').length > primeira.split(',').length ? ';' : ',';
  const linhas = parse(texto, { delimiter: delimitador, relax_column_count: true, skip_empty_lines: true });

  const iCab = linhas.findIndex((l) => l.some((c) => normalizar(c) === 'sku'));
  if (iCab < 0) throw new Error('Não achei a coluna "SKU" no arquivo. Baixe a aba Inventário como CSV.');
  const colunas = linhas[iCab].map((c) => CABECALHOS[normalizar(c)] ?? null);

  const pecas = [];
  const vistos = new Set();
  for (const linha of linhas.slice(iCab + 1)) {
    const peca = {};
    colunas.forEach((campo, i) => {
      if (campo) peca[campo] = maiusculo(linha[i]);
    });
    if (!peca.sku || vistos.has(peca.sku)) continue;
    vistos.add(peca.sku);
    pecas.push(peca);
  }
  return pecas;
}

// Junta as peças do arquivo com as que já existem (pelo SKU), mantendo o vínculo com o Conta Azul.
export function importarPecas(unidade, novas) {
  const atuais = new Map(carregarPecas(unidade).map((p) => [p.sku, p]));
  let incluidas = 0;
  let atualizadas = 0;
  for (const nova of novas) {
    const atual = atuais.get(nova.sku);
    if (atual) atualizadas++;
    else incluidas++;
    atuais.set(nova.sku, { ...atual, ...nova });
  }
  salvarPecas(unidade, [...atuais.values()]);
  return { incluidas, atualizadas, total: atuais.size };
}

// Liga cada peça ao produto do Conta Azul que tem o mesmo SKU.
export function vincularAoContaAzul(unidade, catalogoContaAzul) {
  const porSku = new Map(
    (catalogoContaAzul?.itens ?? []).filter((i) => i.tipo === 'produto' && i.codigo).map((i) => [i.codigo.trim().toUpperCase(), i]),
  );
  const pecas = carregarPecas(unidade);
  const semVinculo = [];
  for (const peca of pecas) {
    const produto = porSku.get(peca.sku);
    if (produto) peca.idContaAzul = produto.id;
    else {
      delete peca.idContaAzul;
      semVinculo.push(peca.sku);
    }
  }
  salvarPecas(unidade, pecas);
  return { vinculadas: pecas.length - semVinculo.length, semVinculo };
}

export function adicionarPeca(unidade, peca) {
  const pecas = carregarPecas(unidade).filter((p) => p.sku !== peca.sku);
  const limpa = Object.fromEntries(CAMPOS_PECA.map(([campo]) => [campo, maiusculo(peca[campo])]));
  pecas.push({ ...limpa, grandeza: limpa.grandeza || 'UND', idContaAzul: peca.idContaAzul, criadoNoPainelEm: new Date().toISOString() });
  salvarPecas(unidade, pecas);
}

// Busca por qualquer parte: SKU, cód. fabricante, marca, descrição, equivalência, montadora, modelo, endereço.
// Todas as palavras digitadas precisam aparecer.
export function buscarPecas(unidade, termo, { limite = 50, soVinculadas = false } = {}) {
  const palavras = normalizar(termo).split(' ').filter(Boolean);
  let pecas = carregarPecas(unidade);
  if (soVinculadas) pecas = pecas.filter((p) => p.idContaAzul);
  if (!palavras.length) return pecas.slice(-limite).reverse();
  return pecas
    .filter((p) => {
      const texto = normalizar(
        [p.sku, p.codFabricante, p.marca, p.descricao, p.equivalencia, p.montadora, p.modelo, p.endereco, nomeCompleto(p)].join(' '),
      );
      return palavras.every((x) => texto.includes(x));
    })
    .slice(0, limite);
}

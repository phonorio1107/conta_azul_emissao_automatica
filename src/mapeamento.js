// Tabela de tradução: código do item no HTS -> id do produto/serviço no Conta Azul.
// Fica em dados/mapeamento.csv (modelo em exemplos/mapeamento-exemplo.csv).
// Colunas: unidade;tipo;codigo_hts;id_conta_azul;fator_conversao;observacao
//
// fator_conversao: quantas unidades do Conta Azul equivalem a 1 unidade do HTS.
// Deixe 1 quando as unidades forem iguais.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { PASTA_DADOS } from './config.js';
import { numeroBr } from './numeros.js';

export const ARQUIVO_MAPEAMENTO = path.join(PASTA_DADOS, 'mapeamento.csv');

export function carregarMapeamento(conteudo) {
  if (conteudo === undefined) {
    if (!fs.existsSync(ARQUIVO_MAPEAMENTO)) return new Map();
    conteudo = fs.readFileSync(ARQUIVO_MAPEAMENTO, 'utf8');
  }
  const linhas = parse(conteudo.replace(/^﻿/, ''), {
    columns: (c) => c.map((x) => x.trim().toLowerCase()),
    delimiter: ';',
    skip_empty_lines: true,
    trim: true,
  });
  const mapa = new Map();
  for (const l of linhas) {
    if (!l.id_conta_azul) continue;
    const fator = l.fator_conversao ? numeroBr(l.fator_conversao) : 1;
    mapa.set(chaveMapa(l.unidade, l.tipo, l.codigo_hts), {
      idContaAzul: l.id_conta_azul,
      fator: Number.isFinite(fator) && fator > 0 ? fator : 1,
    });
  }
  return mapa;
}

export function chaveMapa(unidade, tipo, codigo) {
  return `${String(unidade).toLowerCase()}|${String(tipo).toLowerCase()}|${String(codigo).trim().toUpperCase()}`;
}

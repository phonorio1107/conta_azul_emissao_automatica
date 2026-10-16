// Lê as OS exportadas do HTS em CSV (uma linha por item da OS).
// Enquanto o HTS não tiver API, este é o "plugue" de entrada. Quando tiver,
// basta outro módulo que devolva as OS no mesmo formato de lerOsDeCsv().
//
// Colunas esperadas (cabeçalho na primeira linha, separador ";" ou ","):
// unidade;numero_os;data_fechamento;cliente_nome;cliente_documento;placa;
// tipo;codigo_hts;descricao;quantidade;valor_unitario;desconto
import { parse } from 'csv-parse/sync';
import { numeroBr, dataBr, soDigitos } from '../numeros.js';

export const COLUNAS = [
  'unidade', 'numero_os', 'data_fechamento', 'cliente_nome', 'cliente_documento', 'placa',
  'tipo', 'codigo_hts', 'descricao', 'quantidade', 'valor_unitario', 'desconto',
];

export function lerOsDeCsv(conteudo) {
  const texto = conteudo.replace(/^﻿/, ''); // BOM do Excel
  const primeiraLinha = texto.split(/\r?\n/, 1)[0];
  const delimitador = primeiraLinha.split(';').length >= primeiraLinha.split(',').length ? ';' : ',';
  const linhas = parse(texto, {
    columns: (cabecalho) => cabecalho.map((c) => c.trim().toLowerCase()),
    delimiter: delimitador,
    skip_empty_lines: true,
    trim: true,
  });

  const faltando = COLUNAS.filter((c) => linhas.length && !(c in linhas[0]));
  if (faltando.length) {
    throw new Error(`O arquivo não tem as colunas: ${faltando.join(', ')}. Use o modelo em exemplos/os-exemplo.csv.`);
  }

  const porOs = new Map();
  for (const linha of linhas) {
    const unidade = linha.unidade.toLowerCase();
    const numero = linha.numero_os;
    const chave = `${unidade}:${numero}`;
    if (!porOs.has(chave)) {
      porOs.set(chave, {
        chave,
        unidade,
        numero,
        dataFechamento: dataBr(linha.data_fechamento),
        cliente: { nome: linha.cliente_nome, documento: soDigitos(linha.cliente_documento) },
        placa: linha.placa.toUpperCase(),
        itens: [],
      });
    }
    porOs.get(chave).itens.push({
      tipo: normalizarTipo(linha.tipo),
      codigoHts: linha.codigo_hts,
      descricao: linha.descricao,
      quantidade: numeroBr(linha.quantidade),
      valorUnitario: numeroBr(linha.valor_unitario),
      desconto: linha.desconto ? numeroBr(linha.desconto) : 0,
    });
  }
  return [...porOs.values()];
}

function normalizarTipo(tipo) {
  const t = String(tipo).trim().toLowerCase();
  if (t.startsWith('prod') || t === 'p') return 'produto';
  if (t.startsWith('serv') || t === 's') return 'servico';
  return t;
}

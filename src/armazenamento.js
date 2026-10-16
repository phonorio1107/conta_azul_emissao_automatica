// Guarda o estado em arquivos JSON dentro de dados/ (fora do Git).
// Para o volume de OS de duas unidades isso basta; não precisa de banco de dados.
import fs from 'node:fs';
import path from 'node:path';
import { PASTA_DADOS } from './config.js';

export function lerJson(nome, padrao) {
  const arquivo = path.join(PASTA_DADOS, nome);
  if (!fs.existsSync(arquivo)) return padrao;
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

export function gravarJson(nome, valor) {
  fs.mkdirSync(PASTA_DADOS, { recursive: true });
  const arquivo = path.join(PASTA_DADOS, nome);
  const temporario = `${arquivo}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify(valor, null, 2));
  fs.renameSync(temporario, arquivo);
}

// ---- OS ----
// Chave de cada OS: "<unidade>:<numero>", para Vinhedo e Barueri não se misturarem.

export function chaveOs(unidade, numero) {
  return `${unidade}:${numero}`;
}

export function listarOs() {
  return Object.values(lerJson('os.json', {})).sort((a, b) =>
    (b.dataFechamento ?? '').localeCompare(a.dataFechamento ?? ''),
  );
}

export function obterOs(chave) {
  return lerJson('os.json', {})[chave];
}

export function salvarOs(os) {
  const todas = lerJson('os.json', {});
  todas[os.chave] = os;
  gravarJson('os.json', todas);
}

export function registrarHistorico(os, mensagem) {
  os.historico = [...(os.historico ?? []), { em: new Date().toISOString(), mensagem }];
}

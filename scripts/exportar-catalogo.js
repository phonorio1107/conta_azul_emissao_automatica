// Baixa (só leitura) os produtos e serviços cadastrados no Conta Azul da unidade
// para dados/catalogo-<unidade>.csv. Serve de base para montar o dados/mapeamento.csv.
// Uso: npm run exportar-catalogo -- vinhedo
import fs from 'node:fs';
import path from 'node:path';
import { PASTA_DADOS, validarUnidade } from '../src/config.js';
import { listarTudo } from '../src/contaazul/cliente.js';
import { CAMINHOS } from '../src/contaazul/endpoints.js';

const celula = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

try {
  const unidade = validarUnidade((process.argv[2] ?? '').toLowerCase());
  const linhas = [['tipo', 'id_conta_azul', 'codigo', 'nome'].join(';')];
  for (const [tipo, caminho] of [['produto', CAMINHOS.produtos], ['servico', CAMINHOS.servicos]]) {
    const itens = await listarTudo(unidade, caminho);
    for (const i of itens) {
      linhas.push([tipo, i.id, i.codigo ?? i.codigo_sku ?? '', i.nome ?? i.descricao ?? ''].map(celula).join(';'));
    }
    console.log(`${tipo}: ${itens.length}`);
  }
  fs.mkdirSync(PASTA_DADOS, { recursive: true });
  const arquivo = path.join(PASTA_DADOS, `catalogo-${unidade}.csv`);
  fs.writeFileSync(arquivo, '﻿' + linhas.join('\n'));
  console.log(`Salvo em ${arquivo}`);
} catch (erro) {
  console.error(`Erro: ${erro.message}`);
  process.exitCode = 1;
}

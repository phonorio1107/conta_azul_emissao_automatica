// Baixa (só leitura) os produtos e serviços cadastrados no Conta Azul da unidade
// para dados/catalogo-<unidade>.csv (para abrir no Excel). A tela "Mapear itens"
// do painel faz isso sozinha; este comando é só para consulta.
// Uso: npm run exportar-catalogo -- vinhedo
import fs from 'node:fs';
import path from 'node:path';
import { PASTA_DADOS, validarUnidade } from '../src/config.js';
import { obterCatalogo } from '../src/catalogo.js';

const celula = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

try {
  const unidade = validarUnidade((process.argv[2] ?? '').toLowerCase());
  const { itens } = await obterCatalogo(unidade, { atualizar: true });
  const linhas = [['tipo', 'id_conta_azul', 'codigo', 'nome'].join(';')];
  for (const i of itens) linhas.push([i.tipo, i.id, i.codigo, i.nome].map(celula).join(';'));
  const arquivo = path.join(PASTA_DADOS, `catalogo-${unidade}.csv`);
  fs.writeFileSync(arquivo, '﻿' + linhas.join('\n'));
  console.log(`${itens.filter((i) => i.tipo === 'produto').length} produtos e ${itens.filter((i) => i.tipo === 'servico').length} serviços.`);
  console.log(`Salvo em ${arquivo}`);
} catch (erro) {
  console.error(`Erro: ${erro.message}`);
  process.exitCode = 1;
}

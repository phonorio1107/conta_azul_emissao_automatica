// Catálogo de peças do painel: importação da planilha (CSV), vínculo com o Conta Azul e busca.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-pecas-'));
process.env.PASTA_DADOS = pasta;
after(() => fs.rmSync(pasta, { recursive: true, force: true }));

const { lerPecasDeCsv, importarPecas, vincularAoContaAzul, buscarPecas, carregarPecas, adicionarPeca, nomeCompleto } = await import('../src/pecas.js');
const { proximoSku } = await import('../src/produtoNovo.js');

// Como o Google Sheets exporta a aba Inventário: linha de título, cabeçalho, dados.
const csv = [
  'Inventário,,,,,,,,,',
  'SKU,Endereço,Cód. Fabricante,Marca,Descrição,Montadora,Modelo,Grandeza,Equivalência,Nome Completo',
  'HT0793,7-6,8100 5W40,MOTUL,OLEO MOTOR,,,UND,,OLEO MOTOR MOTUL - 8100 5W40',
  'HT0794,7-7,6100 5W40,MOTUL,OLEO MOTOR,,4L,UND,,OLEO MOTOR MOTUL - 6100 5W40',
  'HT0805,7-7,MOTRIO 0W20,RENAULT,OLEO MOTOR,RENAULT,,UND,,OLEO MOTOR RENAULT - MOTRIO 0W20',
  '"HT0806","7-7","0W30 INEO FIRST","TOTAL","OLEO MOTOR","","","UND","QUARTZ, INEO","OLEO MOTOR TOTAL - 0W30 INEO FIRST"',
  ',,,,,,,,,',
  'HT0794,repetido,,,,,,,,',
].join('\r\n');

test('lê o CSV da planilha: acha o cabeçalho, ignora vazias e repetidas', () => {
  const pecas = lerPecasDeCsv(`﻿${csv}`);
  assert.equal(pecas.length, 4);
  assert.deepEqual(pecas[1], {
    sku: 'HT0794', endereco: '7-7', codFabricante: '6100 5W40', marca: 'MOTUL', descricao: 'OLEO MOTOR',
    montadora: '', modelo: '4L', grandeza: 'UND', equivalencia: '',
  });
  assert.equal(pecas[3].equivalencia, 'QUARTZ, INEO');
  assert.equal(nomeCompleto(pecas[0]), 'OLEO MOTOR MOTUL - 8100 5W40');
  assert.throws(() => lerPecasDeCsv('a,b\n1,2'), /SKU/);
});

test('importa, liga ao Conta Azul pelo SKU e reimporta sem perder o vínculo', () => {
  assert.deepEqual(importarPecas('vinhedo', lerPecasDeCsv(csv)), { incluidas: 4, atualizadas: 0, total: 4 });
  const catalogoCA = {
    itens: [
      { tipo: 'produto', id: 'ca-793', codigo: 'HT0793' },
      { tipo: 'produto', id: 'ca-794', codigo: 'ht0794 ' },
      { tipo: 'produto', id: 'ca-806', codigo: 'HT0806' },
      { tipo: 'servico', id: 's', codigo: 'HT0805' },
    ],
  };
  assert.deepEqual(vincularAoContaAzul('vinhedo', catalogoCA), { vinculadas: 3, semVinculo: ['HT0805'] });

  const outra = csv.replace('7-6,8100 5W40', '9-9,8100 5W40');
  assert.deepEqual(importarPecas('vinhedo', lerPecasDeCsv(outra)), { incluidas: 0, atualizadas: 4, total: 4 });
  const p = carregarPecas('vinhedo').find((x) => x.sku === 'HT0793');
  assert.equal(p.endereco, '9-9');
  assert.equal(p.idContaAzul, 'ca-793');
});

test('busca por cód. fabricante, marca, equivalência, sem acento', () => {
  assert.deepEqual(buscarPecas('vinhedo', 'motul 6100').map((p) => p.sku), ['HT0794']);
  assert.deepEqual(buscarPecas('vinhedo', 'quartz').map((p) => p.sku), ['HT0806']);
  assert.deepEqual(buscarPecas('vinhedo', 'óleo renault').map((p) => p.sku), ['HT0805']);
  assert.deepEqual(buscarPecas('vinhedo', 'oleo', { soVinculadas: true }).map((p) => p.sku), ['HT0793', 'HT0794', 'HT0806']);
});

test('peça cadastrada no painel entra no catálogo e o próximo SKU segue a sequência', () => {
  adicionarPeca('vinhedo', { sku: 'ht0807', codFabricante: 'wk58', marca: 'mann', descricao: 'filtro de óleo', idContaAzul: 'ca-807' });
  const p = carregarPecas('vinhedo').find((x) => x.sku === 'HT0807');
  assert.equal(nomeCompleto(p), 'FILTRO DE ÓLEO MANN - WK58');
  assert.equal(p.grandeza, 'UND');
  assert.equal(proximoSku(carregarPecas('vinhedo').map((x) => x.sku)), 'HT0808');
});

// Escolha do produto (SKU) por OS, busca no catálogo e mapeamento "sempre".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-produtos-'));
process.env.PASTA_DADOS = pasta;

const { importarOs, escolherProduto, limparEscolha, itensSemMapeamento } = await import('../src/processamento.js');
const { obterOs } = await import('../src/armazenamento.js');
const { lerOsDePdf } = await import('../src/hts/lerPdf.js');
const { buscarNoCatalogo } = await import('../src/catalogo.js');
const { carregarMapeamento, adicionarMapeamentos } = await import('../src/mapeamento.js');
const { montarVenda } = await import('../src/contaazul/montarVenda.js');

const catalogo = {
  itens: [
    { tipo: 'produto', id: 'p-1', codigo: 'TEC-PSL55', nome: 'Filtro de óleo Tecfil PSL55', saldo: 3 },
    { tipo: 'produto', id: 'p-2', codigo: 'MOB-5W30', nome: 'Óleo Mobil Super 5W30 1L', saldo: 20 },
    { tipo: 'produto', id: 'p-3', codigo: 'FRAM-PH', nome: 'Filtro de óleo Fram PH6017', saldo: 0 },
    { tipo: 'servico', id: 's-1', codigo: 'REV', nome: 'Revisão Preço Fixo HT BASIC' },
  ],
};
const pdf = () => lerOsDePdf(fs.readFileSync(new URL('./fixtures/os-vinhedo-ficticia.pdf', import.meta.url)));

test('busca por nome ou SKU, sem acento, com várias palavras', () => {
  assert.deepEqual(buscarNoCatalogo(catalogo, 'produto', 'filtro oleo').map((p) => p.id), ['p-1', 'p-3']);
  assert.deepEqual(buscarNoCatalogo(catalogo, 'produto', 'psl55').map((p) => p.id), ['p-1']);
  assert.deepEqual(buscarNoCatalogo(catalogo, 'produto', 'ÓLEO mobil').map((p) => p.id), ['p-2']);
  assert.deepEqual(buscarNoCatalogo(catalogo, 'produto', 'revisao'), []);
  assert.deepEqual(buscarNoCatalogo(catalogo, 'produto', '   '), []);
});

test('produto escolhido na OS libera a OS e vai para a venda', async () => {
  adicionarMapeamentos([{ unidade: 'vinhedo', tipo: 'servico', codigoHts: 'Revisão Preço Fixo HT BASIC', idContaAzul: 's-1', fator: 1, observacao: 'Revisão' }]);
  importarOs([await pdf()], 'teste');
  let osLida = obterOs('vinhedo:9001');
  assert.equal(osLida.status, 'com_erro');
  assert.equal(osLida.problemas.filter((p) => p.includes('escolha o produto')).length, 2);
  // Serviço já mapeado: nada pendente na tela "Mapear serviços"; produtos não aparecem lá.
  assert.deepEqual(itensSemMapeamento(), []);

  escolherProduto('vinhedo:9001', 1, catalogo.itens[1]);
  osLida = escolherProduto('vinhedo:9001', 2, catalogo.itens[0]);
  assert.equal(osLida.status, 'pendente');

  const venda = montarVenda(osLida, { idCliente: 'c', numero: 1, mapeamento: carregarMapeamento(), situacao: 'APROVADO', formaPagamento: '' });
  assert.deepEqual(venda.itens.map((i) => i.id), ['s-1', 'p-2', 'p-1']);
});

test('reimportar o mesmo PDF mantém os produtos escolhidos', async () => {
  importarOs([await pdf()], 'teste');
  const osLida = obterOs('vinhedo:9001');
  assert.equal(osLida.itens[2].escolha.id, 'p-1');
  assert.equal(osLida.status, 'pendente');
});

test('"usar sempre" grava no mapeamento e vale para as próximas OS', async () => {
  limparEscolha('vinhedo:9001', 1);
  assert.equal(obterOs('vinhedo:9001').status, 'com_erro');
  escolherProduto('vinhedo:9001', 1, catalogo.itens[1], { sempre: true });
  assert.equal(obterOs('vinhedo:9001').status, 'pendente');

  // Outra OS com a mesma descrição de óleo: só falta escolher o filtro.
  const outra = { ...(await pdf()), numero: '9100', chave: 'vinhedo:9100' };
  importarOs([outra], 'teste');
  const problemas = obterOs('vinhedo:9100').problemas;
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /Filtro de oleo/);
  fs.rmSync(pasta, { recursive: true, force: true });
});

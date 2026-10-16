import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lerOsDePdf, chaveDescricao } from '../src/hts/lerPdf.js';
import { carregarMapeamento } from '../src/mapeamento.js';
import { validarOs } from '../src/validacao.js';

const fixture = (nome) => fs.readFileSync(new URL(`./fixtures/${nome}`, import.meta.url));

test('lê a OS em PDF do HTS (layout fictício)', async () => {
  const os = await lerOsDePdf(fixture('os-vinhedo-ficticia.pdf'));
  assert.equal(os.unidade, 'vinhedo');
  assert.equal(os.numero, '9001');
  assert.equal(os.chave, 'vinhedo:9001');
  assert.equal(os.dataFechamento, '2026-10-15');
  assert.equal(os.placa, 'TST1A23');
  assert.deepEqual(os.cliente, { nome: 'Cliente Ficticio da Silva', email: 'cliente.ficticio@exemplo.com', documento: '' });
  assert.deepEqual(os.problemasLeitura, []);

  assert.equal(os.itens.length, 3);
  const [servico, oleo, filtro] = os.itens;
  assert.equal(servico.tipo, 'servico');
  assert.match(servico.descricao, /^Revisão Preço Fixo HT BASIC \(SERVIÇOS: .* Inspeção das lâmpadas\. \)$/);
  assert.equal(servico.codigoHts, 'Revisão Preço Fixo HT BASIC');
  assert.deepEqual([oleo.tipo, oleo.quantidade, oleo.valorUnitario], ['produto', 4, 85]);
  assert.deepEqual([filtro.tipo, filtro.quantidade, filtro.valorUnitario], ['produto', 1, 52]);
});

test('TOTAL diferente da soma dos itens vira problema', async () => {
  const os = await lerOsDePdf(fixture('os-total-divergente.pdf'));
  assert.equal(os.unidade, 'barueri');
  assert.equal(os.itens.length, 2);
  assert.ok(os.problemasLeitura.some((p) => p.includes('não bate com o TOTAL')));
  assert.ok(validarOs(os, new Map()).some((p) => p.includes('não bate com o TOTAL')));
});

test('mapeamento pela descrição ignora acentos e maiúsculas; OS sem CPF passa', async () => {
  const os = await lerOsDePdf(fixture('os-vinhedo-ficticia.pdf'));
  const mapa = carregarMapeamento(
    'unidade;tipo;codigo_hts;id_conta_azul;fator_conversao;observacao\n'
    + 'vinhedo;servico;REVISAO PRECO FIXO HT BASIC;s-1;1;\n'
    + 'vinhedo;produto;Oleo do motor 5W30;p-1;1;\n'
    + 'vinhedo;produto;filtro de óleo;p-2;1;\n',
  );
  assert.deepEqual(validarOs(os, mapa), []);
});

test('chave da descrição corta o trecho entre parênteses', () => {
  assert.equal(chaveDescricao('Alinhamento 3D  (com cambagem)'), 'Alinhamento 3D');
  assert.equal(chaveDescricao('Filtro de oleo'), 'Filtro de oleo');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { numeroBr, dataBr } from '../src/numeros.js';
import { lerOsDeCsv } from '../src/hts/importarCsv.js';
import { carregarMapeamento } from '../src/mapeamento.js';
import { validarOs, totalOs, tipoOs } from '../src/validacao.js';
import { montarVenda } from '../src/contaazul/montarVenda.js';

const csv = fs.readFileSync(new URL('../exemplos/os-exemplo.csv', import.meta.url), 'utf8');
const mapaCsv = fs.readFileSync(new URL('../exemplos/mapeamento-exemplo.csv', import.meta.url), 'utf8');

test('números e datas no formato brasileiro', () => {
  assert.equal(numeroBr('1.234,56'), 1234.56);
  assert.equal(numeroBr('R$ 10,00'), 10);
  assert.equal(numeroBr('62.90'), 62.9);
  assert.ok(Number.isNaN(numeroBr('')));
  assert.equal(dataBr('15/10/2026'), '2026-10-15');
  assert.equal(dataBr('2026-10-15T10:00'), '2026-10-15');
  assert.equal(dataBr('ontem'), '');
});

test('agrupa as linhas do CSV por OS e unidade', () => {
  const lista = lerOsDeCsv(csv);
  assert.equal(lista.length, 3);
  const os = lista.find((o) => o.chave === 'vinhedo:1001');
  assert.equal(os.itens.length, 3);
  assert.equal(os.cliente.documento, '12345678909');
  assert.equal(os.dataFechamento, '2026-10-15');
  assert.equal(tipoOs(os), 'Produto e serviço');
  assert.equal(totalOs(os), 4 * 62.9 + 45 - 5 + 80);
});

test('aceita CSV separado por vírgula', () => {
  const virgula = 'unidade,numero_os,data_fechamento,cliente_nome,cliente_documento,placa,tipo,codigo_hts,descricao,quantidade,valor_unitario,desconto\n'
    + 'vinhedo,7,01/10/2026,Fulano,12345678909,AAA0000,servico,X,"Serviço, completo",1,10.5,\n';
  const [os] = lerOsDeCsv(virgula);
  assert.equal(os.itens[0].descricao, 'Serviço, completo');
  assert.equal(os.itens[0].valorUnitario, 10.5);
});

test('recusa CSV sem as colunas do modelo', () => {
  assert.throws(() => lerOsDeCsv('numero;cliente\n1;Fulano\n'), /não tem as colunas/);
});

test('OS do exemplo passa na validação com o mapeamento completo', () => {
  const mapa = carregarMapeamento(mapaCsv);
  for (const os of lerOsDeCsv(csv)) assert.deepEqual(validarOs(os, mapa), [], os.chave);
});

test('aponta item sem mapeamento, CPF inválido e unidade desconhecida', () => {
  const [os] = lerOsDeCsv(csv);
  const problemas = validarOs({ ...os, unidade: 'mooca', cliente: { nome: 'X', documento: '123' } }, carregarMapeamento(mapaCsv));
  assert.ok(problemas.some((p) => p.includes('Unidade "mooca"')));
  assert.ok(problemas.some((p) => p.includes('CPF/CNPJ')));
  assert.ok(problemas.some((p) => p.includes('sem correspondente no Conta Azul')));
});

test('monta a venda com ids do Conta Azul e mantém o total com conversão de unidade', () => {
  const mapa = carregarMapeamento(
    mapaCsv.replace('VELA-IGN;00000000-0000-0000-0000-000000000005;1', 'VELA-IGN;00000000-0000-0000-0000-000000000005;0,25'),
  );
  const os = lerOsDeCsv(csv).find((o) => o.chave === 'barueri:5001');
  const venda = montarVenda(os, { idCliente: 'cliente-uuid', mapeamento: mapa });
  assert.equal(venda.id_cliente, 'cliente-uuid');
  assert.equal(venda.data_venda, '2026-10-16');
  assert.match(venda.observacoes, /OS 5001/);
  const [item] = venda.itens;
  assert.equal(item.id, '00000000-0000-0000-0000-000000000005');
  assert.equal(item.quantidade, 1);
  assert.equal(item.valor, 154);
});

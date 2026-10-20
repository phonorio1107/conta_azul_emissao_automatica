// Proteção: o painel precisa estar inteiro e sem erro de sintaxe (sem iniciar o servidor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

test('painel/servidor.js está completo e válido', () => {
  const arquivo = new URL('../src/painel/servidor.js', import.meta.url);
  const codigo = fs.readFileSync(arquivo, 'utf8');
  for (const rota of ["app.get('/'", "app.get('/os/:chave'", "app.get('/catalogo'", "app.get('/produtos/novo'", 'app.listen(']) {
    assert.ok(codigo.includes(rota), rota);
  }
  execFileSync(process.execPath, ['--check', arquivo.pathname]);
});

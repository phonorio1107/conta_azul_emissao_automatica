// Cria (se não existir) e abre o arquivo .env com as credenciais do Conta Azul.
// Ele fica fora da pasta do projeto, para não se perder ao atualizar.
// Uso: npm run configurar
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ARQUIVO_ENV, PASTA_USUARIO, RAIZ } from '../src/config.js';

if (!fs.existsSync(ARQUIVO_ENV)) {
  fs.mkdirSync(PASTA_USUARIO, { recursive: true });
  fs.copyFileSync(path.join(RAIZ, '.env.example'), ARQUIVO_ENV);
  console.log(`Criado: ${ARQUIVO_ENV}`);
}
console.log(`Abrindo ${ARQUIVO_ENV} — preencha, salve (Ctrl+S) e feche.`);
const editor = process.platform === 'win32' ? 'notepad' : process.env.EDITOR || 'nano';
spawn(editor, [ARQUIVO_ENV], { stdio: 'inherit' });

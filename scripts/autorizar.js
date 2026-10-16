// Conecta uma unidade ao Conta Azul sem depender do painel.
// Uso: npm run autorizar -- vinhedo   (ou barueri)
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { linkDeAutorizacao, concluirAutorizacao } from '../src/contaazul/auth.js';

const unidade = (process.argv[2] ?? '').toLowerCase();

try {
  const link = linkDeAutorizacao(unidade);
  console.log('\n1) Abra este link no navegador e entre com o login do Conta Azul da unidade:\n');
  console.log(link);
  console.log('\n2) Depois de autorizar, o navegador vai para outra página (pode até dar erro, tudo bem).');
  console.log('   Copie o endereço COMPLETO da barra do navegador e cole aqui.\n');

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const colado = (await rl.question('Endereço: ')).trim();
  rl.close();

  const url = new URL(colado);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Não achei o "code" nesse endereço. Confira se copiou a barra inteira.');
  const feita = await concluirAutorizacao({ code, state: url.searchParams.get('state') });
  console.log(`\nPronto: ${feita} conectada. Agora rode "npm run testar-conexao -- ${feita}".`);
} catch (erro) {
  console.error(`\nErro: ${erro.message}`);
  process.exitCode = 1;
}

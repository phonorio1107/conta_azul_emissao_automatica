// Conecta uma unidade ao Conta Azul sem depender do painel.
// Uso: npm run autorizar -- vinhedo                   (login normal)
//      npm run autorizar -- vinhedo --refresh-token   (app de desenvolvimento)
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { linkDeAutorizacao, concluirAutorizacao, conectarComRefreshToken } from '../src/contaazul/auth.js';

const unidade = (process.argv[2] ?? '').toLowerCase();
const comRefresh = process.argv.includes('--refresh-token');
const rl = readline.createInterface({ input: stdin, output: stdout });

try {
  if (comRefresh) {
    const refresh = await rl.question('Cole o refresh_token que o portal mostrou: ');
    await conectarComRefreshToken(unidade, refresh);
    console.log(`\nPronto: ${unidade} conectada. Agora rode "npm run testar-conexao -- ${unidade}".`);
  } else {
    const link = linkDeAutorizacao(unidade);
    console.log('\n1) Abra este link no navegador e entre com o login do Conta Azul da unidade:\n');
    console.log(link);
    console.log('\n2) Depois de autorizar, o navegador vai para outra página (pode até dar erro, tudo bem).');
    console.log('   Copie o endereço COMPLETO da barra do navegador e cole aqui.');
    console.log('   Seja rápido: o código vale só 3 minutos.\n');

    const url = new URL((await rl.question('Endereço: ')).trim());
    const code = url.searchParams.get('code');
    if (!code) throw new Error('Não achei o "code" nesse endereço. Confira se copiou a barra inteira.');
    const feita = await concluirAutorizacao({ code, state: url.searchParams.get('state') });
    console.log(`\nPronto: ${feita} conectada. Agora rode "npm run testar-conexao -- ${feita}".`);
  }
} catch (erro) {
  console.error(`\nErro: ${erro.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}

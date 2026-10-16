// Conecta uma unidade ao Conta Azul sem depender do painel.
// Uso: npm run autorizar -- vinhedo                   (login normal)
//      npm run autorizar -- vinhedo --refresh-token   (app de desenvolvimento)
import readline from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
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
    console.log('   Copie o endereço COMPLETO da barra do navegador (Ctrl+C).');
    console.log('3) Volte aqui e só aperte ENTER: o endereço é lido da área de transferência.');
    console.log('   (Se preferir, pode colar o endereço antes de apertar Enter.)');
    console.log('   Seja rápido: o código vale só 3 minutos.\n');

    let texto = (await rl.question('Aperte ENTER depois de copiar o endereço: ')).trim();
    if (!texto.includes('code=')) texto = lerAreaDeTransferencia();
    if (!texto.includes('code=')) {
      throw new Error('Não achei um endereço com "code=" na área de transferência. Copie a barra de endereço do navegador e tente de novo.');
    }
    const url = new URL(texto.split(/\s+/).find((t) => t.includes('code=')));
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

// Lê o que foi copiado (Ctrl+C). Evita ter que colar na janela do Prompt.
function lerAreaDeTransferencia() {
  try {
    if (process.platform === 'win32') {
      return execFileSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard'], { encoding: 'utf8' }).trim();
    }
    if (process.platform === 'darwin') return execFileSync('pbpaste', { encoding: 'utf8' }).trim();
  } catch {
    // sem acesso à área de transferência: segue para a mensagem de erro
  }
  return '';
}

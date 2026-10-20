// Teste da ligação com a planilha de SKUs. Só lê: pergunta o próximo SKU.
// Uso: npm run testar-planilha
import { proximoSkuDaPlanilha } from '../src/planilha.js';
import { ARQUIVO_ENV } from '../src/config.js';

const url = process.env.PLANILHA_URL ?? '';
console.log(`Arquivo de configuração: ${ARQUIVO_ENV}`);
console.log(`PLANILHA_URL: ${url ? `${url.slice(0, 40)}...${url.slice(-12)}` : '(vazio)'}`);
console.log(`PLANILHA_TOKEN: ${process.env.PLANILHA_TOKEN ? `preenchido (${process.env.PLANILHA_TOKEN.length} caracteres)` : '(vazio)'}`);
if (url && !url.endsWith('/exec')) console.log('⚠ O link deveria terminar em /exec.');

const r = await proximoSkuDaPlanilha();
if (r.sku) console.log(`\n✅ Planilha OK. Próximo SKU: ${r.sku}`);
else {
  console.log(`\n❌ ${r.erro}`);
  process.exitCode = 1;
}

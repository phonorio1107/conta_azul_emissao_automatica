// Teste SÓ DE LEITURA: mostra qual empresa está conectada a esta unidade.
// Não cria nem altera nada.
// Uso: npm run testar-conexao -- vinhedo
import { validarUnidade } from '../src/config.js';
import { contaConectada } from '../src/contaazul/cliente.js';

try {
  const unidade = validarUnidade((process.argv[2] ?? '').toLowerCase());
  const empresa = await contaConectada(unidade);
  console.log(`Conexão OK. A unidade "${unidade}" está ligada a:`);
  console.log(`  Razão social: ${empresa?.razao_social ?? '—'}`);
  console.log(`  Nome fantasia: ${empresa?.nome_fantasia ?? '—'}`);
  console.log(`  CNPJ: ${empresa?.documento ?? '—'}`);
  console.log('Confira se é a empresa certa antes de seguir.');
} catch (erro) {
  console.error(`Erro: ${erro.message}`);
  process.exitCode = 1;
}

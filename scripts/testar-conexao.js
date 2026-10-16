// Teste SÓ DE LEITURA: lista as últimas vendas da unidade. Não cria nem altera nada.
// Uso: npm run testar-conexao -- vinhedo
import { validarUnidade } from '../src/config.js';
import { buscarVendas } from '../src/contaazul/cliente.js';

try {
  const unidade = validarUnidade((process.argv[2] ?? '').toLowerCase());
  const resposta = await buscarVendas(unidade);
  const vendas = Array.isArray(resposta) ? resposta : resposta?.itens ?? [];
  console.log(`Conexão OK com o Conta Azul de ${unidade}. Últimas vendas encontradas: ${vendas.length}`);
  console.log(JSON.stringify(vendas.slice(0, 3), null, 2));
} catch (erro) {
  console.error(`Erro: ${erro.message}`);
  process.exitCode = 1;
}

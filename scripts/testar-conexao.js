// Teste SÓ DE LEITURA: lista as categorias financeiras da unidade (o mesmo teste
// que o portal do Conta Azul sugere). Não cria nem altera nada.
// Uso: npm run testar-conexao -- vinhedo
import { validarUnidade } from '../src/config.js';
import { chamar } from '../src/contaazul/cliente.js';
import { CAMINHOS } from '../src/contaazul/endpoints.js';

try {
  const unidade = validarUnidade((process.argv[2] ?? '').toLowerCase());
  const resposta = await chamar(unidade, 'GET', CAMINHOS.categorias);
  const categorias = Array.isArray(resposta) ? resposta : resposta?.itens ?? [];
  console.log(`Conexão OK com o Conta Azul de ${unidade}. Categorias encontradas: ${categorias.length}`);
  console.log(JSON.stringify(categorias.slice(0, 3), null, 2));
} catch (erro) {
  console.error(`Erro: ${erro.message}`);
  process.exitCode = 1;
}

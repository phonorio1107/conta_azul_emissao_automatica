# conta_azul_emissao_automatica

Emissão automatizada de NFs de produto e serviço no ERP Conta Azul, a partir das OS do HTS. Vale para as unidades próprias: Vinhedo e Barueri (Kaizen).

**Cenário B:** o sistema lê as OS fechadas, confere tudo e cria a **venda** no Conta Azul pela API oficial. A NF é emitida a partir dessa venda com um clique.

- **Passo a passo de instalação e uso:** [docs/GUIA.md](docs/GUIA.md)
- **O que pedir ao time do HTS:** [docs/PEDIDO-LUCAS.md](docs/PEDIDO-LUCAS.md)

## Comandos

| Comando | O que faz |
|---|---|
| `npm run painel` | Abre o painel em http://localhost:3000 |
| `npm run autorizar -- vinhedo` | Conecta a unidade ao Conta Azul (alternativa ao painel) |
| `npm run testar-conexao -- vinhedo` | Teste só de leitura da API |
| `npm run exportar-catalogo -- vinhedo` | Baixa produtos e serviços para montar o mapeamento |
| `npm test` | Testes automáticos (não acessam o Conta Azul) |

## Estrutura

```
src/
  config.js            unidades e variáveis do .env
  armazenamento.js     estado das OS em dados/*.json
  hts/importarCsv.js   entrada das OS (CSV); futuro: API/banco do HTS
  mapeamento.js        código HTS -> id Conta Azul
  validacao.js         conferência da OS antes do envio
  processamento.js     fluxo: importar, validar, aprovar, criar venda
  contaazul/           OAuth, chamadas à API, montagem da venda
  painel/              painel web local
scripts/               autorizar, testar conexão, exportar catálogo
exemplos/              modelos de CSV
```

## Situação

- [x] OAuth 2.0 por unidade, com renovação automática do token
- [x] Importação de OS por CSV, validação e painel com aprovação manual
- [x] Modo simulação (`ENVIO_REAL=false`, padrão)
- [ ] Confirmar no OpenAPI do portal os campos de `POST /v1/venda` e os caminhos marcados "A CONFIRMAR" em `src/contaazul/endpoints.js`
- [ ] Leitura direta do HTS (depende do Lucas)
- [ ] Marcar "NF emitida" automaticamente, consultando as notas pela venda na API

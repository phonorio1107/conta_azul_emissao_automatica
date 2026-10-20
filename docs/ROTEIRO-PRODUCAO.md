# Roteiro até a produção

Na ordem. Cada etapa só começa quando a anterior estiver ✔.

## Etapa 1 – Primeira venda na conta de teste

- [ ] Atualizar o projeto no computador (baixar o ZIP e extrair por cima, "Substituir")
- [ ] `npm install` e `npm run configurar` (conferir se o Client ID e o Secret estão lá)
- [ ] Abrir o painel e conferir se aparecem os botões **Enviar PDFs das OS** e **Mapear serviços**
- [ ] **Mapear serviços** e, na OS, buscar e escolher o SKU de cada peça (conta de teste)
- [ ] Cadastrar na conta de teste um cliente com o **mesmo nome** do cliente da OS
- [ ] **Ver o que seria enviado**: conferir cliente, itens, valores e total
- [ ] `npm run configurar` → `ENVIO_REAL=true`, reiniciar o painel e clicar em **Aprovar e criar venda**
- [ ] Conferir a venda no Conta Azul da conta de teste (cliente, itens, valores, total, pagamento)
- [ ] Tentar emitir a NF a partir dela (na conta de teste pode não ser possível; anotar o que acontecer)
- [ ] Voltar `ENVIO_REAL=false`

- [ ] (Na fase real) Importar a planilha de SKUs no **Catálogo de peças** do painel (CSV da aba Inventário)

## Etapa 2 – Combinar as regras com a Sol

- [ ] Enviar a mensagem abaixo e anotar as respostas
- [ ] Ajustar `SITUACAO_VENDA` e `FORMA_PAGAMENTO_PADRAO` no `.env` conforme combinado

> Oi, Sol! Estou automatizando o lançamento das vendas das OS no Conta Azul (Vinhedo e Barueri). O sistema
> cria a venda a partir do PDF da OS e eu emito a NF por ela, como hoje. Preciso confirmar com você 3 pontos:
>
> 1. A venda pode nascer como **Aprovada**? Isso já gera o contas a receber.
> 2. O pagamento vai como **à vista, uma parcela, vencendo na data do faturamento da OS**. Está certo, ou
>    vocês lançam de outro jeito (parcelado, cartão com prazo etc.)?
> 3. O PDF da OS não traz a **forma de pagamento**. Posso usar uma padrão (qual?) ou prefere que eu
>    escolha OS por OS?
> 4. Quando eu cadastrar uma **peça nova** pelo sistema, quais são os padrões de **origem** (ex.: 0 – Nacional),
>    **tipo** (ex.: Mercadoria para revenda) e **unidade** que devo usar? O NCM eu pego de cada peça.
>
> Nada muda na parte fiscal: CFOP, natureza e impostos continuam vindo do cadastro dos produtos no Conta Azul.

## Etapa 3 – App de produção

- [ ] No portal do desenvolvedor: **Criar uma aplicação → Produção**
- [ ] URL de redirecionamento: `http://localhost:3000/oauth/retorno`
- [ ] Guardar o Client ID e o Client Secret novos no Bloco de Notas (nunca em chat ou print)
- [ ] Se o portal pedir aprovação/revisão do Conta Azul, anotar o prazo e o que pediram

## Etapa 4 – Conectar Vinhedo e Barueri

- [ ] Confirmar: Vinhedo e Barueri são **contas separadas** no Conta Azul (logins/CNPJs diferentes)?
- [ ] `npm run configurar`: Client ID e Secret de produção, `CONTAAZUL_REDIRECT_URI=http://localhost:3000/oauth/retorno`, `ENVIO_REAL=false`
- [ ] Apagar tudo em `C:\Users\<seu usuário>\nf-conta-azul\dados` (eram os dados da conta de teste)
- [ ] Painel → **Conectar Vinhedo** (login de Vinhedo) e **Conectar Barueri** (login de Barueri)
- [ ] `npm run testar-conexao -- vinhedo` e `-- barueri`: conferir **razão social e CNPJ** de cada uma

## Etapa 5 – Mapeamento real

- [ ] Enviar ao painel os PDFs das OS faturadas de alguns dias (Vinhedo e Barueri)
- [ ] **Mapear serviços** com os serviços reais; nas OS, escolher o SKU das peças (**Usar sempre** nas que se repetem)
- [ ] Mandar ao Claude **um PDF de OS de Barueri** (dados do cliente tapados) para confirmar o layout

## Etapa 6 – Simulação com OS reais (alguns dias)

- [ ] Para cada OS do dia: **Ver o que seria enviado** e comparar com o que você lançaria à mão
- [ ] Anotar qualquer diferença e mandar ao Claude

## Etapa 7 – Ligar

- [ ] `npm run configurar` → `ENVIO_REAL=true`
- [ ] Primeira venda real de valor baixo: conferir no Conta Azul antes de emitir a NF
- [ ] A partir daí, o dia a dia do `docs/GUIA.md`

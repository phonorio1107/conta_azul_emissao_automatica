# Guia passo a passo

Como funciona (cenário B):

```
HTS (OS faturada) ──PDF──> Painel (confere e você aprova) ──API──> Conta Azul (venda criada)
                                                                     │
                                                 você clica "Emitir nota fiscal" na venda
```

O sistema **não emite a NF sozinho**. Ele cria a venda completa no Conta Azul. Você abre a venda, confere e clica em emitir.
CFOP, natureza de operação e tributação continuam vindo do cadastro de cada produto ou serviço no Conta Azul, como hoje.

São duas fases:

| Fase | App do portal | Conta usada | Para quê |
|---|---|---|---|
| **1. Testes** | Desenvolvimento | Conta de **teste**, com dados fictícios | Ver tudo funcionando sem risco |
| **2. Uso real** | Produção | Vinhedo e Barueri | O dia a dia |

---

# FASE 1 – Testes com a conta de teste

## 1. Preparar o computador (uma vez só)

1. Instale o **Node.js LTS** pelo site nodejs.org. Avance tudo no instalador.
2. No GitHub, abra o repositório, troque a branch para `claude/elegant-turing-0rn2mx`, clique em **Code → Download ZIP** e descompacte, por exemplo em `C:\nf-conta-azul`.
3. Abra a pasta no Explorer, digite `cmd` na barra de endereço e dê Enter. Abre o **Prompt de Comando** já dentro da pasta.
4. Rode:
   ```
   npm install
   ```

## 2. Criar o arquivo `.env`

1. Na pasta do projeto, copie o arquivo `.env.example` e renomeie a cópia para `.env`.
2. Abra o `.env` com o Bloco de Notas e preencha só estas duas linhas, com o que você guardou do portal:
   ```
   CONTAAZUL_CLIENT_ID=...
   CONTAAZUL_CLIENT_SECRET=...
   ```
3. Deixe o resto como está. A URL de redirecionamento já vem como `https://contaazul.com`, que é a fixa do app de desenvolvimento.

O `.env` fica só no seu computador e **nunca** vai para o GitHub.

## 3. Conectar a conta de teste

Na fase de testes, use a unidade `vinhedo` para representar a conta de teste.

**Opção A, com o refresh token (a mais fácil):**
```
npm run autorizar -- vinhedo --refresh-token
```
Cole o **refresh_token** que o portal mostrou e dê Enter.

**Opção B, com o login da conta de teste:**
```
npm run autorizar -- vinhedo
```
1. Abra o link que aparecer e entre com o **usuário e a senha da conta de teste**.
2. O navegador vai para `contaazul.com?code=...`.
3. Copie o endereço inteiro da barra (Ctrl+C), volte ao Prompt e só aperte **Enter**: o endereço é lido da área de transferência. **Seja rápido: o código vale só 3 minutos.**

## 4. Testar a conexão (só leitura)

```
npm run testar-conexao -- vinhedo
```

Deve aparecer "Conexão OK" com o nome e o CNPJ da empresa da conta de teste.

## 5. Abrir o painel e enviar uma OS

1. Rode:
   ```
   npm run painel
   ```
   e deixe essa janela aberta.
2. Abra **http://localhost:3000** no navegador.
3. Clique em **Enviar PDFs das OS** e escolha o PDF (ou os PDFs) baixado do HTS.

## 6. Mapear os itens (uma vez por item)

Na primeira vez, as OS aparecem **Com problema**, porque o sistema ainda não sabe a que produto ou serviço do Conta Azul cada item corresponde.

1. Clique em **Mapear itens**.
2. Para cada item, escolha na lista o produto ou serviço do Conta Azul. Quando o nome é igual, ele já vem selecionado.
3. **Fator:** deixe `1`, a não ser que a unidade seja diferente (por exemplo, a OS em "pacote" e o Conta Azul em "unidade").
4. Clique em **Salvar mapeamento**. As OS são conferidas de novo na hora.

Cadastrou um produto ou serviço novo no Conta Azul? Use **Atualizar a lista do Conta Azul**, no fim da mesma tela.

## 7. Conferir em simulação

1. Na conta de teste, o cliente da OS precisa existir com o **mesmo nome ou e-mail**. Se não existir, cadastre um igual no Conta Azul da conta de teste.
2. No painel, abra uma OS **Pronta para aprovar** e clique em **Ver o que seria enviado**.

## 8. Criar uma venda de verdade na conta de teste

1. No `.env`, troque `ENVIO_REAL=false` para `ENVIO_REAL=true`.
2. Feche o painel (Ctrl+C no Prompt) e rode `npm run painel` de novo.
3. Clique em **Aprovar e criar venda** numa OS.
4. Entre no Conta Azul com o **login da conta de teste** e confira a venda. Experimente emitir a NF por ela.

Como é a conta de teste, pode errar à vontade.

---

# FASE 2 – Uso real (Vinhedo e Barueri)

Só depois que a fase 1 estiver redonda.

1. No portal, crie uma aplicação de **Produção**. Cadastre a URL de redirecionamento `http://localhost:3000/oauth/retorno`.
2. No `.env`:
   - troque o Client ID e o Client Secret pelos do app de produção;
   - troque `CONTAAZUL_REDIRECT_URI=http://localhost:3000/oauth/retorno`;
   - **volte para `ENVIO_REAL=false`**.
3. Apague o arquivo `dados/tokens.json` (é a conexão com a conta de teste).
4. Rode `npm run painel`, abra http://localhost:3000 e clique em **Conectar Vinhedo** (login de Vinhedo) e em **Conectar Barueri** (login de Barueri).
5. Rode `npm run testar-conexao -- vinhedo` e `-- barueri` e confira se cada um mostra o **CNPJ certo**.
6. Apague `dados/mapeamento.csv` e `dados/catalogo-*.json` (eram da conta de teste) e refaça o mapeamento pela tela **Mapear itens**.
7. Simule por alguns dias. Depois, `ENVIO_REAL=true`.

---

## 9. Configurações do `.env`

| Linha | O que faz |
|---|---|
| `ENVIO_REAL` | `false` = só simula; `true` = cria as vendas |
| `SITUACAO_VENDA` | `APROVADO` (padrão) ou `EM_ANDAMENTO`: como a venda nasce no Conta Azul |
| `FORMA_PAGAMENTO_PADRAO` | Usada quando a OS não traz a forma de pagamento. Ex.: `PIX_PAGAMENTO_INSTANTANEO`, `DINHEIRO`, `CARTAO_CREDITO`, `CARTAO_DEBITO`, `BOLETO_BANCARIO` |

> A venda vai com pagamento **à vista**, em **uma parcela** com vencimento na data da OS. Se Vinhedo e Barueri lançam pagamento de outro jeito, combine com a Sol antes da fase 2, porque isso gera o contas a receber.

## 10. Como o sistema lê as OS

**PDF do HTS (o normal):** basta soltar o PDF na pasta `entrada/`. O sistema lê unidade, número, data de faturamento, cliente (nome e e-mail), placa, serviços e peças.
- O PDF não traz CPF/CNPJ. O cliente é procurado no Conta Azul **pelo e-mail** e, se não achar, **pelo nome**. Só segue se achar exatamente um; na prévia você vê qual foi.
- Se a soma dos itens não bater com o TOTAL do PDF (por exemplo, por um desconto), a OS fica **Com problema** e não é enviada.

**Planilha CSV (alternativa):** uma linha por item da OS, no formato de `exemplos/os-exemplo.csv`:

| Coluna | Exemplo | Observação |
|---|---|---|
| unidade | vinhedo / barueri | |
| numero_os | 1001 | |
| data_fechamento | 15/10/2026 | |
| cliente_nome | Fulano de Tal | |
| cliente_documento | 123.456.789-09 | CPF ou CNPJ; o cliente precisa existir no Conta Azul |
| placa | ABC1D23 | |
| tipo | produto / servico | |
| codigo_hts | OLEO-5W30 | precisa estar no mapeamento |
| descricao | Óleo 5W30 | |
| quantidade | 4 | |
| valor_unitario | 62,90 | |
| desconto | 5,00 | em R$, por item; vai somado no total da venda |
| forma_pagamento | Pix | opcional: Pix, Dinheiro, Crédito, Débito, Boleto, Transferência |

## Dia a dia (depois da fase 2)

1. Baixar do HTS o PDF das OS faturadas e, no painel, clicar em **Enviar PDFs das OS**.
2. Resolver as OS **Com problema**: item novo vai em **Mapear itens**; cliente não encontrado se cadastra no Conta Azul.
3. Em cada OS **Pronta para aprovar**, conferir e clicar em **Aprovar e criar venda**.
4. No Conta Azul, abrir a venda e clicar em **Emitir nota fiscal**.
5. Voltar ao painel e marcar **NF emitida**.

### Se uma OS ficar "Enviando…"

A internet ou o Conta Azul caiu no meio do envio. Procure a venda no Conta Azul (nas observações aparece "OS nº ... (HTS)"):
- **se ela existe:** clique em **A venda existe no Conta Azul**;
- **se não existe:** clique em **Reabrir** e envie de novo.

## Segurança

- O painel só abre no próprio computador (`localhost`), porque não tem login.
- `.env` (senhas) e `dados/` (tokens e OS) nunca vão para o GitHub.
- Nunca mande Client Secret, tokens ou senhas em chat ou print.

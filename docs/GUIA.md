# Guia passo a passo

Como funciona (cenário B):

```
HTS (OS fechada) ──CSV──> Painel (confere e você aprova) ──API──> Conta Azul (venda criada)
                                                                     │
                                                 você clica "Emitir nota fiscal" na venda
```

O sistema **não emite a NF sozinho**. Ele cria a venda completa no Conta Azul. Você abre a venda, confere e clica em emitir.
CFOP, natureza de operação e tributação continuam vindo do cadastro de cada produto ou serviço no Conta Azul, como hoje.

---

## 1. Preparar o computador (uma vez só)

1. Instale o **Node.js LTS** pelo site nodejs.org (avance tudo no instalador).
2. Baixe este projeto: no GitHub, clique em **Code → Download ZIP** e descompacte numa pasta, por exemplo `C:\nf-conta-azul`.
3. Abra o **Prompt de Comando** dentro dessa pasta (no Explorer, digite `cmd` na barra de endereço e dê Enter).
4. Rode:
   ```
   npm install
   ```

## 2. Configurar o aplicativo no Portal do Desenvolvedor do Conta Azul

No aplicativo que você já criou no portal:

1. Copie o **Client ID** e o **Client Secret**. O Client Secret é uma senha: não mande por WhatsApp nem cole em planilha.
2. Em **URL de redirecionamento** (redirect URI), cadastre:
   ```
   http://localhost:3000/oauth/retorno
   ```
   Se o portal não aceitar `http://localhost`, cadastre um endereço `https` qualquer, por exemplo `https://www.hightorque.com.br`, e use o plano B do passo 4.
3. **Baixe o OpenAPI** (arquivo `.json` ou `.yaml`) das seções **Vendas** e **Pessoas** e, se houver, **Produtos** e **Serviços**. Me envie esses arquivos ou coloque-os na pasta `docs/openapi/`. Com eles eu confirmo os nomes exatos dos campos antes de ligar o envio real. Esses arquivos não têm nada secreto.

## 3. Criar o arquivo `.env`

1. Copie o arquivo `.env.example` e renomeie a cópia para `.env`.
2. Abra o `.env` no Bloco de Notas e preencha:
   ```
   CONTAAZUL_CLIENT_ID=o que você copiou
   CONTAAZUL_CLIENT_SECRET=o que você copiou
   CONTAAZUL_REDIRECT_URI=a mesma URL cadastrada no portal
   ENVIO_REAL=false
   ```

O `.env` fica só no seu computador e **nunca** vai para o GitHub (já está bloqueado no `.gitignore`).

## 4. Conectar Vinhedo e Barueri

**Plano A (pelo painel):**

1. Rode `npm run painel` e abra http://localhost:3000 no navegador.
2. Clique em **Conectar Vinhedo ao Conta Azul** e entre com o login do Conta Azul **de Vinhedo**.
3. Faça o mesmo com **Barueri**, entrando com o login **de Barueri**.

**Plano B (se a URL de redirecionamento não for localhost):**

```
npm run autorizar -- vinhedo
```

Abra o link que aparecer e autorize. O navegador vai cair em outra página (pode até dar erro, tudo bem). Copie o endereço inteiro da barra do navegador e cole no Prompt. Repita com `barueri`.

> Se Vinhedo e Barueri forem a **mesma** conta no Conta Azul, me avise: aí o sistema precisa separar as vendas de outro jeito.

## 5. Testar (só leitura, não cria nada)

```
npm run testar-conexao -- vinhedo
npm run testar-conexao -- barueri
```

Deve aparecer "Conexão OK" com algumas vendas recentes.

## 6. Montar o mapeamento HTS → Conta Azul

O Conta Azul identifica cada produto e serviço por um código interno (id). O sistema precisa saber qual id corresponde a cada código do HTS.

1. Baixe o catálogo de cada unidade:
   ```
   npm run exportar-catalogo -- vinhedo
   npm run exportar-catalogo -- barueri
   ```
   Isso gera `dados/catalogo-vinhedo.csv` e `dados/catalogo-barueri.csv`.
2. Crie `dados/mapeamento.csv` no mesmo formato de `exemplos/mapeamento-exemplo.csv`:

   | unidade | tipo | codigo_hts | id_conta_azul | fator_conversao | observacao |
   |---|---|---|---|---|---|
   | vinhedo | produto | OLEO-5W30 | (id do catálogo) | 1 | |

   O `fator_conversao` indica quantas unidades do Conta Azul valem 1 unidade do HTS. Deixe `1` quando forem iguais. É a mesma ideia da vela que chega em pacote e entra como 4 unidades.

Não precisa mapear tudo de uma vez: o painel avisa qual item da OS está sem correspondente. Você completa o mapeamento e clica em **Revalidar**.

## 7. Trazer as OS do HTS

Até o Lucas liberar algo melhor (veja `docs/PEDIDO-LUCAS.md`), as OS entram por planilha:

1. Gere um CSV no formato de `exemplos/os-exemplo.csv`, com uma linha por item da OS.
2. Salve na pasta `entrada/`.
3. No painel, clique em **Importar OS da pasta "entrada"**. O arquivo lido vai para `entrada/processados/`.

Importar o mesmo arquivo de novo não duplica nada: OS já enviadas são ignoradas, e as outras são atualizadas.

## 8. Período de simulação (`ENVIO_REAL=false`)

Para cada OS **Pronta para aprovar**, clique em **Ver o que seria enviado**. O painel consulta o cliente no Conta Azul (só leitura) e mostra a venda montada.

Confira valores, quantidades e itens contra a OS em papel. Os erros mais comuns aparecem aqui:
- cliente não cadastrado no Conta Azul;
- item sem mapeamento;
- CPF/CNPJ faltando na OS.

## 9. Ligar o envio real

Só depois de **(a)** eu confirmar os campos com o OpenAPI (passo 2.3) e **(b)** você ficar satisfeito com as simulações:

1. No `.env`, troque para `ENVIO_REAL=true` e reinicie o painel.
2. Faça a primeira OS real de valor baixo e confira a venda no Conta Azul antes de emitir a NF.

## Dia a dia

1. Exportar as OS fechadas do HTS para a pasta `entrada/` e clicar em **Importar**.
2. Resolver as OS **Com problema** (cadastro de cliente, mapeamento).
3. Para cada OS **Pronta para aprovar**: conferir e clicar em **Aprovar e criar venda**.
4. No Conta Azul, abrir a venda e clicar em **Emitir nota fiscal**.
5. Voltar ao painel e marcar **NF emitida**.

A lista **Venda criada – emitir NF** mostra o que ainda falta emitir. Ela ajuda também na conferência quinzenal de OS sem faturar.

### Se uma OS ficar "Enviando…"

Isso quer dizer que a internet ou o Conta Azul caiu no meio do envio, e não dá para saber se a venda foi criada. Procure a venda no Conta Azul (o campo de observações traz "OS nº ... (HTS)"):
- **Se existe:** clique em **A venda existe no Conta Azul**.
- **Se não existe:** clique em **Reabrir** e envie de novo.

## Segurança

- O painel só abre no próprio computador (`localhost`), porque não tem login.
- `.env` (senhas) e `dados/` (tokens e OS) nunca vão para o GitHub.
- Se o Client Secret vazar, gere outro no portal e atualize o `.env`.

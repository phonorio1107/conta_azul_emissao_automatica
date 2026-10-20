# Ligar a planilha de SKUs ao painel (uma vez só, ~5 minutos)

Com isso, o botão **Cadastrar produto** do painel cria o produto no Conta Azul **e** adiciona a
linha na aba **Inventário** da sua planilha, com o próximo SKU da sequência (HT....).
A coluna **Nome Completo** continua sendo a sua fórmula: o script copia a fórmula da linha de cima.

## 1. Colar o script na planilha

1. Abra a planilha de SKUs no Google Sheets.
2. Menu **Extensões → Apps Script**. Abre uma aba nova com um editor de código.
3. Apague tudo o que estiver no editor.
4. Abra o arquivo [`apps-script.gs`](planilha/apps-script.gs) (no GitHub, botão **Raw**), copie **tudo** e cole no editor.
5. Na linha `const TOKEN = 'TROQUE-POR-UMA-SENHA';`, troque o texto entre aspas por uma senha só sua
   (ex.: `const TOKEN = 'ht-vinhedo-2026-xk91';`). Guarde essa senha.
6. Clique no ícone de **disquete** (Salvar).

## 2. Publicar o script

1. No canto superior direito, clique em **Implantar → Nova implantação**.
2. Na engrenagem ao lado de "Selecionar tipo", escolha **App da Web**.
3. Preencha:
   - **Executar como:** Eu (seu e-mail)
   - **Quem pode acessar:** Qualquer pessoa
4. Clique em **Implantar**. O Google pede para **autorizar o acesso**: escolha sua conta → "Avançado" →
   "Acessar (não seguro)" → **Permitir**. (O aviso aparece porque o script é seu e não foi publicado
   na loja do Google; é normal.)
5. Copie o **URL do app da Web** (termina em `/exec`).

> "Qualquer pessoa" significa que o link aceita pedidos de fora, mas o script só grava quando o
> pedido traz a sua senha (TOKEN). Não compartilhe o link nem a senha.

## 3. Colocar no painel

1. Na pasta do projeto, rode `npm run configurar`.
2. No `.env`, preencha:
   ```
   PLANILHA_URL=https://script.google.com/macros/s/....../exec
   PLANILHA_TOKEN=a-mesma-senha-do-script
   ```
3. Salve, feche e reinicie o painel (`Ctrl+C` e `npm run painel`).

## 4. Testar

1. No painel, clique em **Cadastrar produto**. O campo **SKU** já deve vir com o próximo número
   (ex.: HT0807) — sinal de que o painel conversou com a planilha.
2. Na conta de **teste**, cadastre um produto qualquer e confira a nova linha na planilha.
   (Na conta de teste, apague depois a linha da planilha: o produto não existe no Conta Azul real.)

## Se algo der errado

- **"A planilha recusou: Senha (token) inválida"**: o `PLANILHA_TOKEN` do `.env` não é igual ao `TOKEN` do script.
- **"Aba Inventário não encontrada"**: o nome da aba mudou; ajuste `const ABA = 'Inventário';` no script.
- **Planilha fora do ar**: o produto é criado no Conta Azul mesmo assim e fica guardado. Na tela
  inicial aparece **Enviar para a planilha agora**.
- **Mudou o script?** É preciso **Implantar → Gerenciar implantações → editar (lápis) → Versão: Nova versão → Implantar**.
  O link continua o mesmo.

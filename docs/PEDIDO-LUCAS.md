# Pedido para o Lucas (HTS)

> **Opcional.** O sistema já lê o PDF da OS que o HTS gera, então não depende mais do Lucas.
> O único pedido que ainda ajudaria é incluir o **CPF/CNPJ do cliente no PDF da OS**: assim
> o cliente é achado no Conta Azul pelo documento, em vez de por e-mail ou nome.

Mensagem curta e objetiva para mandar a ele:

---

Oi, Lucas! Estou automatizando as NFs de Vinhedo e Barueri pelo Conta Azul. Preciso só **ler** as OS fechadas do HTS, sem alterar nada lá.

Qual destas opções é mais fácil para você?

1. **Exportação em CSV** das OS fechadas num período, com uma linha por item.
2. **Um endereço (API) só de leitura**, por exemplo `GET /os?unidade=vinhedo&fechadas_desde=2026-10-01`, com um token, devolvendo JSON.
3. **Um usuário só de leitura** no banco de dados do HTS.

Campos de que preciso:

| Campo | Exemplo |
|---|---|
| unidade | vinhedo / barueri |
| numero_os | 1001 |
| data_fechamento | 15/10/2026 |
| cliente_nome | Fulano de Tal |
| cliente_documento (CPF/CNPJ) | 123.456.789-09 |
| placa | ABC1D23 |
| tipo do item | produto / servico |
| codigo_hts do item | OLEO-5W30 |
| descricao do item | Óleo 5W30 |
| quantidade | 4 |
| valor_unitario | 62,90 |
| desconto do item (R$) | 0 |

Se der, também: status da OS (para pegar só as fechadas) e forma de pagamento.

---

## Observações para o Pedro

- A **opção 1** já funciona hoje com o painel, sem mudar nada no código.
- As **opções 2 e 3** pedem só um "leitor" novo em `src/hts/`, devolvendo as OS no mesmo formato de `lerOsDeCsv()`. O resto do sistema não muda.
- Enquanto ele não responde, dá para montar o CSV à mão a partir de algumas OS, para testar o painel e o mapeamento.

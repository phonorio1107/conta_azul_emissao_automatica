// Pedaços de HTML do painel. Sem framework: páginas simples geradas no servidor.

export function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function pagina(titulo, corpo, { envioReal, aviso } = {}) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)} · NFs Conta Azul</title>
<style>
  :root { --vermelho:#c8102e; --preto:#111; --cinza:#f3f3f3; --borda:#ddd; --texto:#222; }
  * { box-sizing:border-box; }
  body { margin:0; font:15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color:var(--texto); background:#fff; }
  header { background:var(--preto); color:#fff; padding:12px 20px; display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
  header a { color:#fff; text-decoration:none; font-weight:700; }
  header .marca { border-left:4px solid var(--vermelho); padding-left:10px; }
  main { padding:20px; max-width:1200px; margin:0 auto; }
  .faixa { padding:10px 20px; font-weight:600; }
  .simulacao { background:#fff4cc; color:#6b5300; }
  .real { background:#e6f4ea; color:#14532d; }
  .aviso { background:var(--cinza); border-left:4px solid var(--vermelho); padding:10px 14px; margin-bottom:16px; white-space:pre-line; }
  table { width:100%; border-collapse:collapse; margin:12px 0; }
  th, td { text-align:left; padding:8px; border-bottom:1px solid var(--borda); vertical-align:top; }
  th { background:var(--cinza); font-size:13px; }
  td.num { text-align:right; white-space:nowrap; }
  .etiqueta { display:inline-block; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:600; background:#eee; }
  .pendente { background:#e0ecff; color:#1d3f8a; }
  .com_erro { background:#fde2e2; color:#8a1d1d; }
  .enviando { background:#fff4cc; color:#6b5300; }
  .venda_criada { background:#ffe8cc; color:#7a3e00; }
  .nf_emitida { background:#e6f4ea; color:#14532d; }
  .ignorada { background:#eee; color:#555; }
  button, .botao { background:var(--vermelho); color:#fff; border:0; border-radius:6px; padding:8px 14px; font-weight:600; cursor:pointer; text-decoration:none; display:inline-block; font-size:14px; }
  button.secundario, .botao.secundario { background:#fff; color:var(--preto); border:1px solid var(--borda); }
  button:disabled { opacity:.5; cursor:not-allowed; }
  form.inline { display:inline; }
  .acoes { display:flex; gap:8px; flex-wrap:wrap; margin:12px 0; }
  .filtros a { margin-right:10px; }
  button.link { background:none; color:#1d4ed8; border:0; padding:0; text-decoration:underline; font-weight:400; }
  .problema { color:#8a1d1d; }
  form.busca { display:flex; gap:6px; flex-wrap:wrap; }
  table.resultados { margin:4px 0; background:#fafafa; }
  details summary { cursor:pointer; color:#1d4ed8; font-size:13px; }
  form.formulario fieldset { border:1px solid var(--borda); border-radius:8px; margin:12px 0; display:flex; flex-wrap:wrap; gap:12px; }
  form.formulario label { font-size:13px; }
  form.formulario input, form.formulario select { font-size:14px; padding:4px; }
  pre { background:var(--cinza); padding:12px; overflow:auto; border-radius:6px; }
  ul.problemas { color:#8a1d1d; }
  .cartoes { display:flex; gap:12px; flex-wrap:wrap; }
  .cartao { border:1px solid var(--borda); border-radius:8px; padding:10px 14px; min-width:150px; }
  .cartao b { display:block; font-size:22px; }
  @media (max-width:700px) { .esconder-celular { display:none; } main { padding:12px; } }
</style>
</head>
<body>
<header><span class="marca"><a href="/">High Torque · NFs pelo Conta Azul</a></span></header>
<div class="faixa ${envioReal ? 'real' : 'simulacao'}">${
    envioReal
      ? 'Envio REAL ligado: aprovar cria a venda no Conta Azul.'
      : 'Modo SIMULAÇÃO: nada é criado no Conta Azul. Use "Ver o que seria enviado" para conferir.'
  }</div>
<main>
${aviso ? `<div class="aviso">${esc(aviso)}</div>` : ''}
${corpo}
</main>
</body>
</html>`;
}

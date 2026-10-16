// Converte números e datas no formato brasileiro das planilhas.

// "1.234,56" -> 1234.56 | "1234.56" -> 1234.56 | "R$ 10,00" -> 10
export function numeroBr(texto) {
  let t = String(texto ?? '').replace(/[R$\s]/g, '');
  if (t === '') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
}

// "16/10/2026" -> "2026-10-16" | "2026-10-16" fica igual
export function dataBr(texto) {
  const t = String(texto ?? '').trim();
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return '';
}

export function soDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

export function reais(valor) {
  return Number(valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

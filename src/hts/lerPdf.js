// Lê o PDF da OS gerado pelo HTS ("Ordem de Serviço #NNNN") e devolve a OS no
// mesmo formato de lerOsDeCsv(). O PDF não traz CPF/CNPJ nem código dos itens:
// o cliente é procurado no Conta Azul por e-mail/nome, e os itens são mapeados
// pela descrição.
import { numeroBr } from '../numeros.js';

const MESES = {
  janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

// A partir desta posição horizontal ficam as colunas Valor, Qtd e Total.
const INICIO_COLUNAS_VALORES = 380;

export async function lerOsDePdf(conteudo) {
  return interpretarLinhas(await extrairLinhas(conteudo));
}

// Agrupa os pedaços de texto do PDF em linhas (mesma altura), da esquerda para a direita.
export async function extrairLinhas(conteudo) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const documento = await pdfjs.getDocument({ data: new Uint8Array(conteudo), verbosity: 0 }).promise;
  const linhas = [];
  for (let n = 1; n <= documento.numPages; n++) {
    const pagina = await documento.getPage(n);
    const { items } = await pagina.getTextContent();
    const daPagina = [];
    for (const item of items) {
      const texto = item.str.trim();
      if (!texto) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      let linha = daPagina.find((l) => Math.abs(l.y - y) < 2);
      if (!linha) daPagina.push((linha = { y, celulas: [] }));
      linha.celulas.push({ x, texto });
    }
    daPagina.sort((a, b) => b.y - a.y);
    for (const l of daPagina) linhas.push(l.celulas.sort((a, b) => a.x - b.x));
  }
  return linhas;
}

export function interpretarLinhas(linhas) {
  const textoDa = (linha) => linha.map((c) => c.texto).join(' ');
  const comeca = (linha, rotulo) => linha[0]?.texto === rotulo;
  const depoisDe = (linha, rotulo) => {
    const i = linha.findIndex((c) => c.texto === rotulo);
    return i >= 0 ? linha[i + 1]?.texto ?? '' : '';
  };

  const problemas = [];
  const os = {
    unidade: identificarUnidade(textoDa(linhas[0] ?? [])),
    numero: '',
    dataFechamento: '',
    cliente: { nome: '', email: '', documento: '' },
    placa: '',
    formaPagamento: '',
    itens: [],
  };
  let totalImpresso = null;
  let secao = null; // 'servico' | 'produto' | null

  for (const linha of linhas) {
    const texto = textoDa(linha);

    if (comeca(linha, 'Cliente:')) os.cliente.nome = linha.slice(1).map((c) => c.texto).join(' ');
    if (linha.some((c) => c.texto === 'E-mail:') && comeca(linha, 'Telefones:')) {
      os.cliente.email = depoisDe(linha, 'E-mail:').toLowerCase();
    }
    if (comeca(linha, 'Veículo:')) os.placa = (linha[1]?.texto ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

    const cabecalhoOs = texto.match(/Ordem de Servi[çc]o #(\d+)/i);
    if (cabecalhoOs) {
      os.numero = cabecalhoOs[1];
      os.dataFechamento = dataPorExtenso(texto);
    }

    if (/desconto/i.test(texto) && secao !== null) {
      problemas.push('O PDF menciona desconto. Confira esta OS manualmente.');
    }

    // Início das seções de itens: "Serviços | Valor | Qtd | Total" e "Peças | ...".
    if (linha.some((c) => c.texto === 'Qtd') && linha.some((c) => c.texto === 'Total')) {
      if (/^servi/i.test(linha[0].texto)) secao = 'servico';
      else if (/^pe[çc]as/i.test(linha[0].texto)) secao = 'produto';
      else secao = null;
      continue;
    }

    if (comeca(linha, 'TOTAL')) {
      totalImpresso = numeroBr(linha[linha.length - 1].texto);
      secao = null;
      continue;
    }

    if (!secao) continue;
    const descricao = linha.filter((c) => c.x < INICIO_COLUNAS_VALORES).map((c) => c.texto).join(' ');
    const valores = linha.filter((c) => c.x >= INICIO_COLUNAS_VALORES).map((c) => c.texto);

    if (descricao && valores.length === 3) {
      const [valorUnitario, quantidade, totalLinha] = valores.map(numeroBr);
      os.itens.push({ tipo: secao, descricao, valorUnitario, quantidade, desconto: 0, totalLinha });
    } else if (descricao && valores.length === 0 && os.itens.length) {
      // Descrição que continua na linha de baixo.
      const ultimo = os.itens[os.itens.length - 1];
      if (ultimo.tipo === secao) ultimo.descricao += ` ${descricao}`;
    } else if (!descricao && valores.length === 1) {
      secao = null; // subtotal da seção
    }
  }

  for (const item of os.itens) {
    item.codigoHts = chaveDescricao(item.descricao);
    if (Math.abs(item.quantidade * item.valorUnitario - item.totalLinha) > 0.01) {
      problemas.push(`Item "${item.descricao}": valor × quantidade não bate com o total da linha (pode ter desconto).`);
    }
    delete item.totalLinha;
  }
  const soma = os.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);
  if (totalImpresso === null) problemas.push('Não achei o TOTAL da OS no PDF.');
  else if (Math.abs(soma - totalImpresso) > 0.01) {
    problemas.push(`A soma dos itens (${soma.toFixed(2)}) não bate com o TOTAL do PDF (${totalImpresso.toFixed(2)}).`);
  }

  os.chave = `${os.unidade}:${os.numero}`;
  os.problemasLeitura = problemas;
  return os;
}

function identificarUnidade(cabecalho) {
  const t = semAcento(cabecalho).toLowerCase();
  if (t.includes('vinhedo')) return 'vinhedo';
  if (t.includes('kaizen') || t.includes('barueri')) return 'barueri';
  return cabecalho;
}

// "Sexta-feira, 16 de Outubro de 2026, 08:06" -> "2026-10-16"
function dataPorExtenso(texto) {
  const m = semAcento(texto).match(/(\d{1,2}) de ([a-z]+) de (\d{4})/i);
  if (!m || !MESES[m[2].toLowerCase()]) return '';
  return `${m[3]}-${MESES[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
}

// Chave do item para o mapeamento: a descrição sem o que vem entre parênteses.
// "Revisão Preço Fixo HT BASIC (SERVIÇOS: ...)" -> "Revisão Preço Fixo HT BASIC"
export function chaveDescricao(descricao) {
  return descricao.split('(')[0].replace(/\s+/g, ' ').trim();
}

function semAcento(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

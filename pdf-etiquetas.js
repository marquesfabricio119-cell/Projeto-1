/* =========================================================
   PDF DAS ETIQUETAS — feito aqui dentro, sem biblioteca de fora
   =========================================================
   O celular ignora o tamanho de página que a página web pede, então a
   única forma de acertar a etiqueta é entregar um PDF, que carrega o
   tamanho da página dentro dele.

   Antes isso dependia de uma biblioteca baixada de outro servidor. Se ela
   não chegasse — rede da loja, servidor fora do ar —, não havia PDF e
   também não havia como eu conferir o resultado no desenvolvimento.
   Aqui o arquivo é montado do zero: linhas do código de barras são
   retângulos pretos e o texto usa as fontes que todo leitor de PDF já
   tem. Nada para baixar, e o resultado é verificável.
   ========================================================= */

/* Os 107 padrões do Code 128. Cada um traz as larguras, em módulos, de
   seis faixas alternadas começando por barra. O último, com 13 módulos,
   é a parada. */
const CODE128_PADROES = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
  '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
  '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
  '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
  '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
  '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112').split(' ');

const CODE128_INICIO_B = 104;
const CODE128_PARADA   = 106;

/* Traduz o texto para os símbolos do Code 128B e acrescenta o dígito
   verificador, que é o que faz o leitor confiar na leitura. */
function code128Simbolos(texto){
  const valores = [];
  for(let i = 0; i < texto.length; i++){
    const c = texto.charCodeAt(i);
    /* O 128B cobre de espaço a til. Fora disso o leitor não teria o que
       fazer com o símbolo, então a peça fica sem código em vez de sair
       com um código que ninguém lê. */
    if(c < 32 || c > 126) return null;
    valores.push(c - 32);
  }
  let soma = CODE128_INICIO_B;
  valores.forEach((v, i)=>{ soma += v * (i + 1); });
  return [CODE128_INICIO_B, ...valores, soma % 103, CODE128_PARADA];
}

/* Devolve as barras pretas como {x, largura}, em módulos, e quantos
   módulos o código ocupa por inteiro. */
function code128Barras(texto){
  const simbolos = code128Simbolos(texto);
  if(!simbolos) return null;
  const barras = [];
  let x = 0;
  simbolos.forEach(sim=>{
    const larguras = CODE128_PADROES[sim];
    for(let i = 0; i < larguras.length; i++){
      const w = Number(larguras[i]);
      if(i % 2 === 0) barras.push({ x, w });   // posição par é barra
      x += w;
    }
  });
  return { barras, modulos: x };
}

/* ---------- Montagem do arquivo ---------- */

const MM_EM_PONTOS = 72 / 25.4;

/* O PDF guarda o texto em bytes, não em caracteres. As fontes internas
   usam WinAnsi, que dá conta do português. */
function textoParaBytes(s){
  const bytes = [];
  for(let i = 0; i < s.length; i++){
    const c = s.charCodeAt(i);
    bytes.push(c < 256 ? c : 63);   // fora do WinAnsi vira "?"
  }
  return bytes;
}

function escaparTextoPdf(s){
  return String(s).replace(/[\\()]/g, m=>'\\' + m);
}

/* Largura aproximada do texto, para centralizar. A Helvetica tem largura
   variável; esta média basta para centralizar numa etiqueta — errar por
   um décimo de milímetro ninguém vê. */
function larguraAproximada(texto, tamanho, negrito){
  return texto.length * tamanho * (negrito ? 0.58 : 0.53);
}

function criarPdfEtiquetas(items, layout, nomeLoja, formatarPreco){
  const L = layout.w * MM_EM_PONTOS;
  const A = layout.h * MM_EM_PONTOS;
  const padMM = 1;
  const pad = padMM * MM_EM_PONTOS;
  const util = L - pad * 2;

  const baixa = layout.h <= 20;
  const ptLoja  = baixa ? 0 : 4.5;
  const ptNome  = baixa ? 4 : 4.5;
  const ptCodigo = layout.w <= 40 ? 4.5 : 5.5;
  const ptPreco = baixa ? 6 : 7;
  const linha = pt => pt * 1.25;

  const alturaTextos = (ptLoja ? linha(ptLoja) : 0) + linha(ptNome) + linha(ptCodigo) + linha(ptPreco);
  const alturaBarras = Math.max(4 * MM_EM_PONTOS, A - pad * 2 - alturaTextos);

  const conteudos = items.map(item=>{
    const partes = [];
    const centrar = (texto, tamanho, negrito, y)=>{
      const t = escaparTextoPdf(texto);
      const x = (L - larguraAproximada(texto, tamanho, negrito)) / 2;
      partes.push(`BT /${negrito ? 'F2' : 'F1'} ${tamanho} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${t}) Tj ET`);
    };

    /* O PDF conta a altura de baixo para cima; aqui descemos a partir do
       topo, que é como a etiqueta é lida. */
    let topo = A - pad;

    if(ptLoja){
      topo -= linha(ptLoja);
      centrar(String(nomeLoja).toUpperCase(), ptLoja, true, topo);
    }

    topo -= linha(ptNome);
    const nome = `${item.p.name} ${item.v.size}/${item.v.color}`.trim();
    /* Nome comprido encolhe a fonte em vez de vazar para fora da etiqueta. */
    let ptNomeReal = ptNome;
    while(larguraAproximada(nome, ptNomeReal, false) > util && ptNomeReal > 2.5) ptNomeReal -= 0.25;
    centrar(nome, ptNomeReal, false, topo);

    const codigo = code128Barras(item.v.barcode || '');
    if(codigo){
      const larguraModulo = util / codigo.modulos;
      const yBarras = topo - linha(ptCodigo) * 0.2 - alturaBarras;
      partes.push('0 0 0 rg');
      codigo.barras.forEach(b=>{
        const x = pad + b.x * larguraModulo;
        partes.push(`${x.toFixed(3)} ${yBarras.toFixed(2)} ${(b.w * larguraModulo).toFixed(3)} ${alturaBarras.toFixed(2)} re f`);
      });
      topo = yBarras;
    }

    topo -= linha(ptCodigo);
    centrar(item.v.barcode || '', ptCodigo, false, topo);

    topo -= linha(ptPreco);
    centrar(formatarPreco(item.p.price), ptPreco, true, Math.max(topo, pad));

    return partes.join('\n');
  });

  /* ---------- estrutura do arquivo ---------- */
  const objetos = [];
  const N = items.length;
  const idFonte1 = 3 + N * 2;
  const idFonte2 = idFonte1 + 1;

  objetos.push('<< /Type /Catalog /Pages 2 0 R >>');

  const idsPaginas = [];
  for(let i = 0; i < N; i++) idsPaginas.push(3 + i * 2);
  objetos.push(`<< /Type /Pages /Kids [${idsPaginas.map(id=>id + ' 0 R').join(' ')}] /Count ${N} >>`);

  for(let i = 0; i < N; i++){
    const idPagina = 3 + i * 2;
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${L.toFixed(2)} ${A.toFixed(2)}] ` +
      `/Resources << /Font << /F1 ${idFonte1} 0 R /F2 ${idFonte2} 0 R >> >> /Contents ${idPagina + 1} 0 R >>`);
    const fluxo = conteudos[i];
    objetos.push(`<< /Length ${textoParaBytes(fluxo).length} >>\nstream\n${fluxo}\nendstream`);
  }

  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const bytes = [];
  const escrever = s => textoParaBytes(s).forEach(b=>bytes.push(b));
  escrever('%PDF-1.4\n');

  const posicoes = [];
  objetos.forEach((corpo, i)=>{
    posicoes.push(bytes.length);
    escrever(`${i + 1} 0 obj\n${corpo}\nendobj\n`);
  });

  const inicioXref = bytes.length;
  escrever(`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`);
  posicoes.forEach(pos=>escrever(String(pos).padStart(10, '0') + ' 00000 n \n'));
  escrever(`trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);

  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

/* =========================================================
   PDF DAS ETIQUETAS — BROTHER QL-800
   =========================================================
   A QL-800 imprime a 300 dpi: cada ponto mede 1/300 de polegada
   (0,0847 mm). Uma barra só sai nítida se a largura dela for um número
   INTEIRO de pontos; se cair no meio de um ponto, a impressora arredonda
   sozinha e as barras saem com larguras diferentes das que o leitor
   espera — a etiqueta fica bonita e não passa no caixa.
   Por isso tudo aqui é calculado em pontos de impressora, e não em
   milímetros redondos.

   O arquivo é montado do zero, sem biblioteca de fora: as barras são
   retângulos pretos e o texto usa as fontes que todo leitor de PDF já
   tem. Nada para baixar, e o resultado é conferível com um leitor de
   código de barras de verdade.
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
const CODE128_INICIO_C = 105;
const CODE128_TROCA_B  = 100;
const CODE128_TROCA_C  = 99;
const CODE128_PARADA   = 106;

/* Traduz o texto para os símbolos do Code 128 e acrescenta o dígito
   verificador, que é o que faz o leitor confiar na leitura.

   O ponto importante aqui é o subset C: no C cada símbolo carrega DOIS
   dígitos em vez de um. Um código de 6 dígitos ocupa 68 módulos no C e
   101 no B. Em fita de 29 mm essa diferença é a diferença entre uma
   barra de 0,25 mm (que o leitor de balcão lê) e uma de 0,17 mm (que
   ele não lê). O código antigo, com letras, continua funcionando: o
   trecho de letras sai em B e o de números em C, na mesma etiqueta. */
function code128Simbolos(texto){
  const s = String(texto == null ? '' : texto);
  if(!s.length) return null;
  for(let i = 0; i < s.length; i++){
    const c = s.charCodeAt(i);
    /* O 128B cobre de espaço a til. Fora disso o leitor não teria o que
       fazer com o símbolo, então a peça fica sem código em vez de sair
       com um código que ninguém lê. */
    if(c < 32 || c > 126) return null;
  }

  const ehDigito = i => i < s.length && s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 57;
  const corrida = i => { let n = 0; while(ehDigito(i + n)) n++; return n; };
  /* Trocar de subset custa um símbolo. Só compensa quando a sequência de
     dígitos é longa o bastante para devolver o que a troca custou. */
  const compensaC = i => {
    const n = corrida(i);
    if(i === 0) return n >= 4;
    return n >= 6 || (i + n === s.length && n >= 4);
  };

  const codigos = [];
  let i = 0, modoC;
  if(compensaC(0)){ codigos.push(CODE128_INICIO_C); modoC = true; }
  else { codigos.push(CODE128_INICIO_B); modoC = false; }

  while(i < s.length){
    if(modoC){
      if(ehDigito(i) && ehDigito(i + 1)){ codigos.push(Number(s.substr(i, 2))); i += 2; continue; }
      codigos.push(CODE128_TROCA_B); modoC = false; continue;
    }
    if(compensaC(i)){
      /* Sequência ímpar: o primeiro dígito sai no B para que o resto
         caia em pares certinhos no C. */
      if(corrida(i) % 2 === 1){ codigos.push(s.charCodeAt(i) - 32); i++; }
      codigos.push(CODE128_TROCA_C); modoC = true; continue;
    }
    codigos.push(s.charCodeAt(i) - 32); i++;
  }

  let soma = codigos[0];
  for(let k = 1; k < codigos.length; k++) soma += codigos[k] * k;
  return [...codigos, soma % 103, CODE128_PARADA];
}

/* Devolve as barras pretas como {x, w}, em módulos, e quantos módulos o
   código ocupa por inteiro. */
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

/* ---------- Medidas da QL-800 ---------- */

const MM_EM_PONTOS = 72 / 25.4;
/* 300 dpi: um ponto da impressora vale 0,24 ponto de PDF, exatamente. */
const QL800_DPI = 300;
const PONTO_PDF_DA_IMPRESSORA = 72 / QL800_DPI;
const QL800_PONTO_MM = 25.4 / QL800_DPI;          // 0,08467 mm

/* A QL-800 não imprime até a beirada da fita: sobra cerca de 1,5 mm de
   cada lado que o cabeçote não alcança. Desenhar ali é desenhar no que
   vai sair branco. */
const MARGEM_NAO_IMPRIMIVEL_MM = 1.5;
/* O Code 128 exige 10 módulos de silêncio (branco) antes e depois das
   barras. Sem isso o leitor não sabe onde o código começa — é a causa
   mais comum de "a etiqueta saiu, mas o leitor não lê". */
const SILENCIO_EM_MODULOS = 10;
/* Abaixo de 0,19 mm por barra o leitor de balcão comum não lê. Três
   pontos da QL-800 dão 0,254 mm, com folga. */
const BARRA_MINIMA_PONTOS = 3;

/* Quantos pontos de impressora cada barra fina pode ter nesta etiqueta,
   já descontando as margens e o silêncio das pontas. Devolve 0 quando
   não cabe de jeito nenhum. */
function pontosPorModulo(larguraMM, modulos){
  const util = larguraMM - MARGEM_NAO_IMPRIMIVEL_MM * 2;
  const total = modulos + SILENCIO_EM_MODULOS * 2;
  const cabe = Math.floor((util / total) / QL800_PONTO_MM);
  return cabe > 0 ? cabe : 0;
}

/* Quanto mede a barra fina, em mm, para um código nesta etiqueta. É o
   número que decide se o caixa vai conseguir bipar a peça. */
function espessuraDaBarraMM(larguraMM, codigo){
  const c = code128Barras(codigo || '000001');
  if(!c) return 0;
  return pontosPorModulo(larguraMM, c.modulos) * QL800_PONTO_MM;
}

/* ---------- Montagem do arquivo ---------- */

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
  return String(texto).length * tamanho * (negrito ? 0.58 : 0.53);
}

function criarPdfEtiquetas(items, layout, nomeLoja, formatarPreco){
  const L = layout.w * MM_EM_PONTOS;
  const A = layout.h * MM_EM_PONTOS;
  const margem = MARGEM_NAO_IMPRIMIVEL_MM * MM_EM_PONTOS;
  const util = L - margem * 2;

  const baixa = layout.h <= 20;
  const estreita = layout.w <= 25;
  const ptLoja  = baixa ? 0 : (estreita ? 4 : 4.5);
  const ptNome  = baixa ? 4 : (estreita ? 4 : 4.5);
  const ptCodigo = layout.w <= 40 ? 4.5 : 5.5;
  const ptPreco = baixa ? 6 : (estreita ? 6.5 : 7.5);
  const linha = pt => pt * 1.25;

  const alturaTextos = (ptLoja ? linha(ptLoja) : 0) + linha(ptNome) + linha(ptCodigo) + linha(ptPreco);
  /* Barra alta demais é fita jogada fora, e barra baixa demais o leitor
     perde quando a mão treme. Entre 8 e 15 mm o leitor de balcão pega de
     primeira; o que sobrar da etiqueta vira espaço em volta, e o conjunto
     fica centralizado em vez de esticado. */
  const sobra = A - margem * 2 - alturaTextos;
  const alturaBarras = Math.max(4 * MM_EM_PONTOS, Math.min(sobra, 15 * MM_EM_PONTOS));
  const folgaDeCima = Math.max(0, (sobra - alturaBarras) / 2);

  const conteudos = items.map(item=>{
    const partes = [];
    const centrar = (texto, tamanho, negrito, y)=>{
      const t = escaparTextoPdf(texto);
      const x = (L - larguraAproximada(texto, tamanho, negrito)) / 2;
      partes.push(`BT /${negrito ? 'F2' : 'F1'} ${tamanho} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${t}) Tj ET`);
    };

    /* O PDF conta a altura de baixo para cima; aqui descemos a partir do
       topo, que é como a etiqueta é lida. */
    let topo = A - margem - folgaDeCima;

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
      /* Aqui está o coração da coisa: a barra recebe um número INTEIRO de
         pontos da impressora. Antes a largura vinha de uma divisão em
         milímetros e a QL-800 arredondava cada barra do jeito dela — as
         larguras saíam desiguais e o leitor recusava. */
      const pontos = Math.max(1, pontosPorModulo(layout.w, codigo.modulos));
      const larguraModulo = pontos * PONTO_PDF_DA_IMPRESSORA;
      const larguraCodigo = codigo.modulos * larguraModulo;
      const esquerda = (L - larguraCodigo) / 2;   // sobra vira silêncio dos dois lados
      const yBarras = topo - linha(ptCodigo) * 0.2 - alturaBarras;
      partes.push('0 0 0 rg');
      codigo.barras.forEach(b=>{
        const x = esquerda + b.x * larguraModulo;
        partes.push(`${x.toFixed(3)} ${yBarras.toFixed(2)} ${(b.w * larguraModulo).toFixed(3)} ${alturaBarras.toFixed(2)} re f`);
      });
      topo = yBarras;
    }

    topo -= linha(ptCodigo);
    centrar(item.v.barcode || '', ptCodigo, false, topo);

    topo -= linha(ptPreco);
    centrar(formatarPreco(item.p.price), ptPreco, true, Math.max(topo, margem));

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

/* =========================================================
   RECIBO DA VENDA EM PDF
   =========================================================
   O recibo saía pela impressão do navegador, e no iPhone isso dá a mesma
   folha em branco que dava nas etiquetas: o Safari manda o papel da janela
   (A4) e ignora o desenho da página. O caminho que funciona é o mesmo das
   etiquetas — um PDF, que leva o tamanho da página dentro dele.

   A largura é de 80 mm, o tamanho do cupom que as impressoras de recibo
   usam. Numa folha A4 ele sai como uma tira estreita, que é exatamente o
   formato de um recibo.
   ========================================================= */

const RECIBO_LARGURA_MM = 80;

/* Quebra o texto no que cabe na largura, sem cortar palavra no meio. */
function quebrarLinhas(texto, tamanho, negrito, larguraMax){
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  palavras.forEach(pal=>{
    const tentativa = atual ? atual + ' ' + pal : pal;
    if(larguraAproximada(tentativa, tamanho, negrito) <= larguraMax || !atual){
      atual = tentativa;
    } else {
      linhas.push(atual); atual = pal;
    }
  });
  if(atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

function criarPdfRecibo(sale, nomeLoja, formatarPreco, formatarData){
  const L = RECIBO_LARGURA_MM * MM_EM_PONTOS;
  const margem = 4 * MM_EM_PONTOS;
  const util = L - margem * 2;

  /* Monta a lista de linhas primeiro, para saber a altura da página antes
     de desenhar: cupom curto não desperdiça papel, cupom longo não corta. */
  const linhas = [];   // { texto, pt, negrito, onde: 'centro'|'esq'|'dir'|'traco' }
  const add = (texto, pt, negrito, onde)=>linhas.push({ texto, pt, negrito, onde: onde||'esq' });
  const traco = ()=>linhas.push({ onde:'traco', pt: 6 });

  add(String(nomeLoja).toUpperCase(), 11, true, 'centro');
  add(formatarData(sale.date), 7.5, false, 'centro');
  traco();

  (sale.items||[]).forEach(i=>{
    const nome = `${i.name} (${i.size}/${i.color})`;
    quebrarLinhas(nome, 8, false, util).forEach(l=>add(l, 8, false, 'esq'));
    add(`${i.qty} x ${formatarPreco(i.price)} = ${formatarPreco(i.qty * i.price)}`, 8, false, 'dir');
  });

  traco();
  if(Number(sale.discount) > 0) add('Desconto: ' + formatarPreco(sale.discount), 8, false, 'dir');
  add('TOTAL: ' + formatarPreco(sale.total), 12, true, 'dir');
  add('Pagamento: ' + (sale.payment || '-'), 8, false, 'esq');
  add('Vendedor(a): ' + (sale.seller || '-'), 8, false, 'esq');
  traco();
  add('Obrigado pela preferência!', 8.5, false, 'centro');

  const alturaDaLinha = l => l.onde === 'traco' ? l.pt * 1.6 : l.pt * 1.45;
  const alturaTotal = linhas.reduce((s,l)=>s + alturaDaLinha(l), 0) + margem * 2;
  const A = alturaTotal;

  const partes = [];
  let y = A - margem;
  linhas.forEach(l=>{
    y -= alturaDaLinha(l);
    if(l.onde === 'traco'){
      const meio = y + l.pt * 0.6;
      partes.push('0.6 w 0.4 0.4 0.4 RG');
      partes.push(`${margem.toFixed(2)} ${meio.toFixed(2)} m ${(L - margem).toFixed(2)} ${meio.toFixed(2)} l S`);
      return;
    }
    const larg = larguraAproximada(l.texto, l.pt, l.negrito);
    let x = margem;
    if(l.onde === 'centro') x = (L - larg) / 2;
    if(l.onde === 'dir')    x = L - margem - larg;
    if(x < margem) x = margem;
    partes.push(`BT /${l.negrito ? 'F2' : 'F1'} ${l.pt} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm ` +
                `(${escaparTextoPdf(l.texto)}) Tj ET`);
  });

  return montarPdfDeUmaPagina(L, A, partes.join('\n'));
}

/* O esqueleto do arquivo, para o recibo e para quem mais vier. */
function montarPdfDeUmaPagina(L, A, fluxo){
  const objetos = [];
  objetos.push('<< /Type /Catalog /Pages 2 0 R >>');
  objetos.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${L.toFixed(2)} ${A.toFixed(2)}] ` +
    `/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`);
  objetos.push(`<< /Length ${textoParaBytes(fluxo).length} >>\nstream\n${fluxo}\nendstream`);
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

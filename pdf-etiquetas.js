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

/* ---------- Texto: medidas de verdade ---------- */

/* Sinais que o WinAnsi (a tabela das fontes internas do PDF) guarda fora
   do lugar onde o navegador os guarda. */
const WINANSI_EXTRA = { '…':133, '–':150, '—':151, '•':149, '€':128,
                        '‘':145, '’':146, '“':147, '”':148 };

/* O PDF guarda o texto em bytes, não em caracteres. As fontes internas
   usam WinAnsi, que dá conta do português. */
function textoParaBytes(s){
  const bytes = [];
  for(let i = 0; i < s.length; i++){
    const c = s.charCodeAt(i);
    if(c < 256) bytes.push(c);
    else if(WINANSI_EXTRA[s[i]]) bytes.push(WINANSI_EXTRA[s[i]]);
    else bytes.push(63);   // fora do WinAnsi vira "?"
  }
  return bytes;
}

function escaparTextoPdf(s){
  return String(s).replace(/[\\()]/g, m=>'\\' + m);
}

/* Tira do texto o que a fonte da etiqueta não sabe desenhar (emoji,
   símbolos), em vez de imprimir "?" no meio do nome da peça. */
function limparTexto(s){
  return String(s == null ? '' : s)
    .replace(/[^ -~ -ÿ…–—•€‘’“”]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/* A largura de cada letra da Helvetica, em milésimos do tamanho da fonte
   (códigos 32 a 126). Antes o texto era centralizado por uma média —
   "cada letra mede mais ou menos 0,53" — e por isso um nome com muitos
   "i" e "l" saía para a esquerda e um com "M" e "W" para a direita. Com a
   medida real, o centro é o centro. */
const LARGURAS_HELVETICA = [
  278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
  1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
  333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
  556,556,333,500,278,556,500,722,500,500,500,334,260,334,584 ];
const LARGURAS_HELVETICA_NEGRITO = [
  278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,
  975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,
  333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,
  611,611,389,556,333,611,556,778,556,556,500,389,280,389,584 ];
const LARGURAS_ESPECIAIS = { ' ':278, '·':278, 'º':365, 'ª':370, '°':400,
  '…':1000, '—':1000, '–':556, '•':350, '€':556,
  '‘':222, '’':222, '“':333, '”':333 };

function larguraDoCaractere(ch, negrito){
  const tabela = negrito ? LARGURAS_HELVETICA_NEGRITO : LARGURAS_HELVETICA;
  const c = ch.charCodeAt(0);
  if(c >= 32 && c <= 126) return tabela[c - 32];
  if(LARGURAS_ESPECIAIS[ch]) return LARGURAS_ESPECIAIS[ch];
  /* Letra acentuada mede o mesmo que a letra sem o acento. */
  const base = ch.normalize ? ch.normalize('NFD').charAt(0) : ch;
  const cb = base.charCodeAt(0);
  if(base !== ch && cb >= 32 && cb <= 126) return tabela[cb - 32];
  return 556;
}
/* Largura do texto em pontos. `espaco` é o afastamento extra entre letras. */
function larguraTexto(texto, tamanho, negrito, espaco){
  const s = String(texto == null ? '' : texto);
  let soma = 0;
  for(let i = 0; i < s.length; i++) soma += larguraDoCaractere(s[i], negrito);
  return soma / 1000 * tamanho + (espaco || 0) * Math.max(0, s.length - 1);
}
/* Nome antigo, mantido porque o recibo chama por ele. */
function larguraAproximada(texto, tamanho, negrito){
  return larguraTexto(texto, tamanho, negrito, 0);
}
/* Corta o texto para caber na largura, terminando em reticências. */
function cortarParaCaber(texto, tamanho, negrito, larguraMax, espaco){
  let s = String(texto);
  if(larguraTexto(s, tamanho, negrito, espaco) <= larguraMax) return s;
  while(s.length > 1 && larguraTexto(s + '…', tamanho, negrito, espaco) > larguraMax) s = s.slice(0, -1);
  return s.replace(/\s+$/, '') + '…';
}
/* Quebra o texto no que cabe na largura, sem cortar palavra no meio. */
function quebrarLinhas(texto, tamanho, negrito, larguraMax){
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  palavras.forEach(pal=>{
    /* Palavra sozinha maior que a linha é cortada, senão vaza pela margem. */
    if(larguraTexto(pal, tamanho, negrito) > larguraMax) pal = cortarParaCaber(pal, tamanho, negrito, larguraMax);
    const tentativa = atual ? atual + ' ' + pal : pal;
    if(larguraTexto(tentativa, tamanho, negrito) <= larguraMax || !atual){
      atual = tentativa;
    } else {
      linhas.push(atual); atual = pal;
    }
  });
  if(atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

/* =========================================================
   O DESENHO DA ETIQUETA
   =========================================================
   Uma etiqueta de loja de roupa é lida em dois tempos: de longe, pela
   cliente (o preço e o tamanho); de perto, pelo leitor (o código). O
   desenho anterior tratava tudo como uma pilha de linhas do mesmo peso:
   nome, tamanho e cor espremidos numa linha só, encolhendo a letra até
   caber, e o preço pouco maior que o resto.

   O desenho novo tem hierarquia:
     - a loja, em versalete espaçado, com um filete embaixo;
     - o nome da peça, em até duas linhas (quebra em vez de encolher);
     - o TAMANHO numa tarja preta, que se acha de longe, e a cor ao lado;
     - o código de barras, com as mesmas regras de sempre para a QL-800;
     - o número do código, espaçado;
     - o preço, grande, com o "R$" menor que o valor.

   Esta função NÃO escreve PDF: ela devolve a lista do que desenhar
   (textos, retângulos, barras), em pontos. O PDF e a prévia da tela são
   feitos a partir da mesma lista — por isso o que aparece na tela é
   exatamente o que sai na fita.
   ========================================================= */
/* Quantos pontos da impressora cabem em cada barra fina, dada a largura
   livre (em mm) que o código tem para ocupar, silêncio incluído. */
function pontosNaLargura(livreMM, modulos){
  const cabe = Math.floor((livreMM / (modulos + SILENCIO_EM_MODULOS * 2)) / QL800_PONTO_MM);
  return cabe > 0 ? cabe : 0;
}

function desenharEtiqueta(item, layout, nomeLoja, formatarPreco, opcoes){
  opcoes = opcoes || {};
  /* ETIQUETA COMPRIDA (29 × 90, 29 × 62, 17 × 54...): em pé, o conteúdo
     ocupa um terço dela e o resto fica em branco; na fita de 17 mm o
     código de barras ainda sairia com barra de 0,08 mm, que leitor nenhum
     lê. Deitada, o texto e o código ganham o comprimento da etiqueta. O
     arquivo continua do tamanho do rolo; só o desenho gira. A loja pode
     escolher a posição; "auto" deita o que é comprido. */
  const comprida = layout.h >= layout.w * 1.9 || (layout.w < 25 && layout.h >= 45);
  const girar = opcoes.posicao === 'deitada' ? layout.h > layout.w
              : opcoes.posicao === 'pe' ? false : comprida;
  const larguraMM = girar ? layout.h : layout.w;
  const alturaMM  = girar ? layout.w : layout.h;
  /* ETIQUETA LARGA E BAIXA (62 × 30): texto de um lado, código do outro,
     em vez de uma pilha que não cabe na altura. */
  const deitada = larguraMM >= 50 && alturaMM <= larguraMM * 0.75;

  const L = larguraMM * MM_EM_PONTOS;
  const A = alturaMM * MM_EM_PONTOS;
  const margem = MARGEM_NAO_IMPRIMIVEL_MM * MM_EM_PONTOS;
  const util = L - margem * 2;
  const altUtil = A - margem * 2;
  const escalaPara = largura => Math.max(0.62, Math.min(1.4, largura / 73.7));   // 1 = fita de 29 mm

  const nome = limparTexto(item.p && item.p.name) || 'Peça';
  const tamBruto = limparTexto(item.v && item.v.size);
  const corBruta = limparTexto(item.v && item.v.color);
  const padrao = t => !t || /^padr[aã]o$/i.test(t);
  const tam = (opcoes.semVariante || padrao(tamBruto)) ? '' : tamBruto;
  const cor = (opcoes.semVariante || padrao(corBruta)) ? '' : corBruta;
  const loja = opcoes.semLoja ? '' : limparTexto(nomeLoja).toUpperCase();
  const precoTexto = opcoes.semPreco ? '' : limparTexto(formatarPreco(item.p && item.p.price));
  const codigoTexto = String((item.v && item.v.barcode) || '');
  const codigo = code128Barras(codigoTexto);

  const caixaDaLinha = pt => pt * 1.16;          // altura que uma linha de texto ocupa
  const linhaDeBase = pt => pt * 0.84;           // do topo da caixa até a linha de base

  /* Cada plano abre mão de alguma coisa para tudo caber. O primeiro que
     couber é o que vale. */
  const planos = [
    { loja:true,  linhas:2, variante:'linha', preco:1.00, minBarras: 7 },
    { loja:false, linhas:2, variante:'linha', preco:1.00, minBarras: 7 },
    { loja:false, linhas:1, variante:'linha', preco:1.00, minBarras: 7 },
    { loja:false, linhas:1, variante:'junto', preco:0.90, minBarras: 6 },
    { loja:false, linhas:1, variante:'junto', preco:0.75, minBarras: 5 },
    { loja:false, linhas:1, variante:'junto', preco:0.62, minBarras: 3 }
  ];

  /* Monta uma coluna: `area` é onde ela mora ({x, w, topo, h}, em pontos),
     `quer` diz o que entra nela (texto, barras ou os dois). */
  function montar(area, base, plano, quer, forcar){
    const cx = area.x + area.w / 2;
    const larg = area.w;
    const ptLoja   = Math.max(3.6, 5.0 * base);
    const ptNome   = Math.max(4.0, 5.8 * base);
    const ptTam    = Math.max(5.0, 7.6 * base);
    const ptCor    = Math.max(4.0, 5.4 * base);
    const ptCodigo = Math.max(3.8, 4.6 * base);
    const ptPrecoCheio = Math.min(16, Math.max(7, 11.5 * base));
    const vao = 1.5 * base;                      // respiro entre um bloco e outro

    const blocos = [];       // { h, desenhar(topo, prims) }
    const texto = (t, pt, negrito, esp)=>({
      h: caixaDaLinha(pt),
      desenhar(topo, prims){
        const largura = larguraTexto(t, pt, negrito, esp);
        prims.push({ t:'texto', texto:t, pt, negrito:!!negrito, esp: esp||0, cor:0, largura,
                     x: cx - largura / 2, y: topo - linhaDeBase(pt) });
      }
    });

    if(quer.texto && plano.loja && loja){
      const esp = 0.55 * base;
      const lojaCabe = cortarParaCaber(loja, ptLoja, true, larg, esp);
      const t = texto(lojaCabe, ptLoja, true, esp);
      blocos.push({ h: t.h + 3.2 * base, desenhar(topo, prims){
        t.desenhar(topo, prims);
        const larguraFilete = Math.min(larg * 0.42, larguraTexto(lojaCabe, ptLoja, true, esp));
        prims.push({ t:'ret', x: cx - larguraFilete / 2, y: topo - t.h - 1.5 * base, w: larguraFilete, h: 0.45, cor:0 });
      }});
    }

    if(quer.texto){
      /* A variante (tamanho e cor) ou ganha uma linha só dela, ou vai junto
         do nome quando a etiqueta é baixa demais. */
      let nomeParaDesenhar = nome;
      if(plano.variante === 'junto' && (tam || cor)){
        /* Se o nome não couber, quem é cortado é o NOME — o tamanho e a cor
           ficam. Etiqueta sem tamanho não serve para nada na arara. */
        const sufixo = ' ' + [tam, cor].filter(Boolean).join('/');
        const sobra = larg * plano.linhas - larguraTexto(sufixo, ptNome, false);
        nomeParaDesenhar = (sobra > ptNome * 3 ? cortarParaCaber(nome, ptNome, false, sobra) : '') + sufixo;
        nomeParaDesenhar = nomeParaDesenhar.trim();
      }
      let linhasDoNome = quebrarLinhas(nomeParaDesenhar, ptNome, false, larg);
      let ptNomeReal = ptNome;
      if(linhasDoNome.length > plano.linhas){
        /* Primeiro tenta uma letra um pouco menor; se nem assim, corta. */
        for(let pt = ptNome - 0.25; pt >= ptNome * 0.8; pt -= 0.25){
          const tentativa = quebrarLinhas(nomeParaDesenhar, pt, false, larg);
          if(tentativa.length <= plano.linhas){ linhasDoNome = tentativa; ptNomeReal = pt; break; }
        }
        if(linhasDoNome.length > plano.linhas){
          const resto = linhasDoNome.slice(plano.linhas - 1).join(' ');
          linhasDoNome = linhasDoNome.slice(0, plano.linhas - 1).concat([ resto ]);
        }
      }
      linhasDoNome = linhasDoNome.map(l => cortarParaCaber(l, ptNomeReal, false, larg));
      linhasDoNome.forEach(l => blocos.push(texto(l, ptNomeReal, false)));
    }

    if(quer.texto && plano.variante === 'linha' && (tam || cor)){
      /* Tamanho curto (P, M, GG, 42) vai na tarja. Tamanho comprido
         ("único até 42") vira texto em negrito: tarja larga demais come a
         etiqueta. */
      const naTarja = !!tam && tam.length <= 5;
      const tamTexto = naTarja ? tam.toUpperCase() : tam;
      let escala = 1;
      const medir = ()=>{
        const pTam = ptTam * escala, pCor = ptCor * escala;
        const larguraTam = tamTexto ? larguraTexto(tamTexto, naTarja ? pTam : pCor, true) : 0;
        const tarja = naTarja ? Math.max(pTam * 1.75, larguraTam + pTam * 0.95) : larguraTam;
        const separador = tamTexto && cor ? (naTarja ? pTam * 0.45 : larguraTexto(' · ', pCor, false)) : 0;
        const larguraCor = cor ? larguraTexto(cor, pCor, false) : 0;
        return { pTam, pCor, larguraTam, tarja, separador, larguraCor, total: tarja + separador + larguraCor };
      };
      let m = medir();
      if(m.total > larg){ escala = Math.max(0.7, larg / m.total); m = medir(); }
      let tamCabe = tamTexto, corCabe = cor;
      if(m.total > larg && cor){
        const sobraParaCor = larg - m.tarja - m.separador;
        if(sobraParaCor > m.pCor * 2){ corCabe = cortarParaCaber(cor, m.pCor, false, sobraParaCor); m.larguraCor = larguraTexto(corCabe, m.pCor, false); }
        else { corCabe = ''; m.larguraCor = 0; m.separador = 0; }
        m.total = m.tarja + m.separador + m.larguraCor;
      }
      if(m.total > larg && !naTarja){
        tamCabe = cortarParaCaber(tamTexto, m.pCor, true, larg);
        m.larguraTam = m.tarja = larguraTexto(tamCabe, m.pCor, true); m.total = m.tarja;
      }
      const alturaTarja = m.pTam * 1.42;
      blocos.push({ h: naTarja ? alturaTarja + 0.6 * base : caixaDaLinha(m.pCor), desenhar(topo, prims){
        let x = cx - m.total / 2;
        if(tamCabe && naTarja){
          prims.push({ t:'ret', x, y: topo - alturaTarja, w: m.tarja, h: alturaTarja, cor:0, raio: m.pTam * 0.32 });
          prims.push({ t:'texto', texto: tamCabe, pt: m.pTam, negrito:true, esp:0, cor:1, largura: m.larguraTam,
                       x: x + (m.tarja - m.larguraTam) / 2, y: topo - alturaTarja + (alturaTarja - m.pTam * 0.72) / 2 });
          x += m.tarja + m.separador;
          if(corCabe) prims.push({ t:'texto', texto: corCabe, pt: m.pCor, negrito:false, esp:0, cor:0, largura: m.larguraCor,
                                   x, y: topo - alturaTarja + (alturaTarja - m.pCor * 0.72) / 2 });
        } else {
          const y = topo - linhaDeBase(m.pCor);
          if(tamCabe){
            prims.push({ t:'texto', texto: tamCabe, pt: m.pCor, negrito:true, esp:0, cor:0, largura: m.larguraTam, x, y });
            x += m.larguraTam;
            if(corCabe){
              prims.push({ t:'texto', texto:' · ', pt: m.pCor, negrito:false, esp:0, cor:0, largura: m.separador, x, y });
              x += m.separador;
            }
          }
          if(corCabe) prims.push({ t:'texto', texto: corCabe, pt: m.pCor, negrito:false, esp:0, cor:0, largura: m.larguraCor, x, y });
        }
      }});
    }

    let indiceDasBarras = -1;
    if(quer.barras && codigo){
      indiceDasBarras = blocos.length;
      blocos.push({ h: 0, barras: true });
      blocos.push(texto(codigoTexto, ptCodigo, false, 0.7 * base));
    }

    if(quer.texto && precoTexto){
      /* O "R$" menor que o valor: o olho vai direto ao número. */
      let pt = ptPrecoCheio * plano.preco;
      const partes = precoTexto.split(/[\s ]+/);
      const temCifrao = partes.length > 1 && /^R\$$/.test(partes[0]);
      const valor = temCifrao ? partes.slice(1).join(' ') : precoTexto;
      const medir = p => {
        const pCif = p * 0.56;
        const lCif = temCifrao ? larguraTexto('R$', pCif, true) + p * 0.16 : 0;
        const lVal = larguraTexto(valor, p, true);
        return { pCif, lCif, lVal, total: lCif + lVal };
      };
      while(medir(pt).total > larg && pt > 5) pt -= 0.25;
      const m = medir(pt);
      blocos.push({ h: pt * 0.98 + 0.8 * base, desenhar(topo, prims){
        const y = topo - 0.8 * base - pt * 0.76;
        let x = cx - m.total / 2;
        if(temCifrao){
          prims.push({ t:'texto', texto:'R$', pt: m.pCif, negrito:true, esp:0, cor:0, largura: larguraTexto('R$', m.pCif, true),
                       x, y: y + (pt - m.pCif) * 0.70 });
          x += m.lCif;
        }
        prims.push({ t:'texto', texto: valor, pt, negrito:true, esp:0, cor:0, largura: m.lVal, x, y });
      }});
    }

    if(!blocos.length) return [];
    const fixo = blocos.reduce((s, b) => s + b.h, 0) + vao * (blocos.length - 1);
    let alturaBarras = 0;
    if(indiceDasBarras >= 0){
      const sobra = area.h - fixo;
      if(sobra < plano.minBarras * MM_EM_PONTOS && !forcar) return null;
      /* Barra alta demais é fita jogada fora; baixa demais o leitor perde
         quando a mão treme. Entre 7 e 14 mm ele pega de primeira. */
      alturaBarras = Math.max(2 * MM_EM_PONTOS, Math.min(sobra, 14 * MM_EM_PONTOS));
      blocos[indiceDasBarras].h = alturaBarras;
    } else if(fixo > area.h && !forcar) return null;

    const prims = [];
    let topo = area.topo - Math.max(0, (area.h - fixo - alturaBarras) / 2);
    blocos.forEach(b=>{
      if(b.barras){
        /* A barra recebe um número INTEIRO de pontos da impressora. Se a
           largura cair no meio de um ponto, a QL-800 arredonda cada barra
           do jeito dela e o leitor recusa. */
        const pontos = Math.max(1, pontosNaLargura(larg / MM_EM_PONTOS, codigo.modulos));
        const modulo = pontos * PONTO_PDF_DA_IMPRESSORA;
        const largura = codigo.modulos * modulo;
        /* O começo do código também cai em cima de um ponto da
           impressora: com as barras inteiras mas o início no meio de um
           ponto, há leitor de PDF que engorda cada barra e afina cada
           espaço na hora de imprimir. */
        const inicio = Math.round((cx - largura / 2) / PONTO_PDF_DA_IMPRESSORA) * PONTO_PDF_DA_IMPRESSORA;
        prims.push({ t:'barras', x: inicio, y: topo - b.h, h: b.h, modulo, barras: codigo.barras });
      } else b.desenhar(topo, prims);
      topo -= b.h + vao;
    });
    return prims;
  }
  function melhorPlano(area, base, quer){
    for(const plano of planos){ const r = montar(area, base, plano, quer, false); if(r) return r; }
    return montar(area, base, planos[planos.length - 1], quer, true);
  }

  let prims;
  const topo = A - margem;
  if(deitada && codigo){
    const vaoDasColunas = 2.2 * MM_EM_PONTOS;
    const larguraDasBarras = util * 0.52;
    const larguraDoTexto = util - larguraDasBarras - vaoDasColunas;
    const esquerda = { x: margem, w: larguraDoTexto, topo, h: altUtil };
    const direita  = { x: margem + larguraDoTexto + vaoDasColunas, w: larguraDasBarras, topo, h: altUtil };
    /* Deitada, a letra também respeita a altura: coluna larga e baixa não
       pode ganhar letra grande que não cabe em pé. */
    const base = Math.max(0.62, Math.min(escalaPara(larguraDoTexto), altUtil / 40));
    prims = melhorPlano(esquerda, base, { texto:true, barras:false })
      .concat(melhorPlano(direita, base, { texto:false, barras:true }));
  } else {
    prims = melhorPlano({ x: margem, w: util, topo, h: altUtil }, escalaPara(util), { texto:true, barras:true });
  }
  return { L: layout.w * MM_EM_PONTOS, A: layout.h * MM_EM_PONTOS, girar, largura: L, altura: A, prims };
}

/* A barra fina que ESTE desenho dá ao código, em mm. É o número que decide
   se o caixa vai conseguir bipar a peça. */
function barraDaEtiquetaMM(layout, codigoTexto, opcoes){
  const d = desenharEtiqueta({ p:{ name:'x', price:0 }, v:{ size:'', color:'', barcode: codigoTexto || '000001' } },
                             layout, '', ()=>'' , { semLoja:true, semPreco:true, semVariante:true, posicao: opcoes && opcoes.posicao });
  const b = d.prims.find(p=>p.t === 'barras');
  return b ? b.modulo / MM_EM_PONTOS : 0;
}

/* ---------- Do desenho para o PDF ---------- */
function retanguloPdf(p){
  const n = v => v.toFixed(3);
  if(!p.raio) return `${n(p.x)} ${n(p.y)} ${n(p.w)} ${n(p.h)} re f`;
  const r = Math.min(p.raio, p.w / 2, p.h / 2), k = r * 0.5523;
  const x0 = p.x, y0 = p.y, x1 = p.x + p.w, y1 = p.y + p.h;
  return [
    `${n(x0 + r)} ${n(y0)} m`,
    `${n(x1 - r)} ${n(y0)} l`,
    `${n(x1 - r + k)} ${n(y0)} ${n(x1)} ${n(y0 + r - k)} ${n(x1)} ${n(y0 + r)} c`,
    `${n(x1)} ${n(y1 - r)} l`,
    `${n(x1)} ${n(y1 - r + k)} ${n(x1 - r + k)} ${n(y1)} ${n(x1 - r)} ${n(y1)} c`,
    `${n(x0 + r)} ${n(y1)} l`,
    `${n(x0 + r - k)} ${n(y1)} ${n(x0)} ${n(y1 - r + k)} ${n(x0)} ${n(y1 - r)} c`,
    `${n(x0)} ${n(y0 + r)} l`,
    `${n(x0)} ${n(y0 + r - k)} ${n(x0 + r - k)} ${n(y0)} ${n(x0 + r)} ${n(y0)} c`,
    'f'
  ].join('\n');
}
function desenhoParaPdf(desenho){
  const partes = [];
  const tinta = c => (c ? '1 1 1 rg' : '0 0 0 rg');
  /* Desenho deitado numa fita de pé: gira 90° e encosta na borda. */
  if(desenho.girar) partes.push(`q 0 1 -1 0 ${desenho.L.toFixed(2)} 0 cm`);
  desenho.prims.forEach(p=>{
    if(p.t === 'texto'){
      if(!p.texto) return;
      partes.push(tinta(p.cor));
      partes.push(`BT /${p.negrito ? 'F2' : 'F1'} ${p.pt.toFixed(2)} Tf ${(p.esp||0).toFixed(3)} Tc ` +
                  `1 0 0 1 ${p.x.toFixed(2)} ${p.y.toFixed(2)} Tm (${escaparTextoPdf(p.texto)}) Tj ET`);
    } else if(p.t === 'ret'){
      partes.push(tinta(p.cor));
      partes.push(retanguloPdf(p));
    } else if(p.t === 'barras'){
      partes.push('0 0 0 rg');
      p.barras.forEach(b=>{
        partes.push(`${(p.x + b.x * p.modulo).toFixed(3)} ${p.y.toFixed(2)} ${(b.w * p.modulo).toFixed(3)} ${p.h.toFixed(2)} re f`);
      });
    }
  });
  if(desenho.girar) partes.push('Q');
  return partes.join('\n');
}

/* ---------- Do desenho para a tela (a prévia) ---------- */
function desenhoParaSvg(desenho, larguraMM, alturaMM, ampliar){
  const esc = s => String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const A = desenho.altura, z = ampliar || 1;
  const cor = c => (c ? '#fff' : '#000');
  const corpo = desenho.prims.map(p=>{
    if(p.t === 'texto'){
      if(!p.texto) return '';
      /* textLength obriga o navegador a usar a MESMA largura que o PDF usa,
         qualquer que seja a fonte que ele tenha no lugar da Helvetica. */
      const ajuste = p.texto.length > 1 && p.largura > 0 ? ` textLength="${p.largura.toFixed(2)}" lengthAdjust="spacing"` : '';
      return `<text x="${p.x.toFixed(2)}" y="${(A - p.y).toFixed(2)}" font-size="${p.pt.toFixed(2)}" ` +
             `font-weight="${p.negrito ? 700 : 400}" fill="${cor(p.cor)}" xml:space="preserve"${ajuste}>${esc(p.texto)}</text>`;
    }
    if(p.t === 'ret'){
      return `<rect x="${p.x.toFixed(2)}" y="${(A - p.y - p.h).toFixed(2)}" width="${p.w.toFixed(2)}" height="${p.h.toFixed(2)}" ` +
             `${p.raio ? `rx="${Math.min(p.raio, p.w/2, p.h/2).toFixed(2)}" ` : ''}fill="${cor(p.cor)}"/>`;
    }
    if(p.t === 'barras'){
      return `<g shape-rendering="crispEdges">` + p.barras.map(b=>
        `<rect x="${(p.x + b.x * p.modulo).toFixed(3)}" y="${(A - p.y - p.h).toFixed(2)}" width="${(b.w * p.modulo).toFixed(3)}" height="${p.h.toFixed(2)}" fill="#000"/>`
      ).join('') + `</g>`;
    }
    return '';
  }).join('');
  const dentro = desenho.girar ? `<g transform="matrix(0 -1 1 0 0 ${desenho.A.toFixed(2)})">${corpo}</g>` : corpo;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${desenho.L.toFixed(2)} ${desenho.A.toFixed(2)}" ` +
         `width="${(larguraMM * z).toFixed(2)}mm" height="${(alturaMM * z).toFixed(2)}mm" ` +
         `font-family="Helvetica, Arial, 'Liberation Sans', sans-serif" style="display:block;background:#fff">${dentro}</svg>`;
}

function criarPdfEtiquetas(items, layout, nomeLoja, formatarPreco, opcoes){
  const L = layout.w * MM_EM_PONTOS;
  const A = layout.h * MM_EM_PONTOS;
  const conteudos = items.map(item => desenhoParaPdf(desenharEtiqueta(item, layout, nomeLoja, formatarPreco, opcoes)));

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
    /* Pedido do site pode vir sem tamanho ou cor: nada de "(undefined/undefined)". */
    const variante = [i.size, i.color].filter(v=>v && v !== 'Único' && v !== 'Padrão').join('/');
    const nome = (i.name || 'Peça') + (variante ? ` (${variante})` : '');
    quebrarLinhas(nome, 8, false, util).forEach(l=>add(l, 8, false, 'esq'));
    add(cortarParaCaber(`${i.qty} x ${formatarPreco(i.price)} = ${formatarPreco(i.qty * i.price)}`, 8, false, util), 8, false, 'dir');
  });

  traco();
  if(Number(sale.discount) > 0) add('Desconto: ' + formatarPreco(sale.discount), 8, false, 'dir');
  add('TOTAL: ' + formatarPreco(sale.total), 12, true, 'dir');
  add(cortarParaCaber('Pagamento: ' + (sale.payment || '-'), 8, false, util), 8, false, 'esq');
  add(cortarParaCaber('Vendedor(a): ' + (sale.seller || '-'), 8, false, util), 8, false, 'esq');
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

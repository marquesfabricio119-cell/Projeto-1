import type { Comando } from '../lib/tipos';

/**
 * BIBLIOTECA DE 200 COMANDOS
 *
 * São 10 categorias com 20 comandos cada, numeradas em blocos fixos:
 *   Conversa do dia a dia .... 1 a 20
 *   Correção de erros ........ 21 a 40
 *   Gramática explicada ...... 41 a 60
 *   Vocabulário e memória .... 61 a 80
 *   Pronúncia ................ 81 a 100
 *   Inglês para o trabalho ... 101 a 120
 *   Inglês para viajar ....... 121 a 140
 *   Entrevistas e provas ..... 141 a 160
 *   Prática de escrita ....... 161 a 180
 *   Jogos e desafios ......... 181 a 200
 *
 * >>> TODO: este arquivo vem com 8 comandos reais por categoria (80 no total).
 * >>> Cole os 12 restantes de cada categoria onde está escrito
 * >>> "TODO: faltam 12 comandos". Basta seguir o mesmo formato
 * >>> { id, categoria, texto } e usar os números de id livres do bloco.
 * >>> Nenhum outro arquivo precisa ser alterado: a busca, os filtros e os
 * >>> botões da tela /comandos leem esta lista automaticamente.
 *
 * Os trechos entre [colchetes] são para o aluno trocar pelas palavras dele.
 * A tela mostra esses colchetes na cor do app justamente para ele perceber.
 */

export const CATEGORIAS = [
  'Conversa do dia a dia',
  'Correção de erros',
  'Gramática explicada',
  'Vocabulário e memória',
  'Pronúncia',
  'Inglês para o trabalho',
  'Inglês para viajar',
  'Entrevistas e provas',
  'Prática de escrita',
  'Jogos e desafios',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export const COMANDOS: Comando[] = [
  /* ---------- 1. Conversa do dia a dia (1 a 20) ---------- */
  {
    id: 1,
    categoria: 'Conversa do dia a dia',
    texto:
      'Quero praticar uma conversa de nível iniciante sobre [assunto]. Faça uma pergunta de cada vez e espere minha resposta.',
  },
  {
    id: 2,
    categoria: 'Conversa do dia a dia',
    texto:
      'Vamos fazer um diálogo em inglês: você é [o atendente da padaria] e eu sou o cliente. Comece você.',
  },
  {
    id: 3,
    categoria: 'Conversa do dia a dia',
    texto:
      'Me ensine 5 frases prontas para [me apresentar para alguém que acabei de conhecer], com a pronúncia aproximada em português.',
  },
  {
    id: 4,
    categoria: 'Conversa do dia a dia',
    texto:
      'Como eu digo em inglês, de um jeito natural, [me desculpa, eu não entendi, pode repetir mais devagar]?',
  },
  {
    id: 5,
    categoria: 'Conversa do dia a dia',
    texto:
      'Me faça 5 perguntas simples sobre a minha rotina. Depois de cada resposta minha, corrija só o que atrapalha o entendimento.',
  },
  {
    id: 6,
    categoria: 'Conversa do dia a dia',
    texto:
      'Vamos conversar sobre [meu fim de semana]. Use frases curtas e traduza qualquer palavra nova que você usar.',
  },
  {
    id: 7,
    categoria: 'Conversa do dia a dia',
    texto:
      'Me dê 3 formas diferentes de responder quando alguém pergunta "How are you?", da mais informal para a mais formal.',
  },
  {
    id: 8,
    categoria: 'Conversa do dia a dia',
    texto:
      'Simule uma conversa por mensagem com um amigo estrangeiro sobre [combinar um encontro]. Mande uma mensagem de cada vez.',
  },
  // TODO: faltam 12 comandos desta categoria (ids livres: 9 a 20).

  /* ---------- 2. Correção de erros (21 a 40) ---------- */
  {
    id: 21,
    categoria: 'Correção de erros',
    texto:
      'Corrija este texto que eu escrevi em inglês: [cole aqui o seu texto]. Mostre a versão certa e explique em português só os dois erros mais importantes.',
  },
  {
    id: 22,
    categoria: 'Correção de erros',
    texto:
      'Esta frase está certa? [escreva a frase]. Se estiver errada, mostre a correta e diga por que em uma linha.',
  },
  {
    id: 23,
    categoria: 'Correção de erros',
    texto:
      'Reescreva o que eu falei de um jeito que um nativo falaria: [sua frase]. Explique a diferença em português.',
  },
  {
    id: 24,
    categoria: 'Correção de erros',
    texto:
      'Eu sempre erro em [assunto que você erra sempre]. Me explique a regra com 3 exemplos do dia a dia e me dê um mini exercício.',
  },
  {
    id: 25,
    categoria: 'Correção de erros',
    texto:
      'Nesta conversa, corrija tudo o que eu escrever em inglês, mas nunca mais de dois erros por mensagem.',
  },
  {
    id: 26,
    categoria: 'Correção de erros',
    texto:
      'Qual a diferença entre [palavra 1] e [palavra 2]? Me dê um exemplo de cada e um jeito fácil de não confundir.',
  },
  {
    id: 27,
    categoria: 'Correção de erros',
    texto:
      'Eu escrevi [sua frase] mas queria dizer [o que você queria dizer]. Onde foi que eu me perdi?',
  },
  {
    id: 28,
    categoria: 'Correção de erros',
    texto:
      'Me mostre 5 erros que brasileiros cometem sempre ao falar sobre [assunto], com a forma certa ao lado.',
  },
  // TODO: faltam 12 comandos desta categoria (ids livres: 29 a 40).

  /* ---------- 3. Gramática explicada (41 a 60) ---------- */
  {
    id: 41,
    categoria: 'Gramática explicada',
    texto:
      'Me explique quando eu uso "do" e quando eu uso "does", como se eu nunca tivesse estudado inglês.',
  },
  {
    id: 42,
    categoria: 'Gramática explicada',
    texto:
      'Me explique [o assunto de gramática] com uma comparação do dia a dia, sem usar nome técnico nenhum.',
  },
  {
    id: 43,
    categoria: 'Gramática explicada',
    texto:
      'Qual a diferença entre [estrutura 1] e [estrutura 2]? Use a mesma frase nos dois casos para eu enxergar a mudança.',
  },
  {
    id: 44,
    categoria: 'Gramática explicada',
    texto:
      'Me dê a regra de [assunto] em no máximo 3 linhas e depois 5 frases para eu completar.',
  },
  {
    id: 45,
    categoria: 'Gramática explicada',
    texto:
      'Como eu monto uma pergunta em inglês no [tempo verbal]? Mostre o passo a passo com uma frase de exemplo.',
  },
  {
    id: 46,
    categoria: 'Gramática explicada',
    texto:
      'Quando eu uso "a", quando eu uso "an" e quando eu não uso nada? Me dê 6 exemplos curtos.',
  },
  {
    id: 47,
    categoria: 'Gramática explicada',
    texto:
      'Me explique os verbos irregulares mais usados no dia a dia: só os [número] principais, com exemplo de cada.',
  },
  {
    id: 48,
    categoria: 'Gramática explicada',
    texto:
      'Eu não entendi [assunto]. Explique de outro jeito, com um exemplo de [uma situação da minha vida].',
  },
  // TODO: faltam 12 comandos desta categoria (ids livres: 49 a 60).

  /* ---------- 4. Vocabulário e memória (61 a 80) ---------- */
  {
    id: 61,
    categoria: 'Vocabulário e memória',
    texto:
      'Me dê 10 palavras em inglês sobre [tema], com tradução, pronúncia aproximada e uma frase curta usando cada uma.',
  },
  {
    id: 62,
    categoria: 'Vocabulário e memória',
    texto:
      'Crie uma história curtinha em inglês usando estas palavras: [palavra 1], [palavra 2], [palavra 3]. Depois traduza.',
  },
  {
    id: 63,
    categoria: 'Vocabulário e memória',
    texto:
      'Me ajude a memorizar a palavra [palavra] com uma associação boba e fácil de lembrar em português.',
  },
  {
    id: 64,
    categoria: 'Vocabulário e memória',
    texto:
      'Quais são as 15 palavras mais úteis para quem trabalha com [sua profissão]? Organize da mais usada para a menos usada.',
  },
  {
    id: 65,
    categoria: 'Vocabulário e memória',
    texto:
      'Me teste no vocabulário de [tema]: mostre a palavra em inglês e eu tento dizer o que é. Corrija na hora.',
  },
  {
    id: 66,
    categoria: 'Vocabulário e memória',
    texto:
      'Me dê 8 expressões que os nativos usam todo dia e que não dá para traduzir ao pé da letra.',
  },
  {
    id: 67,
    categoria: 'Vocabulário e memória',
    texto:
      'Separe as palavras de [tema] em 3 grupinhos que façam sentido juntos, para eu decorar por bloco.',
  },
  {
    id: 68,
    categoria: 'Vocabulário e memória',
    texto:
      'Hoje eu estudei o mapa mental de [tema do kit]. Me faça 5 perguntas para ver se eu fixei o vocabulário.',
  },
  // TODO: faltam 12 comandos desta categoria (ids livres: 69 a 80).

  /* ---------- 5. Pronúncia (81 a 100) ---------- */
  {
    id: 81,
    categoria: 'Pronúncia',
    texto:
      'Como se fala [palavra]? Escreva a pronúncia aproximada em português e me dê uma frase para treinar.',
  },
  {
    id: 82,
    categoria: 'Pronúncia',
    texto:
      'Me explique a diferença de som entre [palavra 1] e [palavra 2] de um jeito que eu consiga ouvir a diferença.',
  },
  {
    id: 83,
    categoria: 'Pronúncia',
    texto:
      'Quais sons do inglês são mais difíceis para brasileiro? Me dê um exercício simples para cada um.',
  },
  {
    id: 84,
    categoria: 'Pronúncia',
    texto:
      'Me dê 10 palavras de [tema] com a pronúncia aproximada em português, sem símbolo fonético nenhum.',
  },
  {
    id: 85,
    categoria: 'Pronúncia',
    texto:
      'Como eu falo o "th" de [palavra] sem parecer que estou falando "f" ou "t"? Me dê um truque prático.',
  },
  {
    id: 86,
    categoria: 'Pronúncia',
    texto:
      'Onde cai a força da palavra em [palavra]? Marque a sílaba forte e me dê 3 palavras parecidas.',
  },
  {
    id: 87,
    categoria: 'Pronúncia',
    texto:
      'Me dê 5 trava-línguas fáceis em inglês para treinar o som de [som que você quer treinar].',
  },
  {
    id: 88,
    categoria: 'Pronúncia',
    texto:
      'Escreva esta frase do jeito que ela soa na boca de um nativo, em letras de português: [sua frase].',
  },
  // TODO: faltam 12 comandos desta categoria (ids livres: 89 a 100).

  /* ---------- 6. Inglês para o trabalho (101 a 120) ---------- */
  {
    id: 101,
    categoria: 'Inglês para o trabalho',
    texto:
      'Escreva um e-mail profissional em inglês para [assunto do e-mail]. Depois me explique as escolhas de palavra.',
  },
  {
    id: 102,
    categoria: 'Inglês para o trabalho',
    texto:
      'Como eu digo em uma reunião, com educação, que [eu não concordo com a proposta]? Me dê 3 opções.',
  },
  {
    id: 103,
    categoria: 'Inglês para o trabalho',
    texto:
      'Me ensine 10 frases prontas para participar de uma reunião online em inglês sem travar.',
  },
  {
    id: 104,
    categoria: 'Inglês para o trabalho',
    texto:
      'Vamos simular uma reunião: você é [o cliente estrangeiro] e eu apresento [o meu trabalho]. Comece você.',
  },
  {
    id: 105,
    categoria: 'Inglês para o trabalho',
    texto:
      'Revise esta mensagem que vou mandar para um colega de fora: [cole a mensagem]. Deixe mais natural e educada.',
  },
  {
    id: 106,
    categoria: 'Inglês para o trabalho',
    texto:
      'Qual vocabulário eu preciso saber para trabalhar com [sua área]? Me dê os 20 termos essenciais com tradução.',
  },
  {
    id: 107,
    categoria: 'Inglês para o trabalho',
    texto:
      'Como eu peço um prazo maior em inglês sem parecer desorganizado? Me dê a frase e o motivo de cada palavra.',
  },
  {
    id: 108,
    categoria: 'Inglês para o trabalho',
    texto:
      'Me ajude a me apresentar em 30 segundos numa reunião de trabalho. Eu sou [sua profissão] e trabalho com [o que você faz].',
  },
  // TODO: faltam 12 comandos desta categoria (ids livres: 109 a 120).

  /* ---------- 7. Inglês para viajar (121 a 140) ---------- */
  {
    id: 121,
    categoria: 'Inglês para viajar',
    texto:
      'Me ensine tudo o que eu preciso falar [no aeroporto], do check-in até o embarque, com pronúncia aproximada.',
  },
  {
    id: 122,
    categoria: 'Inglês para viajar',
    texto:
      'Vamos simular: você é o atendente do hotel e eu vou fazer o check-in. Fale primeiro e me corrija no fim.',
  },
  {
    id: 123,
    categoria: 'Inglês para viajar',
    texto: 'Como eu peço [comida] em um restaurante sem parecer grosseiro? Me dê 3 níveis de educação.',
  },
  {
    id: 124,
    categoria: 'Inglês para viajar',
    texto:
      'Me dê 15 frases de emergência para usar em viagem: perder o passaporte, passar mal, pedir ajuda.',
  },
  {
    id: 125,
    categoria: 'Inglês para viajar',
    texto: 'Como eu pergunto o caminho para [lugar] e entendo a resposta? Me ensine as palavras da resposta também.',
  },
  {
    id: 126,
    categoria: 'Inglês para viajar',
    texto:
      'Vou viajar para [país ou cidade]. Que expressões locais eu preciso conhecer para não passar vergonha?',
  },
  {
    id: 127,
    categoria: 'Inglês para viajar',
    texto:
      'Me ensine a falar de dinheiro em inglês: preços, troco, cartão, gorjeta. Com exemplos de frases curtas.',
  },
  {
    id: 128,
    categoria: 'Inglês para viajar',
    texto:
      'Simule a fila da imigração: você é o oficial e me faz as perguntas de sempre. Eu respondo e você corrige.',
  },
  // TODO: faltam 12 comandos desta categoria (ids livres: 129 a 140).

  /* ---------- 8. Entrevistas e provas (141 a 160) ---------- */
  {
    id: 141,
    categoria: 'Entrevistas e provas',
    texto:
      'Me faça uma entrevista de emprego em inglês para a vaga de [vaga]. Uma pergunta por vez, e corrija no fim de cada resposta.',
  },
  {
    id: 142,
    categoria: 'Entrevistas e provas',
    texto:
      'Como eu respondo "Tell me about yourself" sendo [sua profissão]? Me dê uma resposta de 40 segundos e explique a estrutura.',
  },
  {
    id: 143,
    categoria: 'Entrevistas e provas',
    texto:
      'Me dê as 10 perguntas mais comuns de entrevista em inglês com uma resposta modelo curta para cada.',
  },
  {
    id: 144,
    categoria: 'Entrevistas e provas',
    texto:
      'Como eu falo dos meus defeitos em uma entrevista em inglês sem me prejudicar? Me dê 3 exemplos.',
  },
  {
    id: 145,
    categoria: 'Entrevistas e provas',
    texto:
      'Estou estudando para a prova [nome da prova], parte de [speaking, writing, reading ou listening]. Me faça um simulado curto.',
  },
  {
    id: 146,
    categoria: 'Entrevistas e provas',
    texto:
      'Corrija a minha resposta de entrevista como se você fosse o recrutador: [cole sua resposta]. Diga o que passaria e o que não.',
  },
  {
    id: 147,
    categoria: 'Entrevistas e provas',
    texto:
      'Que perguntas EU devo fazer no fim de uma entrevista em inglês? Me dê 5 e explique o efeito de cada uma.',
  },
  {
    id: 148,
    categoria: 'Entrevistas e provas',
    texto:
      'Me ajude a falar da minha experiência com [tecnologia ou habilidade] em inglês, em 3 frases fortes.',
  },
  // TODO: faltam 12 comandos desta categoria (ids livres: 149 a 160).

  /* ---------- 9. Prática de escrita (161 a 180) ---------- */
  {
    id: 161,
    categoria: 'Prática de escrita',
    texto:
      'Me dê um tema simples para eu escrever 5 frases em inglês hoje. Depois corrija o que eu escrever.',
  },
  {
    id: 162,
    categoria: 'Prática de escrita',
    texto:
      'Escrevi este parágrafo: [cole o texto]. Deixe mais claro sem trocar o meu jeito de falar, e me mostre o antes e o depois.',
  },
  {
    id: 163,
    categoria: 'Prática de escrita',
    texto:
      'Me ensine a escrever uma mensagem curta em inglês para [situação], com 3 versões: informal, neutra e formal.',
  },
  {
    id: 164,
    categoria: 'Prática de escrita',
    texto:
      'Vamos escrever juntos: eu escrevo uma frase em inglês, você continua a história com outra. Comece você.',
  },
  {
    id: 165,
    categoria: 'Prática de escrita',
    texto:
      'Como eu começo e como eu termino um e-mail em inglês? Me dê 5 aberturas e 5 fechos, do informal ao formal.',
  },
  {
    id: 166,
    categoria: 'Prática de escrita',
    texto:
      'Traduza o que eu escrevi em português para um inglês simples e natural: [cole o texto]. Nada rebuscado.',
  },
  {
    id: 167,
    categoria: 'Prática de escrita',
    texto:
      'Me dê 7 palavrinhas de ligação (but, so, because...) com exemplos, para as minhas frases pararem de ficar soltas.',
  },
  {
    id: 168,
    categoria: 'Prática de escrita',
    texto:
      'Me proponha um diário de 5 linhas em inglês sobre o meu dia. Me dê o modelo e corrija quando eu preencher.',
  },
  // TODO: faltam 12 comandos desta categoria (ids livres: 169 a 180).

  /* ---------- 10. Jogos e desafios (181 a 200) ---------- */
  {
    id: 181,
    categoria: 'Jogos e desafios',
    texto:
      'Vamos brincar de 20 perguntas em inglês. Você pensa em um [objeto] e eu adivinho. Só responda yes ou no.',
  },
  {
    id: 182,
    categoria: 'Jogos e desafios',
    texto:
      'Me dê um desafio de inglês de 5 minutos sobre [tema], no meu nível, com pontuação no final.',
  },
  {
    id: 183,
    categoria: 'Jogos e desafios',
    texto:
      'Faça um quiz de 8 perguntas sobre [tema]. Uma por vez, e me diga o placar no fim.',
  },
  {
    id: 184,
    categoria: 'Jogos e desafios',
    texto:
      'Vamos jogar forca em inglês com uma palavra de [tema]. Me dê a dica e conte as letras.',
  },
  {
    id: 185,
    categoria: 'Jogos e desafios',
    texto:
      'Me dê 5 frases em inglês, sendo uma com erro. Eu tento achar a errada e você me diz se acertei.',
  },
  {
    id: 186,
    categoria: 'Jogos e desafios',
    texto:
      'Jogo da palavra puxa palavra: você diz uma palavra em inglês e eu digo outra que comece com a última letra.',
  },
  {
    id: 187,
    categoria: 'Jogos e desafios',
    texto:
      'Me dê um desafio de tradução relâmpago: 10 frases curtas em português para eu passar para o inglês.',
  },
  {
    id: 188,
    categoria: 'Jogos e desafios',
    texto:
      'Vamos fazer uma dramatização engraçada: você é [um alienígena que acabou de chegar na Terra] e só fala inglês.',
  },
  // TODO: faltam 12 comandos desta categoria (ids livres: 189 a 200).
];

export const TOTAL_PREVISTO_DE_COMANDOS = 200;

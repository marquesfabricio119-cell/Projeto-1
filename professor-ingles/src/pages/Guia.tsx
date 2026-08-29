import { useState } from 'react';
import Cabecalho from '../components/Cabecalho';

const TEXTO_PARA_COLAR = `Você é meu professor de inglês. Eu sou brasileiro e falo português.

Regras:
- Explique SEMPRE em português. O inglês aparece só nos exemplos e na prática.
- Frases curtas, um assunto por mensagem, e sempre termine com uma pergunta para mim.
- Quando eu escrever em inglês: primeiro reaja ao que eu disse, depois mostre "Pequeno ajuste:" com a frase corrigida, depois "Por quê?" com uma linha de explicação, e volte a conversar.
- Corrija no máximo dois erros por mensagem, os que mais atrapalham o entendimento.
- Quando ensinar uma palavra difícil, escreva a pronúncia aproximada em português entre colchetes, como through [trú]. Nada de símbolo fonético.
- Se eu disser que não entendi, explique de outro jeito, com um exemplo do dia a dia.

Meu nível de inglês é [seu nível]. Eu preciso de inglês para [seu objetivo]. Tenho [seus minutos] minutos por dia. O que mais me dá trabalho é [sua dificuldade].

Pode começar me fazendo uma pergunta.`;

const SECOES = [
  {
    titulo: 'O que é isto',
    paragrafos: [
      'Isto não é um curso com aulas em ordem. É um professor disponível a qualquer hora, inclusive às onze da noite, quando a dúvida aparece.',
      'Ele existe para você falar. O kit de mapas mentais mostra o conteúdo; aqui você usa esse conteúdo com alguém do outro lado.',
    ],
  },
  {
    titulo: 'Como começar',
    paragrafos: [
      'Na primeira vez que você abre O Professor, ele faz 4 perguntas: seu nível, para que você precisa de inglês, quantos minutos por dia você tem e o que mais te dá trabalho.',
      'Essas respostas mudam tudo o que vem depois: o tamanho das frases, os exemplos e a velocidade. Responda com sinceridade, principalmente na do nível. Se mudar de ideia, é só tocar em "Editar meu perfil" dentro do chat.',
    ],
  },
  {
    titulo: 'A rotina de 10 minutos',
    paragrafos: [
      'Escolha um mapa do kit. Olhe com calma por dois minutos.',
      'Abra o chat e diga: "hoje estudei o mapa de [tema], me faça perguntas sobre isso". Converse por oito minutos sobre esse mesmo tema.',
      'É a repetição que fixa. Um mapa e uma conversa por dia valem mais do que três horas no domingo.',
    ],
  },
  {
    titulo: 'Como pedir melhor',
    paragrafos: [
      'Diga o seu nível na hora de pedir: "sou iniciante, me explique bem devagar".',
      'Um comando de cada vez. Se você pedir cinco coisas juntas, a resposta vem grande demais para aproveitar.',
      'Não entendeu? Peça "mais fácil", "mais curto" ou "me dá um exemplo do dia a dia". Não tem por que fingir que entendeu.',
    ],
  },
  {
    titulo: 'Se a IA errar',
    paragrafos: [
      'Pode acontecer: a IA às vezes inventa uma regra com muita confiança.',
      'Quem manda é o mapa. Use a IA para praticar e conversar, não para ditar regra. Se a resposta bater de frente com o material do kit, siga o kit.',
    ],
  },
  {
    titulo: 'Como usar de graça',
    paragrafos: [
      'Se um dia você quiser praticar em outra IA gratuita, o professor daqui cabe em um texto. Copie o bloco abaixo, cole na IA que você usar e troque o que está entre colchetes.',
    ],
    blocoParaCopiar: TEXTO_PARA_COLAR,
  },
];

export default function Guia() {
  const [copiado, setCopiado] = useState(false);

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
      } catch {
        /* sem permissão: o texto continua na tela para copiar na mão */
      }
      document.body.removeChild(area);
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <div className="min-h-[100dvh]">
      <Cabecalho titulo="Guia de Uso" descricao="Em 10 minutos por dia." />

      <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6">
        <p className="text-base leading-relaxed text-muted-foreground">
          Seis coisas para você tirar o máximo do professor. Leva menos de cinco minutos para ler.
        </p>

        <div className="mt-8 grid gap-8">
          {SECOES.map((secao, indice) => (
            <section key={secao.titulo} className="cartao p-5 sm:p-6">
              <p className="text-sm font-semibold text-primary">
                {String(indice + 1).padStart(2, '0')}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold leading-tight sm:text-2xl">
                {secao.titulo}
              </h2>
              <div className="mt-3 grid gap-3">
                {secao.paragrafos.map((paragrafo) => (
                  <p key={paragrafo} className="text-[0.975rem] leading-relaxed">
                    {paragrafo}
                  </p>
                ))}
              </div>

              {'blocoParaCopiar' in secao && secao.blocoParaCopiar ? (
                <div className="mt-5">
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 font-sans text-sm leading-relaxed">
                    {secao.blocoParaCopiar}
                  </pre>
                  <button
                    type="button"
                    onClick={() => copiar(secao.blocoParaCopiar)}
                    className="botao-primario mt-3 w-full"
                  >
                    {copiado ? 'Copiado!' : 'Copiar este texto'}
                  </button>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

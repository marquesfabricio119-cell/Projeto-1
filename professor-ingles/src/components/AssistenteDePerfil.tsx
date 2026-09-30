import { useState } from 'react';
import type { Perfil } from '../lib/tipos';

const PASSOS = [
  {
    campo: 'nivel',
    pergunta: 'Quanto de inglês você sabe?',
    ajuda: 'Responda sem medo. Isso só serve para o professor falar do seu jeito.',
    opcoes: ['Nada', 'Entendo mas não falo', 'Me viro', 'Bastante'],
  },
  {
    campo: 'objetivo',
    pergunta: 'Para que você precisa de inglês?',
    ajuda: 'O professor vai puxar os exemplos para o seu lado.',
    opcoes: ['Trabalho', 'Viagem', 'Estudo', 'Morar fora', 'Gosto pessoal'],
  },
  {
    campo: 'tempo',
    pergunta: 'Quantos minutos por dia você tem?',
    ajuda: 'Pouco tempo também dá certo, desde que seja todo dia.',
    opcoes: ['5 minutos', '10 minutos', '15 minutos', '30 minutos ou mais'],
  },
  {
    campo: 'dificuldade',
    pergunta: 'O que mais te dá trabalho?',
    ajuda: 'É por aqui que o professor vai começar.',
    opcoes: [
      'Falar',
      'Entender quando falam comigo',
      'Gramática',
      'Vocabulário',
      'Pronúncia',
    ],
    campoLivre: 'Outra coisa…',
  },
] as const;

type Props = {
  perfilInicial?: Perfil | null;
  aoConcluir: (perfil: Perfil) => void;
  aoCancelar?: () => void;
};

const PERFIL_VAZIO: Perfil = { nivel: '', objetivo: '', tempo: '', dificuldade: '' };

/**
 * As 4 perguntas do começo, uma por tela.
 * Nada de despejar tudo de uma vez: o aluno toca e avança.
 */
export default function AssistenteDePerfil({ perfilInicial, aoConcluir, aoCancelar }: Props) {
  const [passo, setPasso] = useState(0);
  const [perfil, setPerfil] = useState<Perfil>(perfilInicial ?? PERFIL_VAZIO);
  const [outraCoisa, setOutraCoisa] = useState('');

  const atual = PASSOS[passo];
  const ultimo = passo === PASSOS.length - 1;
  const escolhido = perfil[atual.campo];

  function escolher(valor: string) {
    const novoPerfil: Perfil = { ...perfil, [atual.campo]: valor };
    setPerfil(novoPerfil);
    if (ultimo) aoConcluir(novoPerfil);
    else setPasso(passo + 1);
  }

  function concluirComTextoLivre() {
    const texto = outraCoisa.trim();
    if (!texto) return;
    aoConcluir({ ...perfil, dificuldade: texto });
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6">
      <div className="cartao animate-entrada-suave p-5 sm:p-7">
        <p className="text-sm font-medium text-muted-foreground">
          Pergunta {passo + 1} de {PASSOS.length}
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-tight">{atual.pergunta}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{atual.ajuda}</p>

        <div className="mt-6 grid gap-3">
          {atual.opcoes.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => escolher(opcao)}
              aria-pressed={escolhido === opcao}
              className={`min-h-[3.25rem] w-full rounded-lg px-4 py-3 text-left text-base font-medium transition
                ${
                  escolhido === opcao
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'bg-muted text-foreground hover:bg-accent'
                }`}
            >
              {opcao}
            </button>
          ))}

          {'campoLivre' in atual && atual.campoLivre ? (
            <div className="mt-1">
              <label htmlFor="outra-coisa" className="mb-2 block text-sm text-muted-foreground">
                {atual.campoLivre}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="outra-coisa"
                  type="text"
                  value={outraCoisa}
                  onChange={(evento) => setOutraCoisa(evento.target.value)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter') {
                      evento.preventDefault();
                      concluirComTextoLivre();
                    }
                  }}
                  placeholder="Escreva com as suas palavras"
                  className="campo bg-muted"
                  maxLength={120}
                />
                <button
                  type="button"
                  onClick={concluirComTextoLivre}
                  disabled={!outraCoisa.trim()}
                  className="botao-secundario sm:w-auto"
                >
                  Pronto
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2" role="presentation">
            {PASSOS.map((item, indice) => (
              <span
                key={item.campo}
                className={`h-2.5 rounded-full transition-all ${
                  indice === passo ? 'w-6 bg-primary' : 'w-2.5 bg-muted-foreground/30'
                }`}
              />
            ))}
            <span className="sr-only">
              Passo {passo + 1} de {PASSOS.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {passo > 0 ? (
              <button type="button" onClick={() => setPasso(passo - 1)} className="botao-secundario">
                Voltar
              </button>
            ) : null}
            {aoCancelar ? (
              <button type="button" onClick={aoCancelar} className="botao-secundario">
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-sm text-center text-sm text-muted-foreground">
        São só 4 perguntas. Depois é conversa direto com o professor.
      </p>
    </div>
  );
}

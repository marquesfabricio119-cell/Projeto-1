import { Link, useNavigate } from 'react-router-dom';
import BotaoDeTema from '../components/BotaoDeTema';
import { encerrarAcesso, lerNome, lerTotalDeConversas } from '../lib/armazenamento';

const CARTOES = [
  {
    para: '/chat',
    titulo: 'O Professor',
    descricao: 'Converse, ele corrige e explica em português.',
    icone: 'professor',
  },
  {
    para: '/comandos',
    titulo: '200 Comandos',
    descricao: 'Copie, cole e pronto. Não precisa saber usar IA.',
    icone: 'comandos',
  },
  {
    para: '/criancas',
    titulo: 'Mapas para Crianças',
    descricao: '60 mapas ilustrados para aprender em família.',
    icone: 'criancas',
  },
  {
    para: '/guia',
    titulo: 'Guia de Uso',
    descricao: 'Como aproveitar em 10 minutos por dia.',
    icone: 'guia',
  },
] as const;

export default function Inicio() {
  const navegar = useNavigate();
  const nome = lerNome();
  const total = lerTotalDeConversas();

  function sair() {
    encerrarAcesso();
    navegar('/entrar', { replace: true });
  }

  return (
    <div className="min-h-[100dvh]">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground">
          IV
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold leading-tight">Idioma Visual</p>
          <p className="truncate text-xs text-muted-foreground">Seu Professor com IA</p>
        </div>
        <BotaoDeTema />
        <button type="button" onClick={sair} className="botao-secundario px-4">
          Sair
        </button>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
          {nome ? `Olá, ${nome}!` : 'Olá!'}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Seu professor está pronto. Vamos começar?
        </p>

        <nav aria-label="Seções do app" className="mt-6 grid gap-4 sm:grid-cols-2">
          {CARTOES.map((cartao) => (
            <Link
              key={cartao.para}
              to={cartao.para}
              className="cartao group flex items-start gap-4 p-5 transition hover:shadow-lift active:scale-[0.995] sm:min-h-[9.5rem] sm:flex-col sm:gap-3"
            >
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"
                aria-hidden="true"
              >
                <Icone nome={cartao.icone} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-bold leading-tight">
                  {cartao.titulo}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{cartao.descricao}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="cartao mt-6 flex items-center gap-3 p-4">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12l5 5L20 6" />
            </svg>
          </span>
          <p className="text-sm leading-snug text-muted-foreground">
            {total === 0
              ? 'Você ainda não falou com o professor. Na primeira vez ele faz 4 perguntas rápidas.'
              : `Você já teve ${total} ${total === 1 ? 'conversa' : 'conversas'} com o professor.`}
          </p>
        </div>
      </main>
    </div>
  );
}

function Icone({ nome }: { nome: (typeof CARTOES)[number]['icone'] }) {
  const comum = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, className: 'h-6 w-6' };
  if (nome === 'professor') {
    return (
      <svg {...comum}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v11H8l-4 3V5Z" />
        <path strokeLinecap="round" d="M8 9h8M8 12.5h5" />
      </svg>
    );
  }
  if (nome === 'comandos') {
    return (
      <svg {...comum}>
        <rect x="3.5" y="4" width="17" height="16" rx="3" />
        <path strokeLinecap="round" d="M7.5 9h9M7.5 12.5h9M7.5 16h5" />
      </svg>
    );
  }
  if (nome === 'criancas') {
    return (
      <svg {...comum}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
        <circle cx="9" cy="10" r="1.6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 17l4.5-4 3.5 3 3-2.5 4 3.5" />
      </svg>
    );
  }
  return (
    <svg {...comum}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5v-15Z" />
      <path strokeLinecap="round" d="M9 8h6" />
    </svg>
  );
}

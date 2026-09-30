import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BotaoDeTema from './BotaoDeTema';

type Props = {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
};

/** Barra de topo das telas internas: voltar, título e ações da tela. */
export default function Cabecalho({ titulo, descricao, acoes }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3">
        <Link
          to="/"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-foreground transition hover:bg-accent"
          aria-label="Voltar para o início"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
          </svg>
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight">{titulo}</h1>
          {descricao ? (
            <p className="truncate text-sm text-muted-foreground">{descricao}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {acoes}
          <BotaoDeTema />
        </div>
      </div>
    </header>
  );
}

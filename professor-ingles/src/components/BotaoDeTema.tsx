import { useEffect, useState } from 'react';
import { gravarTema, lerTema, temaEmUso, type Tema } from '../lib/armazenamento';

/** Alterna entre o tema claro e o escuro, guardando a escolha no aparelho. */
export default function BotaoDeTema() {
  const [tema, setTema] = useState<Tema>(() => lerTema() ?? temaEmUso());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro');
  }, [tema]);

  function alternar() {
    const proximo: Tema = tema === 'escuro' ? 'claro' : 'escuro';
    setTema(proximo);
    gravarTema(proximo);
  }

  const escuro = tema === 'escuro';

  return (
    <button
      type="button"
      onClick={alternar}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-foreground transition hover:bg-accent"
      aria-label={escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      aria-pressed={escuro}
    >
      {escuro ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIAS, COMANDOS } from '../data/comandos';
import TextoComColchetes from './TextoComColchetes';

type Props = {
  aberta: boolean;
  aoFechar: () => void;
  aoEscolher: (texto: string) => void;
};

/**
 * Gaveta de comandos que sobe de baixo, dentro do chat.
 * Tocar em um comando escreve o texto no campo — NÃO envia — para o aluno
 * trocar os [colchetes] antes.
 */
export default function FolhaDeComandos({ aberta, aoFechar, aoEscolher }: Props) {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const campoDeBusca = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    const foco = window.setTimeout(() => campoDeBusca.current?.focus(), 80);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      window.clearTimeout(foco);
      document.body.style.overflow = '';
    };
  }, [aberta, aoFechar]);

  const encontrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return COMANDOS.filter((comando) => {
      const daCategoria = !categoria || comando.categoria === categoria;
      if (!daCategoria) return false;
      if (!termo) return true;
      return (
        comando.texto.toLowerCase().includes(termo) ||
        comando.categoria.toLowerCase().includes(termo)
      );
    });
  }, [busca, categoria]);

  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        onClick={aoFechar}
        aria-label="Fechar a lista de comandos"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Comandos prontos"
        className="relative flex max-h-[88dvh] w-full flex-col rounded-t-xl bg-card shadow-lift"
      >
        <div className="shrink-0 border-b border-border px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-base font-bold">Comandos prontos</h2>
            <button
              type="button"
              onClick={aoFechar}
              className="grid h-10 w-10 place-items-center rounded-full bg-muted"
              aria-label="Fechar"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <input
            ref={campoDeBusca}
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar um comando…"
            aria-label="Buscar um comando"
            className="campo mt-3 bg-muted"
          />

          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            <button
              type="button"
              onClick={() => setCategoria(null)}
              aria-pressed={categoria === null}
              className={`selo shrink-0 ${
                categoria === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              }`}
            >
              Todos
            </button>
            {CATEGORIAS.map((nome) => (
              <button
                key={nome}
                type="button"
                onClick={() => setCategoria(nome === categoria ? null : nome)}
                aria-pressed={categoria === nome}
                className={`selo shrink-0 ${
                  categoria === nome ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>

        <div className="rolagem-suave flex-1 overflow-y-auto px-4 py-3">
          {encontrados.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum comando com essas palavras. Tente buscar por outra coisa.
            </p>
          ) : (
            <ul className="grid gap-2 pb-4">
              {encontrados.map((comando) => (
                <li key={comando.id}>
                  <button
                    type="button"
                    onClick={() => {
                      aoEscolher(comando.texto);
                      aoFechar();
                    }}
                    className="w-full rounded-lg bg-muted p-3 text-left transition hover:bg-accent"
                  >
                    <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {comando.categoria}
                    </span>
                    <span className="block text-sm leading-relaxed">
                      <TextoComColchetes texto={comando.texto} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="shrink-0 border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
          O comando entra no campo de escrita. Troque o que está entre colchetes antes de enviar.
        </p>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import Cabecalho from '../components/Cabecalho';
import type { MapaInfantil } from '../lib/tipos';

type Bloco = { nome: string; mapas: { arquivo: string; titulo: string }[] };

export default function Criancas() {
  const [mapas, setMapas] = useState<MapaInfantil[]>([]);
  const [blocos, setBlocos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [falhou, setFalhou] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    fetch('/data/criancas.json')
      .then((resposta) => {
        if (!resposta.ok) throw new Error('manifesto indisponível');
        return resposta.json() as Promise<{ blocos: Bloco[] }>;
      })
      .then((dados) => {
        if (!ativo) return;
        const lista: MapaInfantil[] = [];
        const nomes: string[] = [];
        for (const bloco of dados.blocos ?? []) {
          nomes.push(bloco.nome);
          for (const mapa of bloco.mapas ?? []) {
            lista.push({ arquivo: mapa.arquivo, titulo: mapa.titulo, bloco: bloco.nome });
          }
        }
        setMapas(lista);
        setBlocos(nomes);
      })
      .catch(() => ativo && setFalhou(true))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  const fechar = useCallback(() => setAberto(null), []);
  const anterior = useCallback(
    () => setAberto((atual) => (atual === null ? null : (atual - 1 + mapas.length) % mapas.length)),
    [mapas.length],
  );
  const proximo = useCallback(
    () => setAberto((atual) => (atual === null ? null : (atual + 1) % mapas.length)),
    [mapas.length],
  );

  return (
    <div className="min-h-[100dvh]">
      <Cabecalho titulo="Mapas para Crianças" descricao="Para aprender em família." />

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <p className="text-sm text-muted-foreground">
          60 mapas ilustrados, em 6 blocos de dez. Toque para ver grande e baixar.
        </p>

        {carregando ? <p className="mt-8 text-sm text-muted-foreground">Carregando os mapas…</p> : null}

        {falhou ? (
          <p role="alert" className="mt-8 rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            Não foi possível carregar a lista de mapas. Atualize a página em um instante.
          </p>
        ) : null}

        {blocos.map((nome) => {
          const doBloco = mapas.filter((mapa) => mapa.bloco === nome);
          if (doBloco.length === 0) return null;
          return (
            <section key={nome} className="mt-8">
              <h2 className="mb-3 font-display text-xl font-bold">{nome}</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {doBloco.map((mapa) => {
                  const indice = mapas.indexOf(mapa);
                  return (
                    <li key={mapa.arquivo}>
                      <button
                        type="button"
                        onClick={() => setAberto(indice)}
                        className="group w-full overflow-hidden rounded-lg bg-card shadow-soft transition hover:shadow-lift"
                        aria-label={`Abrir o mapa ${mapa.titulo}`}
                      >
                        <img
                          src={mapa.arquivo}
                          alt={mapa.titulo}
                          loading="lazy"
                          decoding="async"
                          width={400}
                          height={300}
                          className="aspect-[4/3] w-full bg-muted object-cover"
                        />
                        <span className="block px-3 py-2 text-left text-sm font-medium leading-snug">
                          {mapa.titulo}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>

      {aberto !== null && mapas[aberto] ? (
        <Lightbox
          mapa={mapas[aberto]}
          posicao={aberto + 1}
          total={mapas.length}
          aoFechar={fechar}
          aoAnterior={anterior}
          aoProximo={proximo}
        />
      ) : null}
    </div>
  );
}

function Lightbox({
  mapa,
  posicao,
  total,
  aoFechar,
  aoAnterior,
  aoProximo,
}: {
  mapa: MapaInfantil;
  posicao: number;
  total: number;
  aoFechar: () => void;
  aoAnterior: () => void;
  aoProximo: () => void;
}) {
  const toqueInicial = useRef<number | null>(null);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoFechar();
      if (evento.key === 'ArrowLeft') aoAnterior();
      if (evento.key === 'ArrowRight') aoProximo();
    };
    document.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [aoFechar, aoAnterior, aoProximo]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${mapa.titulo} — mapa ${posicao} de ${total}`}
      className="fixed inset-0 z-50 flex flex-col bg-foreground/90 backdrop-blur-sm"
      onTouchStart={(evento) => {
        toqueInicial.current = evento.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(evento) => {
        const inicio = toqueInicial.current;
        const fim = evento.changedTouches[0]?.clientX;
        toqueInicial.current = null;
        if (inicio === null || fim === undefined) return;
        const diferenca = fim - inicio;
        if (Math.abs(diferenca) < 45) return;
        if (diferenca > 0) aoAnterior();
        else aoProximo();
      }}
    >
      <div className="flex items-center gap-2 px-4 py-3 text-background">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {mapa.titulo} · {posicao} de {total}
        </p>
        <a
          href={mapa.arquivo}
          download
          className="botao-secundario bg-background/15 text-background hover:bg-background/25"
        >
          Baixar
        </a>
        <button
          type="button"
          onClick={aoFechar}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-background/15 text-background"
          aria-label="Fechar"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-2 pb-4">
        <button
          type="button"
          onClick={aoAnterior}
          className="mr-1 hidden h-12 w-12 shrink-0 place-items-center rounded-full bg-background/15 text-background sm:grid"
          aria-label="Mapa anterior"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
          </svg>
        </button>

        <img
          src={mapa.arquivo}
          alt={mapa.titulo}
          className="max-h-full max-w-full rounded-lg bg-card object-contain shadow-lift"
        />

        <button
          type="button"
          onClick={aoProximo}
          className="ml-1 hidden h-12 w-12 shrink-0 place-items-center rounded-full bg-background/15 text-background sm:grid"
          aria-label="Próximo mapa"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <p className="pb-4 text-center text-xs text-background/80 sm:hidden">
        Arraste para o lado para ver o próximo mapa.
      </p>
    </div>
  );
}

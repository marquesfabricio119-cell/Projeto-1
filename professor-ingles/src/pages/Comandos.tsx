import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cabecalho from '../components/Cabecalho';
import TextoComColchetes from '../components/TextoComColchetes';
import { CATEGORIAS, COMANDOS } from '../data/comandos';
import { guardarRascunho } from '../lib/armazenamento';

export default function Comandos() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);

  const encontrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return COMANDOS.filter((comando) => {
      if (categoria && comando.categoria !== categoria) return false;
      if (!termo) return true;
      return (
        comando.texto.toLowerCase().includes(termo) ||
        comando.categoria.toLowerCase().includes(termo)
      );
    });
  }, [busca, categoria]);

  async function copiar(id: number, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Navegador antigo ou sem permissão: copia pelo método da área escondida.
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
        /* não deu: o aluno ainda pode selecionar o texto na tela */
      }
      document.body.removeChild(area);
    }
    setCopiado(id);
    window.setTimeout(() => setCopiado((atual) => (atual === id ? null : atual)), 1600);
  }

  function usarNoChat(texto: string) {
    guardarRascunho(texto);
    navegar('/chat', { state: { comando: texto } });
  }

  return (
    <div className="min-h-[100dvh]">
      <Cabecalho titulo="200 Comandos" descricao="Copie, cole e pronto." />

      <div className="sticky top-[4.25rem] z-20 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <label htmlFor="busca" className="sr-only">
            Buscar um comando
          </label>
          <input
            id="busca"
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar um comando…"
            className="campo"
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
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
          {encontrados.length === 0
            ? 'Nenhum comando com essas palavras.'
            : `${encontrados.length} ${encontrados.length === 1 ? 'comando' : 'comandos'} na lista.`}
        </p>

        <ul className="grid gap-3">
          {encontrados.map((comando) => (
            <li key={comando.id} className="cartao p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {comando.categoria}
              </p>
              <p className="mt-2 text-[0.95rem] leading-relaxed">
                <TextoComColchetes texto={comando.texto} />
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => copiar(comando.id, comando.texto)}
                  className="botao-secundario flex-1"
                >
                  {copiado === comando.id ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  type="button"
                  onClick={() => usarNoChat(comando.texto)}
                  className="botao-primario flex-1"
                >
                  Usar no chat
                </button>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Os trechos entre <span className="font-semibold text-primary">[colchetes]</span> são para
          você trocar pelas suas palavras antes de enviar.
        </p>
      </main>
    </div>
  );
}

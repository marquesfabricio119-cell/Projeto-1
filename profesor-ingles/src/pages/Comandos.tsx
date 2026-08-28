import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Encabezado from '../components/Encabezado'
import TextoComando from '../components/TextoComando'
import BotonCopiar from '../components/BotonCopiar'
import { IconoBuscar } from '../components/Iconos'
import { CATEGORIAS, COMANDOS } from '../data/comandos'
import { guardarBorrador } from '../lib/almacenamiento'

interface Props {
  alSalir: () => void
}

export default function Comandos({ alSalir }: Props) {
  const navegar = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState<string>('Todas')

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return COMANDOS.filter((comando) => {
      if (categoria !== 'Todas' && comando.categoria !== categoria) return false
      if (!texto) return true
      return (
        comando.texto.toLowerCase().includes(texto) ||
        comando.categoria.toLowerCase().includes(texto)
      )
    })
  }, [busqueda, categoria])

  const usarEnElChat = (texto: string) => {
    // Queda listo en el campo del chat; el alumno lo envía cuando quiera.
    guardarBorrador(texto)
    navegar('/chat', { state: { comando: texto } })
  }

  return (
    <div className="min-h-[100dvh]">
      <Encabezado titulo="200 Comandos" alSalir={alSalir} />

      <div className="sticky top-[3.75rem] z-20 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <div className="relative">
            <IconoBuscar className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              className="campo pl-11"
              placeholder="Buscar un comando…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar un comando"
            />
          </div>

          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {['Todas', ...CATEGORIAS].map((nombre) => (
              <button
                key={nombre}
                type="button"
                onClick={() => setCategoria(nombre)}
                aria-pressed={categoria === nombre}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  categoria === nombre
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <p className="text-sm text-muted-foreground">
          Lo que está entre <span className="font-semibold text-primary">[corchetes]</span> lo cambias
          por lo tuyo antes de enviarlo.
        </p>

        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {filtrados.length} {filtrados.length === 1 ? 'comando' : 'comandos'}
        </p>

        {filtrados.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted-foreground">
            No encontramos comandos con esa palabra. Prueba con otra.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {filtrados.map((comando) => (
              <li key={comando.id} className="tarjeta p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {comando.categoria}
                </p>
                <p className="mt-2 text-[0.95rem] leading-relaxed">
                  <TextoComando texto={comando.texto} />
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <BotonCopiar texto={comando.texto} />
                  <button
                    type="button"
                    onClick={() => usarEnElChat(comando.texto)}
                    className="boton-primario px-4 py-2.5 text-sm"
                  >
                    Usar en el chat
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

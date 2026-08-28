import { useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORIAS, COMANDOS } from '../data/comandos'
import TextoComando from './TextoComando'
import { IconoBuscar, IconoCerrar } from './Iconos'

interface Props {
  abierta: boolean
  alCerrar: () => void
  /** Inserta el comando en el campo de texto: NO lo envía. */
  alElegir: (texto: string) => void
}

export default function HojaComandos({ abierta, alCerrar, alElegir }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState<string>('Todas')
  const campoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!abierta) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
    }
    document.addEventListener('keydown', alTeclear)
    const t = window.setTimeout(() => campoRef.current?.focus(), 80)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      window.clearTimeout(t)
    }
  }, [abierta, alCerrar])

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

  if (!abierta) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        onClick={alCerrar}
        aria-label="Cerrar la lista de comandos"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Comandos listos para usar"
        className="relative flex max-h-[85dvh] flex-col rounded-t-2xl bg-background shadow-lift animate-sheet-up"
      >
        <div className="shrink-0 border-b border-border px-4 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/25" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <h2 className="flex-1 font-heading text-base font-bold">Comandos listos para usar</h2>
            <button
              type="button"
              onClick={alCerrar}
              className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground
                transition hover:bg-muted hover:text-foreground"
              aria-label="Cerrar"
            >
              <IconoCerrar />
            </button>
          </div>

          <div className="relative mt-3">
            <IconoBuscar className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={campoRef}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {filtrados.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No encontramos comandos con esa palabra. Prueba con otra.
            </p>
          ) : (
            <ul className="space-y-2.5 pb-4">
              {filtrados.map((comando) => (
                <li key={comando.id}>
                  <button
                    type="button"
                    onClick={() => {
                      alElegir(comando.texto)
                      alCerrar()
                    }}
                    className="tarjeta w-full p-4 text-left transition hover:shadow-lift active:scale-[0.99]"
                  >
                    <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {comando.categoria}
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed">
                      <TextoComando texto={comando.texto} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Encabezado from '../components/Encabezado'
import { IconoAdelante, IconoAtras, IconoCerrar, IconoDescargar } from '../components/Iconos'
import type { BloqueNinos, MapaNino } from '../lib/tipos'

interface Props {
  alSalir: () => void
}

interface MapaConBloque extends MapaNino {
  bloque: string
  indice: number
}

export default function Ninos({ alSalir }: Props) {
  const [bloques, setBloques] = useState<BloqueNinos[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const [abierto, setAbierto] = useState<number | null>(null)

  useEffect(() => {
    let vigente = true
    fetch('/data/ninos.json')
      .then((r) => {
        if (!r.ok) throw new Error('manifiesto no disponible')
        return r.json()
      })
      .then((datos: BloqueNinos[]) => {
        if (vigente) setBloques(Array.isArray(datos) ? datos : [])
      })
      .catch(() => {
        if (vigente) setFallo(true)
      })
    return () => {
      vigente = false
    }
  }, [])

  const todos = useMemo<MapaConBloque[]>(() => {
    if (!bloques) return []
    const lista: MapaConBloque[] = []
    for (const bloque of bloques) {
      for (const mapa of bloque.mapas ?? []) {
        lista.push({ ...mapa, bloque: bloque.bloque, indice: lista.length })
      }
    }
    return lista
  }, [bloques])

  const cerrar = useCallback(() => setAbierto(null), [])
  const mover = useCallback(
    (paso: number) => {
      setAbierto((actual) => {
        if (actual === null || todos.length === 0) return actual
        return (actual + paso + todos.length) % todos.length
      })
    },
    [todos.length],
  )

  return (
    <div className="min-h-[100dvh]">
      <Encabezado titulo="Mapas para Niños" alSalir={alSalir} />

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          60 mapas ilustrados para imprimir y colorear en familia. Toca uno para verlo grande y
          descargarlo.
        </p>

        {fallo && (
          <p role="alert" className="mt-5 rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            No pudimos cargar la galería. Recarga la página, por favor.
          </p>
        )}

        {!bloques && !fallo && (
          <p className="mt-6 text-sm text-muted-foreground">Cargando los mapas…</p>
        )}

        {bloques?.map((bloque) => (
          <section key={bloque.bloque} className="mt-8">
            <h2 className="font-heading text-lg font-bold sm:text-xl">{bloque.bloque}</h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {bloque.mapas.map((mapa) => {
                const global = todos.find((m) => m.archivo === mapa.archivo)
                return (
                  <li key={mapa.archivo}>
                    <button
                      type="button"
                      onClick={() => setAbierto(global?.indice ?? 0)}
                      className="tarjeta w-full overflow-hidden p-0 text-left transition
                        hover:shadow-lift active:scale-[0.99]"
                      aria-label={`Ver el mapa ${mapa.titulo}`}
                    >
                      <Miniatura mapa={mapa} />
                      <span className="block px-3 py-2.5 text-xs font-medium leading-snug">
                        {mapa.titulo}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </main>

      {abierto !== null && todos[abierto] && (
        <Visor mapa={todos[abierto]} alCerrar={cerrar} alMover={mover} total={todos.length} />
      )}
    </div>
  )
}

function Miniatura({ mapa }: { mapa: MapaNino }) {
  const [sinImagen, setSinImagen] = useState(false)

  // Mientras el mapa no esté subido a /public/ninos, se ve un marcador suave
  // en lugar de un ícono de imagen rota.
  if (sinImagen) {
    return (
      <span className="flex aspect-square w-full items-center justify-center bg-accent">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
          className="h-9 w-9 text-accent-foreground/45"
        >
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="M4 17l4.5-4.5 3.5 3.5 3-2.5L20 17" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    )
  }

  return (
    <img
      src={mapa.archivo}
      alt={mapa.titulo}
      loading="lazy"
      decoding="async"
      width={400}
      height={400}
      onError={() => setSinImagen(true)}
      className="aspect-square w-full bg-muted object-cover"
    />
  )
}

interface PropsVisor {
  mapa: MapaConBloque
  total: number
  alCerrar: () => void
  alMover: (paso: number) => void
}

function Visor({ mapa, total, alCerrar, alMover }: PropsVisor) {
  const inicioX = useRef<number | null>(null)
  const [sinImagen, setSinImagen] = useState(false)

  useEffect(() => setSinImagen(false), [mapa.archivo])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
      else if (e.key === 'ArrowRight') alMover(1)
      else if (e.key === 'ArrowLeft') alMover(-1)
    }
    document.addEventListener('keydown', alTeclear)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflowPrevio
    }
  }, [alCerrar, alMover])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${mapa.titulo} — ${mapa.bloque}`}
      className="fixed inset-0 z-50 flex flex-col bg-foreground/90 backdrop-blur-sm"
      onTouchStart={(e) => {
        inicioX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        if (inicioX.current === null) return
        const distancia = (e.changedTouches[0]?.clientX ?? inicioX.current) - inicioX.current
        inicioX.current = null
        if (Math.abs(distancia) > 45) alMover(distancia < 0 ? 1 : -1)
      }}
    >
      <div className="flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-background">
        <p className="min-w-0 flex-1 truncate font-heading text-sm font-semibold">
          {mapa.titulo} · {mapa.bloque}
        </p>
        <a
          href={mapa.archivo}
          download
          className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium
            transition hover:bg-background/15"
        >
          <IconoDescargar className="h-4 w-4" />
          Descargar
        </a>
        <button
          type="button"
          onClick={alCerrar}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg transition hover:bg-background/15"
          aria-label="Cerrar"
        >
          <IconoCerrar />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-3">
        {sinImagen ? (
          <div className="grid aspect-square w-full max-w-md place-items-center rounded-lg bg-accent px-6 text-center">
            <p className="font-heading text-xl font-bold text-accent-foreground">{mapa.titulo}</p>
          </div>
        ) : (
          <img
            src={mapa.archivo}
            alt={mapa.titulo}
            onError={() => setSinImagen(true)}
            className="max-h-full max-w-full rounded-lg bg-card object-contain"
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-background">
        <button
          type="button"
          onClick={() => alMover(-1)}
          className="grid h-12 w-12 place-items-center rounded-full bg-background/15 transition hover:bg-background/25"
          aria-label="Mapa anterior"
        >
          <IconoAtras className="h-6 w-6" />
        </button>
        <span className="text-sm font-medium">
          {mapa.indice + 1} de {total}
        </span>
        <button
          type="button"
          onClick={() => alMover(1)}
          className="grid h-12 w-12 place-items-center rounded-full bg-background/15 transition hover:bg-background/25"
          aria-label="Mapa siguiente"
        >
          <IconoAdelante className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}

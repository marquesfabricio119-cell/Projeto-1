import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import BotonTema from './BotonTema'
import Marca from './Marca'
import { IconoAtras, IconoSalir } from './Iconos'

interface Props {
  titulo?: string
  /** Muestra la flecha para volver al inicio. */
  conVolver?: boolean
  alSalir: () => void
  /** Botones extra a la derecha del título (por ejemplo, en el chat). */
  acciones?: ReactNode
}

export default function Encabezado({ titulo, conVolver = true, alSalir, acciones }: Props) {
  // Con acciones extra el espacio a 360 px es justo: el tema pasa a escritorio.
  const conMuchosBotones = Boolean(acciones)
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-3 py-2.5 sm:gap-2 sm:px-4">
        {conVolver ? (
          <Link
            to="/"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted-foreground
              transition hover:bg-muted hover:text-foreground"
            aria-label="Volver al inicio"
          >
            <IconoAtras />
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          {titulo ? (
            <h1 className="truncate font-heading text-base font-bold sm:text-lg">{titulo}</h1>
          ) : (
            <Marca />
          )}
        </div>

        {acciones}
        <BotonTema soloEscritorio={conMuchosBotones} />
        <button
          type="button"
          onClick={alSalir}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium
            text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <IconoSalir className="h-4 w-4" />
          <span>Salir</span>
        </button>
      </div>
    </header>
  )
}

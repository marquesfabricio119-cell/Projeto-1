import { useEffect, useState } from 'react'
import { guardarTema, obtenerTema, type Tema } from '../lib/almacenamiento'
import { IconoLuna, IconoSol } from './Iconos'

interface Props {
  /** En pantallas chicas con muchos botones (el chat) se oculta. */
  soloEscritorio?: boolean
}

export default function BotonTema({ soloEscritorio = false }: Props) {
  const [tema, setTema] = useState<Tema>(() => obtenerTema())

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro')
  }, [tema])

  const cambiar = () => {
    const nuevo: Tema = tema === 'oscuro' ? 'claro' : 'oscuro'
    setTema(nuevo)
    guardarTema(nuevo)
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      className={`${soloEscritorio ? 'hidden sm:grid' : 'grid'} h-10 w-10 place-items-center
        rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground`}
      aria-label={tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {tema === 'oscuro' ? <IconoSol /> : <IconoLuna />}
    </button>
  )
}

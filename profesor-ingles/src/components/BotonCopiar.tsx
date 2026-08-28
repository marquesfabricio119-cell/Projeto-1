import { useEffect, useRef, useState } from 'react'
import { IconoCheck, IconoCopiar } from './Iconos'

interface Props {
  texto: string
  className?: string
  etiqueta?: string
}

async function copiar(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    /* seguimos con el plan B */
  }
  // Plan B para navegadores viejos o páginas sin permiso de portapapeles.
  try {
    const area = document.createElement('textarea')
    area.value = texto
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const listo = document.execCommand('copy')
    document.body.removeChild(area)
    return listo
  } catch {
    return false
  }
}

export default function BotonCopiar({ texto, className, etiqueta = 'Copiar' }: Props) {
  const [copiado, setCopiado] = useState(false)
  const temporizador = useRef<number>()

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  const alHacerClic = async () => {
    const listo = await copiar(texto)
    if (!listo) return
    setCopiado(true)
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => setCopiado(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={alHacerClic}
      className={className ?? 'boton-suave'}
      aria-live="polite"
    >
      {copiado ? <IconoCheck className="h-4 w-4" /> : <IconoCopiar className="h-4 w-4" />}
      {copiado ? '¡Copiado!' : etiqueta}
    </button>
  )
}

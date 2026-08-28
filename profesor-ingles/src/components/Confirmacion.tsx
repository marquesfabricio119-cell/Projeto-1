import { useEffect } from 'react'

interface Props {
  abierta: boolean
  titulo: string
  textoConfirmar: string
  textoCancelar?: string
  alConfirmar: () => void
  alCancelar: () => void
}

export default function Confirmacion({
  abierta,
  titulo,
  textoConfirmar,
  textoCancelar = 'Mejor no',
  alConfirmar,
  alCancelar,
}: Props) {
  useEffect(() => {
    if (!abierta) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCancelar()
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [abierta, alCancelar])

  if (!abierta) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        onClick={alCancelar}
        aria-label="Cancelar"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
        className="tarjeta relative w-full max-w-sm p-5 shadow-lift animate-fade-up"
      >
        <p className="font-heading text-base font-bold leading-snug">{titulo}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={alConfirmar} className="boton-primario flex-1">
            {textoConfirmar}
          </button>
          <button type="button" onClick={alCancelar} className="boton-suave flex-1 py-3">
            {textoCancelar}
          </button>
        </div>
      </div>
    </div>
  )
}

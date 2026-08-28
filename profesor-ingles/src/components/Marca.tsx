interface Props {
  /** Muestra la bajada "Tu Profesor con IA" debajo del nombre. */
  conBajada?: boolean
  centrado?: boolean
}

export default function Marca({ conBajada = false, centrado = false }: Props) {
  return (
    <div className={centrado ? 'flex flex-col items-center text-center' : 'flex flex-col'}>
      <div className={`flex items-center gap-2.5 ${centrado ? 'justify-center' : ''}`}>
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary font-heading
            text-lg font-extrabold text-primary-foreground shadow-soft"
        >
          IV
        </span>
        <span className="font-heading text-lg font-extrabold leading-none tracking-tight sm:text-xl">
          Idioma Visual
        </span>
      </div>
      {conBajada && (
        <p className="mt-2 font-heading text-sm font-semibold text-muted-foreground">
          Tu Profesor con IA
        </p>
      )}
    </div>
  )
}

import { useState } from 'react'
import type { Perfil } from '../lib/tipos'
import { IconoAtras } from './Iconos'

interface Paso {
  pregunta: string
  ayuda: string
  opciones: string[]
  clave: 'nivel' | 'objetivo' | 'tiempo' | 'dificultad'
  conOtra?: boolean
}

const PASOS: Paso[] = [
  {
    pregunta: '¿Qué tanto inglés sabes?',
    ayuda: 'No hay respuesta mala. Sirve para que el profesor te hable a tu medida.',
    opciones: ['Nada', 'Entiendo pero no hablo', 'Me defiendo', 'Bastante'],
    clave: 'nivel',
  },
  {
    pregunta: '¿Para qué lo necesitas?',
    ayuda: 'Así las prácticas van de lo que de verdad vas a usar.',
    opciones: ['Trabajo', 'Viaje', 'Estudio', 'Mudarme', 'Gusto personal'],
    clave: 'objetivo',
  },
  {
    pregunta: '¿Cuántos minutos al día tienes?',
    ayuda: 'Con poquito todos los días alcanza. El profesor ajusta el tamaño de la clase.',
    opciones: ['5', '10', '15', '30 o más'],
    clave: 'tiempo',
  },
  {
    pregunta: '¿Qué es lo que más se te dificulta?',
    ayuda: 'Aquí es donde vamos a poner el esfuerzo.',
    opciones: ['Hablar', 'Entender cuando me hablan', 'Gramática', 'Vocabulario', 'Pronunciación'],
    clave: 'dificultad',
    conOtra: true,
  },
]

interface Props {
  perfilInicial?: Perfil | null
  alGuardar: (perfil: Omit<Perfil, 'actualizado'>) => void
  alCancelar?: () => void
}

export default function AsistentePerfil({ perfilInicial, alGuardar, alCancelar }: Props) {
  const [indice, setIndice] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<Paso['clave'], string>>({
    nivel: perfilInicial?.nivel ?? '',
    objetivo: perfilInicial?.objetivo ?? '',
    tiempo: perfilInicial?.tiempo.replace(/\s*minutos?$/i, '') ?? '',
    dificultad: perfilInicial?.dificultad ?? '',
  })
  const [otra, setOtra] = useState('')

  const paso = PASOS[indice]
  const esUltimo = indice === PASOS.length - 1

  const terminar = (respuestasFinales: Record<Paso['clave'], string>) => {
    alGuardar({
      nivel: respuestasFinales.nivel,
      objetivo: respuestasFinales.objetivo,
      // Se guarda con la palabra "minutos" para que el prompt se lea bien.
      tiempo: respuestasFinales.tiempo ? `${respuestasFinales.tiempo} minutos` : '',
      dificultad: respuestasFinales.dificultad,
    })
  }

  const responder = (valor: string) => {
    const siguientes = { ...respuestas, [paso.clave]: valor }
    setRespuestas(siguientes)
    if (esUltimo) terminar(siguientes)
    else setIndice(indice + 1)
  }

  const guardarOtra = () => {
    const texto = otra.trim()
    if (!texto) return
    responder(texto.slice(0, 80))
  }

  const tiempoConSufijo = (opcion: string) =>
    paso.clave === 'tiempo' ? `${opcion} min` : opcion

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <div className="tarjeta p-5 sm:p-7">
        <div className="flex items-center gap-3">
          {indice > 0 ? (
            <button
              type="button"
              onClick={() => setIndice(indice - 1)}
              className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground
                transition hover:bg-muted hover:text-foreground"
              aria-label="Volver a la pregunta anterior"
            >
              <IconoAtras />
            </button>
          ) : null}
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pregunta {indice + 1} de {PASOS.length}
          </p>
        </div>

        <h2 className="mt-4 font-heading text-xl font-extrabold leading-snug sm:text-2xl">
          {paso.pregunta}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{paso.ayuda}</p>

        <div className="mt-6 grid gap-2.5">
          {paso.opciones.map((opcion) => {
            const activa = respuestas[paso.clave] === opcion
            return (
              <button
                key={opcion}
                type="button"
                onClick={() => responder(opcion)}
                aria-pressed={activa}
                className={`w-full rounded-lg px-4 py-4 text-left font-heading text-base font-semibold
                  transition active:scale-[0.99] ${
                    activa
                      ? 'bg-primary text-primary-foreground shadow-soft'
                      : 'bg-muted text-foreground hover:bg-accent'
                  }`}
              >
                {tiempoConSufijo(opcion)}
              </button>
            )
          })}
        </div>

        {paso.conOtra && (
          <div className="mt-4">
            <label htmlFor="otra-dificultad" className="etiqueta">
              Otra cosa…
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="otra-dificultad"
                type="text"
                className="campo"
                placeholder="Escríbelo con tus palabras"
                maxLength={80}
                value={otra}
                onChange={(e) => setOtra(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    guardarOtra()
                  }
                }}
              />
              <button
                type="button"
                onClick={guardarOtra}
                disabled={!otra.trim()}
                className="boton-primario shrink-0 px-4 py-3 text-sm"
              >
                Listo
              </button>
            </div>
          </div>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          <div className="flex gap-2" role="presentation">
            {PASOS.map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-2 rounded-full transition-all ${
                  i === indice ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          {alCancelar && (
            <button
              type="button"
              onClick={alCancelar}
              className="text-sm font-medium text-muted-foreground underline underline-offset-4
                transition hover:text-foreground"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

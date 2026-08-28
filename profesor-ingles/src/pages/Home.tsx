import { Link } from 'react-router-dom'
import Encabezado from '../components/Encabezado'
import { obtenerConteo } from '../lib/almacenamiento'

interface Props {
  nombre: string
  alSalir: () => void
}

interface Tarjeta {
  titulo: string
  descripcion: string
  ruta: string
  emoji: string
}

const TARJETAS: Tarjeta[] = [
  {
    titulo: 'El Profesor',
    descripcion: 'Conversa, te corrige y te explica en español.',
    ruta: '/chat',
    emoji: '💬',
  },
  {
    titulo: '200 Comandos',
    descripcion: 'Copia, pega y listo. No necesitas saber usar IA.',
    ruta: '/comandos',
    emoji: '📋',
  },
  {
    titulo: 'Mapas para Niños',
    descripcion: '60 mapas ilustrados para aprender en familia.',
    ruta: '/ninos',
    emoji: '🎨',
  },
  {
    titulo: 'Guía de Uso',
    descripcion: 'Cómo aprovecharlo en 10 minutos al día.',
    ruta: '/guia',
    emoji: '🧭',
  },
]

export default function Home({ nombre, alSalir }: Props) {
  const conteo = obtenerConteo()

  return (
    <div className="min-h-[100dvh]">
      <Encabezado conVolver={false} alSalir={alSalir} />

      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:pt-10">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">
          {nombre ? `¡Hola, ${nombre}!` : '¡Hola!'}
        </h1>
        <p className="mt-1.5 text-base text-muted-foreground">
          Tu profesor está listo. ¿Empezamos?
        </p>

        <div className="mt-7 grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
          {TARJETAS.map((tarjeta) => (
            <Link
              key={tarjeta.ruta}
              to={tarjeta.ruta}
              className="tarjeta group flex items-start gap-4 p-5 transition
                hover:shadow-lift active:scale-[0.99] sm:flex-col sm:gap-3 sm:p-6"
            >
              <span
                aria-hidden="true"
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-2xl"
              >
                {tarjeta.emoji}
              </span>
              <span className="min-w-0">
                <span className="block font-heading text-lg font-bold sm:text-xl">
                  {tarjeta.titulo}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {tarjeta.descripcion}
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-lg bg-muted px-4 py-3.5">
          {conteo === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Todavía no hablas con el profesor. La primera vez te hace 4 preguntas rápidas.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">
                Llevas {conteo} {conteo === 1 ? 'conversación' : 'conversaciones'} con el profesor
              </p>
              <div
                className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-background"
                role="progressbar"
                aria-valuenow={Math.min(conteo, 30)}
                aria-valuemin={0}
                aria-valuemax={30}
                aria-label="Conversaciones con el profesor"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (conteo / 30) * 100)}%` }}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

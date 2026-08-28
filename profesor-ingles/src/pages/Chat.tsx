import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Encabezado from '../components/Encabezado'
import AsistentePerfil from '../components/AsistentePerfil'
import HojaComandos from '../components/HojaComandos'
import Confirmacion from '../components/Confirmacion'
import TextoMensaje from '../components/TextoMensaje'
import { IconoEnviar, IconoMas, IconoReiniciar, IconoUsuario } from '../components/Iconos'
import { enviarAlProfesor } from '../lib/profesor'
import type { Mensaje, Perfil } from '../lib/tipos'
import {
  guardarConversacion,
  guardarPerfil,
  limpiarConversacion,
  obtenerConversacion,
  obtenerIdSesion,
  obtenerPerfil,
  sumarConversacion,
  tomarBorrador,
} from '../lib/almacenamiento'

const SUGERENCIAS = [
  'Quiero practicar una conversación de nivel principiante',
  'Corrige este texto que escribí en inglés',
  'Explícame cuándo uso do y cuándo uso does',
  'Hazme una entrevista de trabajo en inglés',
]

function nuevoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

interface Props {
  alSalir: () => void
}

export default function Chat({ alSalir }: Props) {
  const navegar = useNavigate()
  const ubicacion = useLocation()

  const [perfil, setPerfil] = useState<Perfil | null>(() => obtenerPerfil())
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>(() => obtenerConversacion())
  const [entrada, setEntrada] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const [confirmarNueva, setConfirmarNueva] = useState(false)

  const finRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const idSesion = useMemo(() => obtenerIdSesion(), [])

  /* Texto que viene de /comandos: se coloca en el campo, NO se envía. */
  useEffect(() => {
    const desdeNavegacion = (ubicacion.state as { comando?: string } | null)?.comando
    const pendiente = desdeNavegacion ?? tomarBorrador()
    if (pendiente) {
      setEntrada(pendiente)
      if (desdeNavegacion) navegar('.', { replace: true, state: null })
      window.setTimeout(() => {
        const area = areaRef.current
        if (!area) return
        area.focus()
        area.setSelectionRange(area.value.length, area.value.length)
        ajustarAltura(area)
      }, 60)
    }
    // Solo al montar la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    guardarConversacion(mensajes)
  }, [mensajes])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensajes, enviando])

  const ajustarAltura = (area: HTMLTextAreaElement) => {
    area.style.height = 'auto'
    area.style.height = `${Math.min(area.scrollHeight, 160)}px`
  }

  const enviar = useCallback(
    async (textoCrudo: string) => {
      const texto = textoCrudo.trim()
      if (!texto || enviando) return

      setError('')
      const delAlumno: Mensaje = { id: nuevoId(), autor: 'alumno', texto }
      const delProfesor: Mensaje = { id: nuevoId(), autor: 'profesor', texto: '' }

      // Primera pregunta de una conversación nueva: suma al contador del inicio.
      if (mensajes.length === 0) sumarConversacion()

      const historia = [...mensajes, delAlumno]
      setMensajes([...historia, delProfesor])
      setEntrada('')
      if (areaRef.current) {
        areaRef.current.style.height = 'auto'
      }
      setEnviando(true)

      try {
        await enviarAlProfesor({
          mensajes: historia,
          perfil,
          idSesion,
          onFragmento: (fragmento) => {
            setMensajes((previos) =>
              previos.map((m) => (m.id === delProfesor.id ? { ...m, texto: m.texto + fragmento } : m)),
            )
          },
        })
        setMensajes((previos) => previos.filter((m) => m.id !== delProfesor.id || m.texto.trim() !== ''))
      } catch (fallo) {
        const mensaje = fallo instanceof Error ? fallo.message : 'El profesor no pudo responder ahora. Intenta de nuevo en un momento.'
        setError(mensaje)
        setMensajes((previos) => previos.filter((m) => m.id !== delProfesor.id || m.texto.trim() !== ''))
      } finally {
        setEnviando(false)
      }
    },
    [enviando, idSesion, mensajes, perfil],
  )

  const empezarDeCero = () => {
    limpiarConversacion()
    setMensajes([])
    setError('')
    setConfirmarNueva(false)
  }

  const guardarNuevoPerfil = (datos: Omit<Perfil, 'actualizado'>) => {
    setPerfil(guardarPerfil(datos))
    setEditandoPerfil(false)
  }

  /* Primera visita: el asistente de 4 preguntas. */
  if (!perfil || editandoPerfil) {
    return (
      <div className="min-h-[100dvh]">
        <Encabezado titulo="El Profesor" alSalir={alSalir} />
        <main>
          <AsistentePerfil
            perfilInicial={perfil}
            alGuardar={guardarNuevoPerfil}
            alCancelar={perfil ? () => setEditandoPerfil(false) : undefined}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <Encabezado
        titulo="El Profesor"
        alSalir={alSalir}
        acciones={
          <>
            <button
              type="button"
              onClick={() => setEditandoPerfil(true)}
              className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground
                transition hover:bg-muted hover:text-foreground"
              aria-label="Editar mi perfil"
              title="Editar mi perfil"
            >
              <IconoUsuario />
            </button>
            <button
              type="button"
              onClick={() => setConfirmarNueva(true)}
              className="grid h-10 w-10 place-items-center rounded-lg text-muted-foreground
                transition hover:bg-muted hover:text-foreground"
              aria-label="Nueva conversación"
              title="Nueva conversación"
            >
              <IconoReiniciar />
            </button>
          </>
        }
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-5">
          {mensajes.length === 0 ? (
            <div className="pb-2">
              <div className="tarjeta p-5">
                <h2 className="font-heading text-lg font-bold">Hola, soy Alex 👋</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Escríbeme en inglés o en español, como te salga. Te contesto, te corrijo lo
                  importante y te explico en español. ¿Con qué empezamos?
                </p>
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Puedes empezar por aquí
              </p>
              <div className="mt-3 grid gap-2.5">
                {SUGERENCIAS.map((sugerencia) => (
                  <button
                    key={sugerencia}
                    type="button"
                    onClick={() => enviar(sugerencia)}
                    className="rounded-lg bg-muted px-4 py-3 text-left text-sm font-medium
                      transition hover:bg-accent active:scale-[0.99]"
                  >
                    {sugerencia}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-3.5" aria-live="polite" aria-relevant="additions text">
              {mensajes.map((mensaje) => (
                <li
                  key={mensaje.id}
                  className={mensaje.autor === 'alumno' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-3 shadow-soft animate-fade-up sm:max-w-[75%] ${
                      mensaje.autor === 'alumno'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-card-foreground'
                    }`}
                  >
                    <span className="sr-only">
                      {mensaje.autor === 'alumno' ? 'Tú: ' : 'El profesor: '}
                    </span>
                    {mensaje.texto ? (
                      <TextoMensaje texto={mensaje.texto} />
                    ) : (
                      <IndicadorEscribiendo />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <div ref={finRef} className="h-2" />
        </div>
      </main>

      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              enviar(entrada)
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            {/* En el teléfono va arriba: así el campo de texto usa todo el ancho. */}
            <button
              type="button"
              onClick={() => setHojaAbierta(true)}
              className="flex h-9 shrink-0 items-center gap-1 self-start rounded-lg bg-muted px-3
                text-sm font-medium transition hover:bg-accent active:scale-[0.98]
                sm:h-11 sm:self-auto"
              aria-label="Abrir la lista de comandos"
            >
              <IconoMas className="h-4 w-4" />
              <span>Comandos</span>
            </button>

            <div className="flex flex-1 items-end gap-2">
            <textarea
              ref={areaRef}
              value={entrada}
              onChange={(e) => {
                setEntrada(e.target.value)
                ajustarAltura(e.target)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  enviar(entrada)
                }
              }}
              rows={1}
              // El texto que escribe el alumno se queda en 16 px (evita el zoom
              // automático de iOS); solo la ayuda gris se achica para caber a 360 px.
              className="campo max-h-40 min-h-[2.75rem] flex-1 resize-none py-3 placeholder:text-[0.9rem]"
              placeholder="Escribe en inglés o en español…"
              aria-label="Tu mensaje para el profesor"
            />

            <button
              type="submit"
              disabled={!entrada.trim() || enviando}
              className="boton-primario h-11 w-11 shrink-0 p-0"
              aria-label="Enviar mensaje"
            >
              <IconoEnviar />
            </button>
            </div>
          </form>
        </div>
      </div>

      <HojaComandos
        abierta={hojaAbierta}
        alCerrar={() => setHojaAbierta(false)}
        alElegir={(texto) => {
          setEntrada(texto)
          window.setTimeout(() => {
            const area = areaRef.current
            if (!area) return
            area.focus()
            area.setSelectionRange(area.value.length, area.value.length)
            ajustarAltura(area)
          }, 60)
        }}
      />

      <Confirmacion
        abierta={confirmarNueva}
        titulo="¿Empezar de cero? Se borra esta conversación."
        textoConfirmar="Sí, empezar de cero"
        alConfirmar={empezarDeCero}
        alCancelar={() => setConfirmarNueva(false)}
      />
    </div>
  )
}

function IndicadorEscribiendo() {
  return (
    <span className="flex items-center gap-1.5 py-1" role="status" aria-label="El profesor está escribiendo">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground animate-dot-bounce"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  )
}

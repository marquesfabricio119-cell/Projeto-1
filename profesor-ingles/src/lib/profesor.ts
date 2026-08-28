/**
 * Cliente del chat. Habla únicamente con /api/chat: el navegador nunca ve
 * la llave del proveedor ni la dirección del modelo.
 */
import type { Mensaje, Perfil } from './tipos'

export const ERROR_GENERICO = 'El profesor no pudo responder ahora. Intenta de nuevo en un momento.'

export interface OpcionesEnvio {
  mensajes: Mensaje[]
  perfil: Perfil | null
  idSesion: string
  onFragmento: (texto: string) => void
  signal?: AbortSignal
}

function aFormatoApi(mensajes: Mensaje[]) {
  return mensajes
    .filter((m) => !m.error && m.texto.trim().length > 0)
    .map((m) => ({
      role: m.autor === 'alumno' ? ('user' as const) : ('assistant' as const),
      content: m.texto,
    }))
}

export async function enviarAlProfesor({
  mensajes,
  perfil,
  idSesion,
  onFragmento,
  signal,
}: OpcionesEnvio): Promise<void> {
  let respuesta: Response
  try {
    respuesta = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        messages: aFormatoApi(mensajes),
        perfil: perfil
          ? {
              nivel: perfil.nivel,
              objetivo: perfil.objetivo,
              tiempo: perfil.tiempo,
              dificultad: perfil.dificultad,
            }
          : null,
        sessionId: idSesion,
      }),
    })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error
    throw new Error('No hay conexión con el profesor. Revisa tu internet e intenta otra vez.')
  }

  const tipo = respuesta.headers.get('content-type') ?? ''

  // Errores previos al streaming (límite por hora, petición inválida, etc.).
  if (!tipo.includes('text/event-stream')) {
    let mensaje = ERROR_GENERICO
    try {
      const datos = await respuesta.json()
      if (typeof datos?.error === 'string' && datos.error.trim()) mensaje = datos.error
    } catch {
      /* nos quedamos con el mensaje genérico */
    }
    throw new Error(mensaje)
  }

  if (!respuesta.body) throw new Error(ERROR_GENERICO)

  const lector = respuesta.body.getReader()
  const decodificador = new TextDecoder()
  let buffer = ''
  let errorDelServidor: string | null = null

  while (true) {
    const { done, value } = await lector.read()
    if (done) break
    buffer += decodificador.decode(value, { stream: true })

    let corte: number
    while ((corte = buffer.indexOf('\n')) !== -1) {
      const linea = buffer.slice(0, corte).trim()
      buffer = buffer.slice(corte + 1)
      if (!linea.startsWith('data:')) continue

      const carga = linea.slice(5).trim()
      if (!carga) continue

      let evento: { type?: string; text?: string; message?: string }
      try {
        evento = JSON.parse(carga)
      } catch {
        continue
      }

      if (evento.type === 'delta' && typeof evento.text === 'string') {
        onFragmento(evento.text)
      } else if (evento.type === 'error') {
        errorDelServidor = evento.message || ERROR_GENERICO
      }
    }
  }

  if (errorDelServidor) throw new Error(errorDelServidor)
}

/**
 * Único punto de contacto con el proveedor del modelo.
 * Cambiar de proveedor = cambiar solo este archivo.
 *
 * La llave se lee de una variable de entorno del SERVIDOR (ANTHROPIC_API_KEY).
 * Nunca se expone al navegador ni viaja en ninguna respuesta.
 */

export interface MensajeChat {
  role: 'user' | 'assistant'
  content: string
}

export interface OpcionesStream {
  system: string
  messages: MensajeChat[]
  maxTokens: number
  signal?: AbortSignal
}

export class ProviderError extends Error {
  readonly status: number
  constructor(message: string, status = 502) {
    super(message)
    this.name = 'ProviderError'
    this.status = status
  }
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

/** Permite apuntar a un gateway propio o a un servidor de pruebas. */
function urlDelProveedor(): string {
  return process.env.LLM_BASE_URL?.trim() || ANTHROPIC_URL
}
const ANTHROPIC_VERSION = '2023-06-01'

/** Modelo por defecto; se puede sobreescribir con LLM_MODEL. */
export const MODELO_POR_DEFECTO = 'claude-sonnet-5'

export function modeloActivo(): string {
  return process.env.LLM_MODEL?.trim() || MODELO_POR_DEFECTO
}

/**
 * Envía la conversación al modelo y devuelve los fragmentos de texto
 * a medida que llegan (token por token).
 */
export async function* streamChat(opciones: OpcionesStream): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new ProviderError('Falta la variable de entorno ANTHROPIC_API_KEY en el servidor.', 500)
  }

  const respuesta = await fetch(urlDelProveedor(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    signal: opciones.signal,
    body: JSON.stringify({
      model: modeloActivo(),
      max_tokens: opciones.maxTokens,
      stream: true,
      system: opciones.system,
      messages: opciones.messages,
    }),
  })

  if (!respuesta.ok || !respuesta.body) {
    // El cuerpo del error puede traer datos del proveedor: se registra en el
    // servidor, pero nunca se reenvía al cliente.
    const detalle = await respuesta.text().catch(() => '')
    throw new ProviderError(
      `El proveedor respondió ${respuesta.status}: ${detalle.slice(0, 500)}`,
      respuesta.status,
    )
  }

  const lector = respuesta.body.getReader()
  const decodificador = new TextDecoder()
  let buffer = ''

  try {
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
        if (!carga || carga === '[DONE]') continue

        let evento: any
        try {
          evento = JSON.parse(carga)
        } catch {
          continue
        }

        if (evento.type === 'content_block_delta' && evento.delta?.type === 'text_delta') {
          const texto = evento.delta.text
          if (typeof texto === 'string' && texto.length > 0) yield texto
        } else if (evento.type === 'error') {
          throw new ProviderError(evento.error?.message ?? 'Error del proveedor', 502)
        }
      }
    }
  } finally {
    await lector.cancel().catch(() => undefined)
  }
}

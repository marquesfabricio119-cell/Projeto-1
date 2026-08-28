import type { IncomingMessage, ServerResponse } from 'node:http'
import { construirSystemPrompt, type Perfil } from './_lib/systemPrompt'
import { ProviderError, streamChat, type MensajeChat } from './_lib/provider'
import { mensajeLimite, verificarLimite } from './_lib/rateLimit'

/**
 * Proxy del modelo. El navegador habla SOLO con esta función; la llave del
 * proveedor vive en process.env y nunca sale de aquí.
 */

type Peticion = IncomingMessage & { body?: unknown }
type Respuesta = ServerResponse

/** Tope duro de tokens de salida por petición. */
const MAX_TOKENS = 4000
/** Cuántos turnos de la conversación se mandan como contexto. */
const MAX_MENSAJES = 30
/** Largo máximo de cada mensaje, en caracteres. */
const MAX_LARGO_MENSAJE = 6000

export const ERROR_GENERICO = 'El profesor no pudo responder ahora. Intenta de nuevo en un momento.'

async function leerCuerpo(req: Peticion): Promise<any> {
  // En Vercel el cuerpo JSON ya viene parseado; en el servidor de desarrollo, no.
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }

  const trozos: Buffer[] = []
  let total = 0
  for await (const trozo of req) {
    const buf = Buffer.isBuffer(trozo) ? trozo : Buffer.from(trozo)
    total += buf.length
    if (total > 512 * 1024) throw new ProviderError('Cuerpo demasiado grande', 413)
    trozos.push(buf)
  }
  if (trozos.length === 0) return null
  try {
    return JSON.parse(Buffer.concat(trozos).toString('utf8'))
  } catch {
    return null
  }
}

function normalizarMensajes(entrada: unknown): MensajeChat[] {
  if (!Array.isArray(entrada)) return []
  const limpios: MensajeChat[] = []
  for (const item of entrada) {
    if (!item || typeof item !== 'object') continue
    const role = (item as any).role
    const content = (item as any).content
    if (role !== 'user' && role !== 'assistant') continue
    if (typeof content !== 'string') continue
    const texto = content.trim().slice(0, MAX_LARGO_MENSAJE)
    if (!texto) continue
    limpios.push({ role, content: texto })
  }

  const recortados = limpios.slice(-MAX_MENSAJES)
  // La API exige que la conversación empiece con un turno del alumno.
  while (recortados.length > 0 && recortados[0].role !== 'user') recortados.shift()
  return recortados
}

function normalizarPerfil(entrada: unknown): Perfil | null {
  if (!entrada || typeof entrada !== 'object') return null
  const { nivel, objetivo, tiempo, dificultad } = entrada as Record<string, unknown>
  const perfil: Perfil = {}
  if (typeof nivel === 'string') perfil.nivel = nivel
  if (typeof objetivo === 'string') perfil.objetivo = objetivo
  if (typeof tiempo === 'string') perfil.tiempo = tiempo
  if (typeof dificultad === 'string') perfil.dificultad = dificultad
  return Object.keys(perfil).length > 0 ? perfil : null
}

function claveDeLimite(req: Peticion, cuerpo: any): string {
  const sesion = typeof cuerpo?.sessionId === 'string' ? cuerpo.sessionId.replace(/[^\w-]/g, '').slice(0, 64) : ''
  if (sesion) return `s:${sesion}`
  const reenviado = req.headers['x-forwarded-for']
  const ip = Array.isArray(reenviado) ? reenviado[0] : (reenviado ?? '').split(',')[0].trim()
  return `ip:${ip || req.socket?.remoteAddress || 'desconocida'}`
}

function responderJson(res: Respuesta, status: number, datos: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(datos))
}

function enviarEvento(res: Respuesta, datos: unknown): void {
  res.write(`data: ${JSON.stringify(datos)}\n\n`)
}

export default async function handler(req: Peticion, res: Respuesta): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.setHeader('allow', 'POST, OPTIONS')
    res.end()
    return
  }

  if (req.method !== 'POST') {
    responderJson(res, 405, { error: ERROR_GENERICO })
    return
  }

  let cuerpo: any
  try {
    cuerpo = await leerCuerpo(req)
  } catch {
    responderJson(res, 400, { error: ERROR_GENERICO })
    return
  }

  const mensajes = normalizarMensajes(cuerpo?.messages)
  if (mensajes.length === 0) {
    responderJson(res, 400, { error: 'No recibimos tu mensaje. Escríbelo otra vez, por favor.' })
    return
  }

  const limite = verificarLimite(claveDeLimite(req, cuerpo))
  if (!limite.permitido) {
    responderJson(res, 429, { error: mensajeLimite(limite.esperaSegundos) })
    return
  }

  const system = construirSystemPrompt(normalizarPerfil(cuerpo?.perfil))

  res.statusCode = 200
  res.setHeader('content-type', 'text/event-stream; charset=utf-8')
  res.setHeader('cache-control', 'no-cache, no-transform')
  res.setHeader('connection', 'keep-alive')
  // Evita que un proxy intermedio acumule la respuesta y rompa el streaming.
  res.setHeader('x-accel-buffering', 'no')
  res.flushHeaders?.()

  const abortador = new AbortController()
  const cancelar = () => abortador.abort()
  req.on('close', cancelar)

  try {
    for await (const texto of streamChat({
      system,
      messages: mensajes,
      maxTokens: MAX_TOKENS,
      signal: abortador.signal,
    })) {
      enviarEvento(res, { type: 'delta', text: texto })
    }
    enviarEvento(res, { type: 'done' })
  } catch (error) {
    // El detalle queda en los registros del servidor; el alumno ve español claro.
    console.error('[api/chat]', error instanceof Error ? error.message : error)
    if (!abortador.signal.aborted) {
      const mensaje =
        error instanceof ProviderError && error.status === 429
          ? 'El profesor está atendiendo a mucha gente en este momento. Intenta de nuevo en un minuto.'
          : ERROR_GENERICO
      enviarEvento(res, { type: 'error', message: mensaje })
    }
  } finally {
    req.off('close', cancelar)
    res.end()
  }
}

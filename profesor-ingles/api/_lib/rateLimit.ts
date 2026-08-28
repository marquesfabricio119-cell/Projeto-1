/**
 * Límite simple por sesión: 30 mensajes por hora.
 *
 * Vive en memoria de la función serverless. En Vercel eso significa que el
 * conteo es "por instancia" y se reinicia cuando la instancia se recicla: es
 * una defensa razonable contra el uso accidental o abusivo, no una cuota
 * contable. Para un límite estricto haría falta un almacén externo (Redis /
 * Upstash) — se cambiaría solo este archivo.
 */

const VENTANA_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000
const MAXIMO = Number(process.env.RATE_LIMIT_MAX) || 30
const MAX_CLAVES = 5000

interface Registro {
  conteo: number
  reiniciaEn: number
}

const registros = new Map<string, Registro>()

function limpiar(ahora: number): void {
  for (const [clave, registro] of registros) {
    if (registro.reiniciaEn <= ahora) registros.delete(clave)
  }
  // Cinturón de seguridad si el mapa creciera demasiado.
  if (registros.size > MAX_CLAVES) registros.clear()
}

export interface ResultadoLimite {
  permitido: boolean
  restantes: number
  /** Segundos que faltan para que se libere la cuota. */
  esperaSegundos: number
}

export function verificarLimite(clave: string): ResultadoLimite {
  const ahora = Date.now()
  limpiar(ahora)

  const registro = registros.get(clave)
  if (!registro || registro.reiniciaEn <= ahora) {
    registros.set(clave, { conteo: 1, reiniciaEn: ahora + VENTANA_MS })
    return { permitido: true, restantes: MAXIMO - 1, esperaSegundos: 0 }
  }

  if (registro.conteo >= MAXIMO) {
    return {
      permitido: false,
      restantes: 0,
      esperaSegundos: Math.max(1, Math.ceil((registro.reiniciaEn - ahora) / 1000)),
    }
  }

  registro.conteo += 1
  return {
    permitido: true,
    restantes: MAXIMO - registro.conteo,
    esperaSegundos: 0,
  }
}

export function mensajeLimite(esperaSegundos: number): string {
  const minutos = Math.max(1, Math.ceil(esperaSegundos / 60))
  return `Practicaste mucho en la última hora y llegaste al límite de mensajes. Vuelve en ${minutos} ${
    minutos === 1 ? 'minuto' : 'minutos'
  } y seguimos donde quedamos.`
}

export const LIMITE_MAXIMO = MAXIMO

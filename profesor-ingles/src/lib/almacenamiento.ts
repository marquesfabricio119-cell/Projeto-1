/**
 * Todo el estado del usuario vive en localStorage. No hay base de datos.
 * Si el navegador bloquea el almacenamiento (modo privado, cookies apagadas),
 * la app sigue funcionando: solo no recuerda nada entre recargas.
 */
import type { Mensaje, Perfil } from './tipos'

const P = 'ivp.'

export const CLAVES = {
  acceso: `${P}acceso`,
  nombre: `${P}nombre`,
  perfil: `${P}perfil`,
  conversacion: `${P}conversacion`,
  conteo: `${P}conversaciones`,
  sesion: `${P}sesion`,
  tema: `${P}tema`,
  borrador: `${P}borrador`,
} as const

function leer(clave: string): string | null {
  try {
    return window.localStorage.getItem(clave)
  } catch {
    return null
  }
}

function escribir(clave: string, valor: string): void {
  try {
    window.localStorage.setItem(clave, valor)
  } catch {
    /* almacenamiento no disponible: seguimos sin persistir */
  }
}

function borrar(clave: string): void {
  try {
    window.localStorage.removeItem(clave)
  } catch {
    /* nada que hacer */
  }
}

function leerJson<T>(clave: string): T | null {
  const bruto = leer(clave)
  if (!bruto) return null
  try {
    return JSON.parse(bruto) as T
  } catch {
    borrar(clave)
    return null
  }
}

/* ---------- Acceso ---------- */

export function tieneAcceso(): boolean {
  return leer(CLAVES.acceso) === 'si'
}

export function guardarAcceso(nombre: string): void {
  escribir(CLAVES.acceso, 'si')
  const limpio = nombre.trim().slice(0, 40)
  if (limpio) escribir(CLAVES.nombre, limpio)
  else borrar(CLAVES.nombre)
}

export function cerrarSesion(): void {
  borrar(CLAVES.acceso)
}

export function obtenerNombre(): string {
  return leer(CLAVES.nombre) ?? ''
}

/* ---------- Perfil del alumno ---------- */

export function obtenerPerfil(): Perfil | null {
  const perfil = leerJson<Partial<Perfil>>(CLAVES.perfil)
  if (!perfil || !perfil.nivel) return null
  return {
    nivel: perfil.nivel,
    objetivo: perfil.objetivo ?? '',
    tiempo: perfil.tiempo ?? '',
    dificultad: perfil.dificultad ?? '',
    actualizado: perfil.actualizado ?? new Date().toISOString(),
  }
}

export function guardarPerfil(perfil: Omit<Perfil, 'actualizado'>): Perfil {
  const completo: Perfil = { ...perfil, actualizado: new Date().toISOString() }
  escribir(CLAVES.perfil, JSON.stringify(completo))
  return completo
}

/* ---------- Conversación ---------- */

export function obtenerConversacion(): Mensaje[] {
  const mensajes = leerJson<Mensaje[]>(CLAVES.conversacion)
  if (!Array.isArray(mensajes)) return []
  return mensajes.filter(
    (m) => m && typeof m.texto === 'string' && (m.autor === 'alumno' || m.autor === 'profesor'),
  )
}

export function guardarConversacion(mensajes: Mensaje[]): void {
  escribir(CLAVES.conversacion, JSON.stringify(mensajes))
}

export function limpiarConversacion(): void {
  borrar(CLAVES.conversacion)
}

/* ---------- Contador de conversaciones ---------- */

export function obtenerConteo(): number {
  const valor = Number(leer(CLAVES.conteo))
  return Number.isFinite(valor) && valor > 0 ? Math.floor(valor) : 0
}

export function sumarConversacion(): number {
  const nuevo = obtenerConteo() + 1
  escribir(CLAVES.conteo, String(nuevo))
  return nuevo
}

/* ---------- Identificador de sesión (para el límite del servidor) ---------- */

export function obtenerIdSesion(): string {
  const guardado = leer(CLAVES.sesion)
  if (guardado) return guardado
  const nuevo =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  escribir(CLAVES.sesion, nuevo)
  return nuevo
}

/* ---------- Tema ---------- */

export type Tema = 'claro' | 'oscuro'

export function obtenerTema(): Tema {
  const guardado = leer(CLAVES.tema)
  if (guardado === 'claro' || guardado === 'oscuro') return guardado
  const prefiereOscuro =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefiereOscuro ? 'oscuro' : 'claro'
}

export function guardarTema(tema: Tema): void {
  escribir(CLAVES.tema, tema)
  document.documentElement.classList.toggle('dark', tema === 'oscuro')
}

/* ---------- Texto pendiente para el chat (viene de /comandos) ---------- */

export function guardarBorrador(texto: string): void {
  escribir(CLAVES.borrador, texto)
}

export function tomarBorrador(): string {
  const texto = leer(CLAVES.borrador)
  if (texto) borrar(CLAVES.borrador)
  return texto ?? ''
}

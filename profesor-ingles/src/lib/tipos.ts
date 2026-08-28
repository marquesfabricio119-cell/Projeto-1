export interface Perfil {
  nivel: string
  objetivo: string
  tiempo: string
  dificultad: string
  /** Cuándo se guardó por última vez (ISO). */
  actualizado: string
}

export interface Mensaje {
  id: string
  autor: 'alumno' | 'profesor'
  texto: string
  /** Marca los mensajes que quedaron a medias por un error de red. */
  error?: boolean
}

export interface MapaNino {
  archivo: string
  titulo: string
}

export interface BloqueNinos {
  bloque: string
  mapas: MapaNino[]
}

export interface Comando {
  id: number
  categoria: string
  texto: string
}

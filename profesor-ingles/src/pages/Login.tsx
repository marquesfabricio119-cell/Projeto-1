import { useState, type FormEvent } from 'react'
import Marca from '../components/Marca'
import BotonTema from '../components/BotonTema'
import { guardarAcceso } from '../lib/almacenamiento'

/** Código de acceso compartido, igual que el área de miembros del kit. */
const CODIGO_DE_ACCESO = 'PROFESOR17'

const ERROR_CODIGO = 'Ese código no es correcto. Revisa el correo de tu compra.'

interface Props {
  alEntrar: (nombre: string) => void
}

export default function Login({ alEntrar }: Props) {
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    if (codigo.trim().toUpperCase() !== CODIGO_DE_ACCESO) {
      setError(ERROR_CODIGO)
      return
    }
    setError('')
    guardarAcceso(nombre)
    alEntrar(nombre.trim().slice(0, 40))
  }

  return (
    <div className="relative min-h-[100dvh] bg-background px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-accent/70 to-transparent"
      />
      <div className="absolute right-3 top-3 z-10">
        <BotonTema />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-md flex-col justify-center">
        <div className="tarjeta shadow-lift px-5 py-8 sm:px-8 sm:py-10">
          <Marca conBajada centrado />

          <form onSubmit={enviar} className="mt-8 space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="nombre" className="etiqueta">
                Tu nombre (opcional)
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                autoComplete="given-name"
                className="campo"
                placeholder="¿Cómo te llamamos?"
                value={nombre}
                maxLength={40}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="codigo" className="etiqueta">
                Código de acceso
              </label>
              <input
                id="codigo"
                name="codigo"
                type="password"
                autoComplete="current-password"
                className="campo tracking-widest"
                placeholder="••••••••"
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value)
                  if (error) setError('')
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'error-codigo' : undefined}
              />
            </div>

            {error && (
              <p
                id="error-codigo"
                role="alert"
                className="rounded-md bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger"
              >
                {error}
              </p>
            )}

            <button type="submit" className="boton-primario w-full">
              Entrar
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Tu código llegó en el correo de tu compra del kit de mapas mentales.
        </p>
      </div>
    </div>
  )
}

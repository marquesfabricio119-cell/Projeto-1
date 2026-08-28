/** Iconos en línea: sin librerías externas, heredan el color del texto. */
interface Props {
  className?: string
}

const base = 'h-5 w-5'

function Svg({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ?? base}
    >
      {children}
    </svg>
  )
}

export const IconoAtras = (p: Props) => (
  <Svg {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
)

export const IconoAdelante = (p: Props) => (
  <Svg {...p}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
)

export const IconoSol = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
)

export const IconoLuna = (p: Props) => (
  <Svg {...p}>
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </Svg>
)

export const IconoSalir = (p: Props) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
  </Svg>
)

export const IconoCopiar = (p: Props) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Svg>
)

export const IconoCheck = (p: Props) => (
  <Svg {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
)

export const IconoBuscar = (p: Props) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
)

export const IconoEnviar = (p: Props) => (
  <Svg {...p}>
    <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" />
  </Svg>
)

export const IconoMas = (p: Props) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconoCerrar = (p: Props) => (
  <Svg {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Svg>
)

export const IconoDescargar = (p: Props) => (
  <Svg {...p}>
    <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
  </Svg>
)

export const IconoUsuario = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0116 0" />
  </Svg>
)

export const IconoReiniciar = (p: Props) => (
  <Svg {...p}>
    <path d="M3 12a9 9 0 019-9 9 9 0 016.7 3H21M21 3v5h-5" />
    <path d="M21 12a9 9 0 01-9 9 9 9 0 01-6.7-3H3M3 21v-5h5" />
  </Svg>
)

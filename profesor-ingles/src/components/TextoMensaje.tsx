/**
 * El profesor escribe en texto plano, pero a veces marca palabras con
 * **asteriscos**. Lo convertimos a negrita para que no se vean los símbolos.
 */
interface Props {
  texto: string
}

export default function TextoMensaje({ texto }: Props) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g)
  return (
    <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed">
      {partes.map((parte, i) =>
        parte.startsWith('**') && parte.endsWith('**') && parte.length > 4 ? (
          <strong key={i} className="font-semibold">
            {parte.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </p>
  )
}

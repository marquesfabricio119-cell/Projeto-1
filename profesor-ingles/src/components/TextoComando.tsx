/**
 * Pinta en color lo que va entre [corchetes]: así el alumno ve de una
 * que ahí debe poner su propia información antes de enviar.
 */
interface Props {
  texto: string
}

export default function TextoComando({ texto }: Props) {
  const partes = texto.split(/(\[[^\]]+\])/g)
  return (
    <>
      {partes.map((parte, i) =>
        parte.startsWith('[') && parte.endsWith(']') ? (
          <span key={i} className="font-semibold text-primary">
            {parte}
          </span>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </>
  )
}

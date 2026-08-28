import Encabezado from '../components/Encabezado'
import BotonCopiar from '../components/BotonCopiar'

interface Props {
  alSalir: () => void
}

const TEXTO_PARA_IA_GRATUITA = `Quiero que seas mi profesor de inglés. Me llamo [tu nombre], soy hispanohablante de América Latina y mi nivel es [tu nivel: nada / entiendo pero no hablo / me defiendo / bastante]. Lo necesito para [trabajo / viaje / estudio / mudarme / gusto personal] y tengo [10] minutos al día. Lo que más se me dificulta es [hablar / entender / gramática / vocabulario / pronunciación].

Reglas para ti:
1. Explícame siempre en español. El inglés va solo en los ejemplos y en la práctica.
2. Frases cortas, un concepto por mensaje, y al final siempre una pregunta o un mini reto.
3. Cuando yo escriba en inglés: primero reacciona a lo que dije, luego escribe "Pequeño ajuste:" con la frase corregida, después "¿Por qué?" con una sola línea de explicación, y cierra con otra pregunta.
4. Corrige máximo dos errores por mensaje, los que más estorban para entenderme.
5. Si la frase está bien, dímelo y sube un poco la dificultad.
6. La pronunciación escríbela aproximada en español entre corchetes, así: through [zrú]. Nada de símbolos fonéticos.
7. Si te digo "no entendí" o "más fácil", explícalo de otra forma con un ejemplo de la vida diaria.
8. No me des listas larguísimas de palabras para memorizar.

Empecemos: hazme una pregunta sencilla en inglés para arrancar.`

interface Seccion {
  numero: string
  titulo: string
  cuerpo: React.ReactNode
}

const SECCIONES: Seccion[] = [
  {
    numero: '1',
    titulo: 'Qué es esto',
    cuerpo: (
      <>
        <p>
          Esto no es un curso con lecciones numeradas. Es un profesor disponible a cualquier hora,
          para practicar lo que ya tienes en tus mapas mentales.
        </p>
        <p>
          Tu kit te da el contenido ordenado y visual. Aquí tienes con quién usarlo: alguien que te
          responde, te corrige y te explica en español, sin apuro y sin pena.
        </p>
      </>
    ),
  },
  {
    numero: '2',
    titulo: 'Cómo empezar',
    cuerpo: (
      <>
        <p>
          La primera vez que entras al Profesor te hace 4 preguntas: tu nivel, para qué lo
          necesitas, cuántos minutos tienes al día y qué se te dificulta más.
        </p>
        <p>
          No son un trámite. Con esas respuestas el profesor decide qué tan simples serán sus
          frases, de qué temas te va a hablar y qué tan largo será cada mensaje. Si cambias de
          objetivo, edita tu perfil desde el ícono de la persona en el chat.
        </p>
      </>
    ),
  },
  {
    numero: '3',
    titulo: 'La rutina de 10 minutos',
    cuerpo: (
      <>
        <p>La combinación que mejor funciona es sencilla:</p>
        <ol className="ml-5 list-decimal space-y-1.5">
          <li>Elige un mapa de tu kit y míralo con calma (2 minutos).</li>
          <li>Abre el Profesor y dile: "Practiquemos una conversación sobre [el tema del mapa]".</li>
          <li>Contesta como puedas, aunque sea con frases sueltas (7 minutos).</li>
          <li>Antes de cerrar, escribe "ya" y guarda el resumen que te dé (1 minuto).</li>
        </ol>
        <p>
          Un mapa, una conversación sobre ese mismo mapa. Repetir el tema es lo que hace que las
          palabras se queden.
        </p>
      </>
    ),
  },
  {
    numero: '4',
    titulo: 'Cómo pedir mejor',
    cuerpo: (
      <>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Di tu nivel cuando cambies de tema: "explícamelo como si fuera principiante".</li>
          <li>Un comando a la vez. Si pides cinco cosas juntas, recibes una respuesta larga y confusa.</li>
          <li>Si algo no quedó claro, pide "más fácil", "más corto" o "dame otro ejemplo".</li>
          <li>Puedes escribirle en español. No hace falta que sepas inglés para pedirle ayuda.</li>
          <li>
            Los comandos de la sección "200 Comandos" ya están escritos: cambia lo que está entre
            corchetes y listo.
          </li>
        </ul>
      </>
    ),
  },
  {
    numero: '5',
    titulo: 'Si la IA se equivoca',
    cuerpo: (
      <>
        <p>
          Puede pasar. La inteligencia artificial se equivoca de vez en cuando, sobre todo con
          reglas muy específicas o con palabras raras.
        </p>
        <p>
          La regla de la casa: <strong>el mapa manda</strong>. Tus mapas mentales fueron revisados y
          son tu referencia. La IA es para practicar, conversar y perder el miedo, no para dictar
          reglas. Si algo no te cuadra, pídele que lo explique otra vez y compáralo con tu mapa.
        </p>
      </>
    ),
  },
  {
    numero: '6',
    titulo: 'Cómo usarlo gratis',
    cuerpo: (
      <>
        <p>
          Si algún día quieres practicar desde otra herramienta de IA gratuita, copia el texto de
          abajo, pégalo en el chat de esa herramienta y llena lo que está entre corchetes. Vas a
          tener un profesor con las mismas reglas que este.
        </p>
      </>
    ),
  },
]

export default function Guia({ alSalir }: Props) {
  return (
    <div className="min-h-[100dvh]">
      <Encabezado titulo="Guía de Uso" alSalir={alSalir} />

      <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-6">
        <h2 className="font-heading text-2xl font-extrabold leading-tight sm:text-3xl">
          Cómo aprovecharlo en 10 minutos al día
        </h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          Léelo una vez. Son seis ideas cortas y con eso ya sabes usarlo todo.
        </p>

        <div className="mt-8 space-y-6">
          {SECCIONES.map((seccion) => (
            <section key={seccion.numero} className="tarjeta p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent
                    font-heading text-sm font-bold text-accent-foreground"
                >
                  {seccion.numero}
                </span>
                <h3 className="font-heading text-lg font-bold sm:text-xl">{seccion.titulo}</h3>
              </div>
              <div className="mt-4 space-y-3 text-[0.95rem] leading-relaxed text-muted-foreground">
                {seccion.cuerpo}
              </div>

              {seccion.numero === '6' && (
                <div className="mt-5">
                  <div className="rounded-lg bg-muted p-4">
                    <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                      {TEXTO_PARA_IA_GRATUITA}
                    </pre>
                  </div>
                  <div className="mt-3">
                    <BotonCopiar
                      texto={TEXTO_PARA_IA_GRATUITA}
                      etiqueta="Copiar el texto"
                      className="boton-primario px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}

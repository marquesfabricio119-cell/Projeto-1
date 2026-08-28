import type { Comando } from '../lib/tipos'

/**
 * Biblioteca de 200 comandos, 10 categorías de 20.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  CÓMO COMPLETAR LOS 200 COMANDOS
 *  Cada categoría tiene un rango fijo de ids (1–20, 21–40, 41–60, …) y hoy
 *  trae 8 ejemplos reales. Debajo de cada bloque hay una marca:
 *
 *      // TODO: pegar aquí los 12 comandos restantes (ids X–Y)
 *
 *  Reemplaza esa línea por los objetos que falten, con el mismo formato:
 *      { id: 9, categoria: CATEGORIAS[0], texto: 'Tu comando…' },
 *  Los ids no se repiten y no hace falta tocar ningún otro archivo.
 *  Lo que va entre [corchetes] se pinta en color y le avisa al alumno que
 *  debe reemplazarlo.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const CATEGORIAS = [
  'Conversación diaria',
  'Corrección de errores',
  'Gramática explicada',
  'Vocabulario y memoria',
  'Pronunciación',
  'Inglés para el trabajo',
  'Inglés para viajar',
  'Entrevistas y exámenes',
  'Práctica de escritura',
  'Juegos y retos',
] as const

export type Categoria = (typeof CATEGORIAS)[number]

export const COMANDOS: Comando[] = [
  /* ── 1. Conversación diaria — ids 1 a 20 ───────────────────────────── */
  {
    id: 1,
    categoria: CATEGORIAS[0],
    texto: 'Ten una conversación conmigo en inglés sobre [mi día de hoy]. Usa frases cortas y corrígeme al final de cada respuesta.',
  },
  {
    id: 2,
    categoria: CATEGORIAS[0],
    texto: 'Hazme 5 preguntas sencillas en inglés sobre [mi familia]. Espera mi respuesta antes de pasar a la siguiente.',
  },
  {
    id: 3,
    categoria: CATEGORIAS[0],
    texto: 'Vamos a simular que nos acabamos de conocer. Empieza tú el saludo en inglés y llévame la conversación paso a paso.',
  },
  {
    id: 4,
    categoria: CATEGORIAS[0],
    texto: 'Enséñame 6 maneras de responder cuando alguien me dice "How are you?", de la más informal a la más formal.',
  },
  {
    id: 5,
    categoria: CATEGORIAS[0],
    texto: 'Quiero contar en inglés lo que hice el fin de semana. Escucha mi versión y ayúdame a decirlo más natural.',
  },
  {
    id: 6,
    categoria: CATEGORIAS[0],
    texto: 'Dame 10 frases que se usan todos los días en inglés para [pedir un favor], con la pronunciación en español entre corchetes.',
  },
  {
    id: 7,
    categoria: CATEGORIAS[0],
    texto: 'Practiquemos una conversación telefónica corta en inglés: yo llamo para [preguntar por un horario]. Tú haces el otro papel.',
  },
  {
    id: 8,
    categoria: CATEGORIAS[0],
    texto: 'Explícame la diferencia entre las respuestas cortas "Yes, I do", "Yes, I am" y "Yes, I can", con un ejemplo de cada una.',
  },
  // TODO: pegar aquí los 12 comandos restantes de Conversación diaria (ids 9–20)

  /* ── 2. Corrección de errores — ids 21 a 40 ────────────────────────── */
  {
    id: 21,
    categoria: CATEGORIAS[1],
    texto: 'Corrige este texto que escribí en inglés: [pega tu texto aquí]. Muéstrame solo los dos errores más importantes y explícamelos en español.',
  },
  {
    id: 22,
    categoria: CATEGORIAS[1],
    texto: 'Esta frase me suena rara: [tu frase]. ¿Está bien dicha? Si no, dime cómo la diría una persona nativa.',
  },
  {
    id: 23,
    categoria: CATEGORIAS[1],
    texto: 'Revisa este mensaje antes de que lo envíe: [tu mensaje]. Dime si suena grosero, muy formal o natural.',
  },
  {
    id: 24,
    categoria: CATEGORIAS[1],
    texto: 'Te voy a escribir 5 frases en inglés seguidas. Corrígeme cada una en una sola línea y al final dime cuál es mi error más repetido.',
  },
  {
    id: 25,
    categoria: CATEGORIAS[1],
    texto: 'Siempre me equivoco con [in, on y at]. Ponme 8 frases con espacios en blanco para llenar y después corrígeme.',
  },
  {
    id: 26,
    categoria: CATEGORIAS[1],
    texto: 'Traduce lo que quise decir: quería decir "[tu idea en español]" y escribí "[tu intento en inglés]". ¿Qué salió mal?',
  },
  {
    id: 27,
    categoria: CATEGORIAS[1],
    texto: 'Muéstrame los 10 errores más comunes de los hispanohablantes al hablar inglés y dime cuáles estoy cometiendo yo.',
  },
  {
    id: 28,
    categoria: CATEGORIAS[1],
    texto: 'Corrígeme solo la gramática de este párrafo, sin cambiarme el estilo ni las palabras que elegí: [tu párrafo].',
  },
  // TODO: pegar aquí los 12 comandos restantes de Corrección de errores (ids 29–40)

  /* ── 3. Gramática explicada — ids 41 a 60 ──────────────────────────── */
  {
    id: 41,
    categoria: CATEGORIAS[2],
    texto: 'Explícame cuándo uso do y cuándo uso does, como si tuviera 10 años, con 3 ejemplos de la vida diaria.',
  },
  {
    id: 42,
    categoria: CATEGORIAS[2],
    texto: 'Explícame la diferencia entre [was y were] con ejemplos, y después ponme un mini examen de 5 preguntas.',
  },
  {
    id: 43,
    categoria: CATEGORIAS[2],
    texto: 'Enséñame a formar preguntas en inglés paso a paso, empezando por las más fáciles.',
  },
  {
    id: 44,
    categoria: CATEGORIAS[2],
    texto: 'Explícame para qué sirve el verbo to be, sin nombres técnicos, y dame una regla que pueda recordar siempre.',
  },
  {
    id: 45,
    categoria: CATEGORIAS[2],
    texto: '¿Cuándo digo "I have been" y cuándo digo "I went"? Explícamelo con una historia corta.',
  },
  {
    id: 46,
    categoria: CATEGORIAS[2],
    texto: 'Hazme un resumen de una sola pantalla sobre [los verbos irregulares más usados], con los 15 que de verdad valen la pena.',
  },
  {
    id: 47,
    categoria: CATEGORIAS[2],
    texto: 'Explícame [el futuro con will y con going to] y ponme a mí a escribir 4 frases para ver si entendí.',
  },
  {
    id: 48,
    categoria: CATEGORIAS[2],
    texto: 'No entendí [el tema que estamos viendo]. Explícamelo otra vez de forma más fácil y con un ejemplo de mi vida diaria.',
  },
  // TODO: pegar aquí los 12 comandos restantes de Gramática explicada (ids 49–60)

  /* ── 4. Vocabulario y memoria — ids 61 a 80 ────────────────────────── */
  {
    id: 61,
    categoria: CATEGORIAS[3],
    texto: 'Dame 12 palabras en inglés sobre [la cocina] con su pronunciación en español y una frase de ejemplo para cada una.',
  },
  {
    id: 62,
    categoria: CATEGORIAS[3],
    texto: 'Tómame una prueba de vocabulario de [10] palabras sobre [el trabajo]. Pregúntame una por una y llévame el puntaje.',
  },
  {
    id: 63,
    categoria: CATEGORIAS[3],
    texto: 'Ayúdame a memorizar estas palabras: [tu lista]. Invéntame una historia corta en inglés que las use todas.',
  },
  {
    id: 64,
    categoria: CATEGORIAS[3],
    texto: '¿Cuál es la diferencia entre [make y do]? Dame una regla simple y 6 ejemplos que se usen de verdad.',
  },
  {
    id: 65,
    categoria: CATEGORIAS[3],
    texto: 'Enséñame 10 palabras que se parecen al español pero significan otra cosa, para no meter la pata.',
  },
  {
    id: 66,
    categoria: CATEGORIAS[3],
    texto: 'Dame las 20 palabras más útiles para el nivel [A2] sobre [la salud], ordenadas de la más usada a la menos usada.',
  },
  {
    id: 67,
    categoria: CATEGORIAS[3],
    texto: 'Explícame el significado de [tu palabra o expresión] con un dibujo mental, un ejemplo y un sinónimo fácil.',
  },
  {
    id: 68,
    categoria: CATEGORIAS[3],
    texto: 'Hazme repasar las palabras que ya vimos en esta conversación con 5 preguntas rápidas.',
  },
  // TODO: pegar aquí los 12 comandos restantes de Vocabulario y memoria (ids 69–80)

  /* ── 5. Pronunciación — ids 81 a 100 ───────────────────────────────── */
  {
    id: 81,
    categoria: CATEGORIAS[4],
    texto: '¿Cómo se pronuncia [tu palabra]? Escríbemelo en español entre corchetes y dime qué parte se me suele dificultar.',
  },
  {
    id: 82,
    categoria: CATEGORIAS[4],
    texto: 'Enséñame a diferenciar el sonido de [ship y sheep] con 8 pares de palabras para practicar.',
  },
  {
    id: 83,
    categoria: CATEGORIAS[4],
    texto: 'Dame 10 palabras que los hispanohablantes pronunciamos mal y la forma correcta escrita en español.',
  },
  {
    id: 84,
    categoria: CATEGORIAS[4],
    texto: 'Explícame cómo se pronuncia la terminación -ed en el pasado, con las tres formas y ejemplos.',
  },
  {
    id: 85,
    categoria: CATEGORIAS[4],
    texto: 'Ayúdame con las palabras que empiezan con S: [school, Spain, street]. ¿Cómo evito decir "escul"?',
  },
  {
    id: 86,
    categoria: CATEGORIAS[4],
    texto: 'Dame un trabalenguas fácil en inglés para practicar el sonido [th] y explícame cómo poner la lengua.',
  },
  {
    id: 87,
    categoria: CATEGORIAS[4],
    texto: 'Enséñame dónde va la fuerza de la voz en estas palabras: [tu lista]. Marca la sílaba fuerte en mayúsculas.',
  },
  {
    id: 88,
    categoria: CATEGORIAS[4],
    texto: 'Explícame por qué los nativos dicen "gonna" y "wanna", cuándo puedo usarlo y cuándo no.',
  },
  // TODO: pegar aquí los 12 comandos restantes de Pronunciación (ids 89–100)

  /* ── 6. Inglés para el trabajo — ids 101 a 120 ─────────────────────── */
  {
    id: 101,
    categoria: CATEGORIAS[5],
    texto: 'Escríbeme un correo de trabajo en inglés para [pedir una cotización], en tono formal, y explícame cada parte.',
  },
  {
    id: 102,
    categoria: CATEGORIAS[5],
    texto: 'Practiquemos una reunión de trabajo en inglés sobre [un retraso en la entrega]. Tú eres mi jefe.',
  },
  {
    id: 103,
    categoria: CATEGORIAS[5],
    texto: 'Dame 15 frases útiles para hablar en inglés en una videollamada: pedir que repitan, pedir tiempo, cerrar la reunión.',
  },
  {
    id: 104,
    categoria: CATEGORIAS[5],
    texto: 'Enséñame el vocabulario básico de [atención al cliente] en inglés, con ejemplos que pueda usar mañana mismo.',
  },
  {
    id: 105,
    categoria: CATEGORIAS[5],
    texto: 'Ayúdame a presentarme en inglés en 30 segundos: trabajo en [tu área] y quiero sonar seguro y claro.',
  },
  {
    id: 106,
    categoria: CATEGORIAS[5],
    texto: 'Revisa este correo antes de enviarlo a un cliente y dime si suena profesional: [pega tu correo].',
  },
  {
    id: 107,
    categoria: CATEGORIAS[5],
    texto: 'Enséñame a decir "no" en inglés de forma amable en el trabajo, con 6 maneras distintas.',
  },
  {
    id: 108,
    categoria: CATEGORIAS[5],
    texto: 'Explícame las frases de cortesía que se usan al escribir correos en inglés y cuáles ya suenan anticuadas.',
  },
  // TODO: pegar aquí los 12 comandos restantes de Inglés para el trabajo (ids 109–120)

  /* ── 7. Inglés para viajar — ids 121 a 140 ─────────────────────────── */
  {
    id: 121,
    categoria: CATEGORIAS[6],
    texto: 'Practiquemos la conversación del aeropuerto: migración, equipaje y puerta de embarque. Tú haces las preguntas.',
  },
  {
    id: 122,
    categoria: CATEGORIAS[6],
    texto: 'Dame las 20 frases que sí o sí necesito para viajar a [tu destino], con pronunciación en español.',
  },
  {
    id: 123,
    categoria: CATEGORIAS[6],
    texto: 'Simulemos que estoy en un restaurante: pido mesa, ordeno y pido la cuenta. Corrígeme al final de cada paso.',
  },
  {
    id: 124,
    categoria: CATEGORIAS[6],
    texto: 'Enséñame a pedir indicaciones en inglés y, sobre todo, a entender la respuesta cuando me la dan rápido.',
  },
  {
    id: 125,
    categoria: CATEGORIAS[6],
    texto: 'Practiquemos el check-in en un hotel. Tengo un problema con [la reserva] y necesito resolverlo en inglés.',
  },
  {
    id: 126,
    categoria: CATEGORIAS[6],
    texto: 'Dame frases de emergencia en inglés: farmacia, doctor y policía. Cortas y fáciles de recordar.',
  },
  {
    id: 127,
    categoria: CATEGORIAS[6],
    texto: 'Enséñame a regatear y preguntar precios en inglés en un mercado, con ejemplos naturales.',
  },
  {
    id: 128,
    categoria: CATEGORIAS[6],
    texto: 'Explícame cómo pedir ayuda cuando no entendí nada, sin quedarme callado: 8 frases para salir del apuro.',
  },
  // TODO: pegar aquí los 12 comandos restantes de Inglés para viajar (ids 129–140)

  /* ── 8. Entrevistas y exámenes — ids 141 a 160 ─────────────────────── */
  {
    id: 141,
    categoria: CATEGORIAS[7],
    texto: 'Hazme una entrevista de trabajo en inglés para el puesto de [tu puesto]. Una pregunta a la vez y me corriges al final.',
  },
  {
    id: 142,
    categoria: CATEGORIAS[7],
    texto: 'Ayúdame a responder "Tell me about yourself" en inglés, con una estructura de 4 partes y un ejemplo con mis datos: [tu experiencia].',
  },
  {
    id: 143,
    categoria: CATEGORIAS[7],
    texto: 'Dame las 15 preguntas más frecuentes de entrevista en inglés y una respuesta modelo corta para cada una.',
  },
  {
    id: 144,
    categoria: CATEGORIAS[7],
    texto: 'Simula la parte oral de un examen de nivel [B1] y al final dime en qué nivel estoy y por qué.',
  },
  {
    id: 145,
    categoria: CATEGORIAS[7],
    texto: 'Enséñame a hablar de mis debilidades en una entrevista en inglés sin sonar mal parado.',
  },
  {
    id: 146,
    categoria: CATEGORIAS[7],
    texto: 'Revisa mi hoja de vida en inglés y dime qué frases suenan traducidas del español: [pega tu texto].',
  },
  {
    id: 147,
    categoria: CATEGORIAS[7],
    texto: 'Ponme un examen escrito corto de [10] preguntas de nivel [A2] y califícame al final con una explicación.',
  },
  {
    id: 148,
    categoria: CATEGORIAS[7],
    texto: 'Enséñame qué preguntas hacer yo al final de una entrevista en inglés para dejar buena impresión.',
  },
  // TODO: pegar aquí los 12 comandos restantes de Entrevistas y exámenes (ids 149–160)

  /* ── 9. Práctica de escritura — ids 161 a 180 ──────────────────────── */
  {
    id: 161,
    categoria: CATEGORIAS[8],
    texto: 'Ponme un tema para escribir 5 frases en inglés sobre [mi rutina] y después corrígeme con cariño.',
  },
  {
    id: 162,
    categoria: CATEGORIAS[8],
    texto: 'Ayúdame a escribir un mensaje de WhatsApp en inglés para [invitar a alguien a salir], en tono relajado.',
  },
  {
    id: 163,
    categoria: CATEGORIAS[8],
    texto: 'Escribí este párrafo en inglés: [tu párrafo]. Muéstrame mi versión y una versión mejorada, lado a lado.',
  },
  {
    id: 164,
    categoria: CATEGORIAS[8],
    texto: 'Dame un ejercicio de escritura de 10 minutos, adecuado a mi nivel, y evalúame cuando termine.',
  },
  {
    id: 165,
    categoria: CATEGORIAS[8],
    texto: 'Enséñame a unir mis frases en inglés con conectores fáciles y muéstrame el antes y el después.',
  },
  {
    id: 166,
    categoria: CATEGORIAS[8],
    texto: 'Ayúdame a escribir una publicación corta en inglés sobre [tu tema] para redes sociales.',
  },
  {
    id: 167,
    categoria: CATEGORIAS[8],
    texto: 'Vamos a escribir una historia entre los dos: tú escribes una frase en inglés y yo la siguiente. Corrígeme la mía cada vez.',
  },
  {
    id: 168,
    categoria: CATEGORIAS[8],
    texto: 'Explícame cómo pasar de escribir frases sueltas a escribir un párrafo con sentido, con un ejemplo.',
  },
  // TODO: pegar aquí los 12 comandos restantes de Práctica de escritura (ids 169–180)

  /* ── 10. Juegos y retos — ids 181 a 200 ────────────────────────────── */
  {
    id: 181,
    categoria: CATEGORIAS[9],
    texto: 'Juguemos a las 20 preguntas en inglés. Piensa en un objeto y yo adivino con preguntas de sí o no.',
  },
  {
    id: 182,
    categoria: CATEGORIAS[9],
    texto: 'Ponme un reto diario de inglés de 5 minutos sobre [tu tema] y ayúdame a cumplirlo hoy.',
  },
  {
    id: 183,
    categoria: CATEGORIAS[9],
    texto: 'Hazme un juego de adivinar la palabra: dame la definición en inglés fácil y yo digo cuál es.',
  },
  {
    id: 184,
    categoria: CATEGORIAS[9],
    texto: 'Retémosme a decir 10 frases en inglés sobre [la comida] sin repetir ningún verbo. Cuéntame los aciertos.',
  },
  {
    id: 185,
    categoria: CATEGORIAS[9],
    texto: 'Juguemos a "verdadero o falso" con 8 frases en inglés sobre gramática. Yo respondo y tú explicas.',
  },
  {
    id: 186,
    categoria: CATEGORIAS[9],
    texto: 'Invéntame un rol: tú eres [un taxista] y yo un turista. No salgas del personaje y corrígeme al final.',
  },
  {
    id: 187,
    categoria: CATEGORIAS[9],
    texto: 'Ponme una carrera de traducción: 10 frases del español al inglés, de fácil a difícil, y llévame el puntaje.',
  },
  {
    id: 188,
    categoria: CATEGORIAS[9],
    texto: 'Hazme un reto de escucha: escribe una frase en inglés con una palabra cambiada y yo encuentro el error.',
  },
  // TODO: pegar aquí los 12 comandos restantes de Juegos y retos (ids 189–200)
]

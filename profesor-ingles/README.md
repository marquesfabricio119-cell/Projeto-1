# Tu Profesor de Inglés con IA — Idioma Visual

Complemento del kit de más de 360 mapas mentales de inglés. Es la app que ve el
comprador **después** de pagar: un profesor de inglés con IA que conversa, corrige y
explica en español, más una biblioteca de comandos listos para usar, una galería de
mapas para niños y una guía de uso.

Toda la interfaz está en español neutro de América Latina.

- **Vite + React + TypeScript + Tailwind CSS**, React Router para las pantallas.
- **Una sola función serverless** (`api/chat.ts`) que habla con el modelo.
- **Sin base de datos**: todo el estado del usuario vive en `localStorage`.
- Diseñado primero para teléfono (funciona desde 360 px de ancho).

---

## 1. Correr el proyecto en tu computadora

Necesitas Node.js 20 o superior.

```bash
cd profesor-ingles
npm install
cp .env.example .env        # y pon tu llave adentro
npm run dev                 # abre http://localhost:5173
```

El servidor de desarrollo de Vite también atiende `/api/chat`, así que el chat
funciona igual que en producción sin instalar nada más.

Otros comandos:

```bash
npm run build      # revisa tipos y genera dist/
npm run preview    # sirve dist/ (sin la función /api/chat)
```

> El código de acceso para entrar a la app es **PROFESOR17**.

---

## 2. La llave de la API y dónde ponerla

La llave del proveedor del modelo se lee **solo en el servidor**, dentro de
`api/chat.ts`. Nunca aparece en el navegador, ni en el paquete que se descarga, ni en
ninguna respuesta.

| Variable | Obligatoria | Para qué sirve |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Sí | Llave de la API de Anthropic. |
| `LLM_MODEL` | No | Modelo a usar. Por defecto `claude-sonnet-5`. |
| `LLM_BASE_URL` | No | Otra dirección del proveedor (un gateway propio o pruebas). |
| `RATE_LIMIT_MAX` | No | Mensajes por sesión en la ventana. Por defecto `30`. |
| `RATE_LIMIT_WINDOW_MS` | No | Tamaño de la ventana. Por defecto `3600000` (1 hora). |

**En tu computadora:** crea un archivo `.env` en `profesor-ingles/` con:

```
ANTHROPIC_API_KEY=sk-ant-...
```

**En Vercel:** entra al proyecto → **Settings → Environment Variables** → **Add New**:

- Key: `ANTHROPIC_API_KEY`
- Value: tu llave
- Environments: marca *Production*, *Preview* y *Development*

Guarda y vuelve a desplegar (**Deployments → … → Redeploy**) para que la función tome
el valor nuevo.

> ⚠️ **Nunca** le pongas el prefijo `VITE_` a esta variable. Todo lo que empieza con
> `VITE_` se incluye en el archivo que descarga el navegador y quedaría a la vista de
> cualquiera.

### Desplegar en Vercel, paso a paso

El proyecto se llama **profesor-con-ia** y queda en
`https://profesor-con-ia.vercel.app`.

1. Entra a <https://vercel.com/new> y elige el repositorio **Projeto-1**.
2. **Project Name**: escribe `profesor-con-ia`.
3. **Root Directory**: toca *Edit* y elige la carpeta **`profesor-ingles`**.
   Este repositorio tiene más de un proyecto; si no cambias esto, Vercel intenta
   desplegar la tienda que vive en la raíz.
   El resto (framework Vite, la carpeta `dist`, la función de `api/`) ya viene
   resuelto en `vercel.json`; no hay que tocar nada más ahí.
4. **Environment Variables**: agrega `ANTHROPIC_API_KEY` con tu llave.
   Sin esta variable la app se despliega igual, pero el chat contesta con el
   aviso de error: el profesor no puede hablar sin llave.
5. **Deploy**.

**Ojo con la rama.** Vercel publica la rama de producción, que por defecto es
`main`, y la app vive en la rama `claude/ai-english-tutor-app-upvi51`. Elige una:

- **Unir la rama a `main`** (lo normal cuando ya la revisaste): a partir de ahí
  cada `git push` a `main` vuelve a desplegar solo.
- **O apuntar Vercel a la rama**: *Settings → Git → Production Branch* →
  `claude/ai-english-tutor-app-upvi51` → *Save* → *Deployments → Redeploy*.

Si el despliegue termina pero el chat falla, revisa en **Deployments → la función
`api/chat`** que la variable `ANTHROPIC_API_KEY` esté en el entorno *Production*.
Después de agregar o cambiar una variable hay que **redesplegar** para que la
función la tome.

---

## 3. Cambiar el código de acceso

El código es uno solo, compartido, igual que el área de miembros del kit.

Está en **`src/pages/Login.tsx`**, primera línea de código del archivo:

```ts
const CODIGO_DE_ACCESO = 'PROFESOR17'
```

Cambia el texto, guarda y vuelve a desplegar. No distingue mayúsculas de minúsculas:
quien escriba `profesor17` también entra.

Al entrar se guarda una marca en `localStorage`; la sesión dura hasta que la persona
toca **Salir**.

---

## 4. Agregar o cambiar los mapas para niños

La galería lee el archivo **`public/data/ninos.json`**. No hay que tocar código para
cambiarla: son seis bloques con sus mapas.

```json
[
  {
    "bloque": "Mi mundo",
    "mapas": [
      { "archivo": "/ninos/mi-mundo-01.webp", "titulo": "Mi casa" },
      { "archivo": "/ninos/mi-mundo-02.webp", "titulo": "Mi familia" }
    ]
  }
]
```

- `archivo`: la ruta de la imagen **dentro de `public/`**. Si pones el archivo en
  `public/ninos/mi-casa.webp`, aquí escribes `/ninos/mi-casa.webp`.
- `titulo`: lo que se lee debajo de la miniatura y lo que escucha quien usa lector de
  pantalla.

Pasos para agregar una imagen:

1. Copia el archivo a `public/ninos/` (usa `.webp` o `.jpg`; cuadradas se ven mejor).
2. Agrega su línea al bloque que corresponda en `public/data/ninos.json`.
3. Listo. Mientras una imagen no exista, la tarjeta muestra un marcador gris en vez
   de un ícono roto.

---

## 5. Completar los 200 comandos

`src/data/comandos.ts` trae hoy **80 comandos reales** (8 por categoría) y un rango de
ids reservado para cada una: 1–20, 21–40, 41–60, y así hasta 200.

Debajo de cada bloque hay una marca como esta:

```ts
// TODO: pegar aquí los 12 comandos restantes de Conversación diaria (ids 9–20)
```

Reemplázala por los comandos que faltan, con el mismo formato:

```ts
{ id: 9, categoria: CATEGORIAS[0], texto: 'Tu comando…' },
```

Lo que escribas entre `[corchetes]` se pinta en color en la pantalla, para que el
alumno sepa que ahí va su propia información.

---

## 6. Cómo está armado

```
profesor-ingles/
├── api/
│   ├── chat.ts              Función serverless: valida, limita y transmite la respuesta
│   └── _lib/
│       ├── provider.ts      Único archivo que habla con el proveedor del modelo
│       ├── systemPrompt.ts  El prompt del profesor + el perfil del alumno
│       └── rateLimit.ts     Límite de mensajes por hora
├── public/
│   ├── data/ninos.json      Manifiesto de la galería
│   └── ninos/               Aquí van las imágenes de los mapas
├── src/
│   ├── pages/               Login, Home, Chat, Comandos, Ninos, Guia
│   ├── components/          Encabezado, asistente de perfil, hoja de comandos…
│   ├── data/comandos.ts     La biblioteca de comandos
│   └── lib/                 localStorage, cliente del chat y tipos
└── vercel.json
```

**Cómo viaja un mensaje:** el navegador manda la conversación y el perfil a
`/api/chat` → la función arma el prompt del sistema, revisa el límite y llama al
modelo → la respuesta vuelve en trocitos (SSE) y se va escribiendo en pantalla.

Detalles que conviene conocer:

- **Tope de 4000 tokens** de respuesta por mensaje.
- **30 mensajes por hora** por sesión. Al pasarse, la persona ve un aviso en español,
  nunca un error técnico. El conteo vive en la memoria de la función: sirve para
  frenar excesos, no como cuota exacta. Para un límite estricto habría que usar un
  almacén externo (Redis/Upstash) y solo cambiaría `api/_lib/rateLimit.ts`.
- **Si algo falla**, la app muestra: *"El profesor no pudo responder ahora. Intenta de
  nuevo en un momento."* El detalle técnico queda en los registros del servidor.
- **Cambiar de proveedor** significa cambiar `api/_lib/provider.ts` y nada más.

### Qué se guarda en el navegador

| Clave | Qué es |
| --- | --- |
| `ivp.acceso` | Marca de que el código fue correcto |
| `ivp.nombre` | El nombre que escribió la persona (si lo escribió) |
| `ivp.perfil` | Las 4 respuestas del asistente |
| `ivp.conversacion` | La conversación completa |
| `ivp.conversaciones` | Cuántas conversaciones lleva |
| `ivp.sesion` | Identificador anónimo para el límite por hora |
| `ivp.tema` | Modo claro u oscuro |

No hay registro, ni correo, ni cuentas, ni pagos: quien tiene el código, entra.

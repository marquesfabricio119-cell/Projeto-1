# Prompt completo do projeto — "Tu Profesor de Inglés con IA"

Este arquivo descreve o projeto inteiro, do produto ao código. Serve para dois usos:

- **Continuar o trabalho**: entregue este texto (ou o ZIP junto) a qualquer IA e ela
  entende o que existe, por que existe e o que falta.
- **Reconstruir do zero**: o texto é autossuficiente. Quem seguir tudo daqui chega
  no mesmo produto.

> Uma regra acima de todas: **a interface é 100% em espanhol neutro da América
> Latina**. Este arquivo está em português porque é documentação para o dono do
> projeto — nada do que está escrito aqui em português vai para a tela.

---

## 1. O que é o produto

"Tu Profesor de Inglés con IA" é um complemento pago (US$ 17) para clientes
hispano-falantes da América Latina que **já compraram** um kit de mais de 360 mapas
mentais ilustrados de inglês (A1 a C2).

O comprador já tem o material impresso. O que ele não tem é **com quem praticar**.
Esta app é esse alguém: um professor de inglês com IA que fala no nível dele, corrige
e explica em espanhol — mais uma biblioteca de 200 comandos prontos para copiar e
colar e uma seção de mapas mentais para crianças.

**Isto não é uma landing page.** É o produto que o comprador vê **depois** de pagar.
Não existe cadastro, e-mail, pagamento nem conta de usuário.

Público real: gente abrindo isso no celular, em dados móveis, na América Latina.
Toda tela precisa funcionar em **360 px de largura** antes de pensar em desktop.

---

## 2. Stack e restrições

- **Vite + React + TypeScript + Tailwind CSS**, React Router para navegação.
- **Uma única função serverless** (padrão Vercel: `api/chat.ts`) que fala com o modelo.
- **Sem banco de dados.** Todo o estado do usuário vive em `localStorage`.
- **Mobile-first.**
- Modelo: **Claude Sonnet 5** (`claude-sonnet-5`) pela Messages API, com o provedor
  isolado num único módulo para poder ser trocado.
- A resposta é **transmitida token a token** (SSE) até a tela. Um professor que vai
  escrevendo parece vivo; 6 segundos de silêncio parecem quebrados.

### A regra de segurança que não se negocia

A chave da API é lida de uma **variável de ambiente do servidor**, dentro de
`api/chat.ts`. Ela **nunca** pode aparecer no código do cliente, numa variável com
prefixo `VITE_`, no bundle ou numa resposta de rede. O navegador chama `/api/chat`,
e só o servidor chama o provedor.

Como verificar: compile com uma chave falsa e procure por ela em `dist/`. Zero
ocorrências, sempre.

### O que a função serverless também faz

- **Teto de 4000 tokens** de saída por requisição.
- **Limite de 30 mensagens por hora** por sessão, devolvendo uma mensagem simpática
  em espanhol quando estoura — nunca um 429 cru na cara do usuário.
- **try/catch** que devolve um erro em espanhol que a interface mostra:
  `"El profesor no pudo responder ahora. Intenta de nuevo en un momento."`

---

## 3. Acesso

Um único código compartilhado, igual à área de membros que o cliente já tem.

**Código: `PROFESOR17`** (não diferencia maiúsculas de minúsculas).

Tela de login: card centralizado sobre fundo suave.

- Área de logo com o texto **"Idioma Visual"** e abaixo **"Tu Profesor con IA"**.
- Campo opcional **"Tu nombre (opcional)"**.
- Campo de senha rotulado **"CÓDIGO DE ACCESO"**.
- Botão **"Entrar"**.
- Erro de código errado, exatamente assim:
  `"Ese código no es correcto. Revisa el correo de tu compra."`

No sucesso, guarda uma marca e o nome em `localStorage` e vai para a Home. A sessão
dura até a pessoa tocar em **"Salir"**.

---

## 4. As cinco telas

### 4.1 Home (`/`)

Saudação: `"¡Hola, {nombre}!"` (ou `"¡Hola!"` sem nome).
Uma linha: `"Tu profesor está listo. ¿Empezamos?"`

Quatro cards grandes, empilhados no celular e 2x2 no desktop:

| Card | Texto de apoio | Rota |
| --- | --- | --- |
| El Profesor | Conversa, te corrige y te explica en español. | `/chat` |
| 200 Comandos | Copia, pega y listo. No necesitas saber usar IA. | `/comandos` |
| Mapas para Niños | 60 mapas ilustrados para aprender en familia. | `/ninos` |
| Guía de Uso | Cómo aprovecharlo en 10 minutos al día. | `/guia` |

Abaixo, uma faixa fina de progresso: `"Llevas {n} conversaciones con el profesor"`,
contado do `localStorage`. Se `n` for 0, mostra no lugar:
`"Todavía no hablas con el profesor. La primera vez te hace 4 preguntas rápidas."`

### 4.2 El Profesor (`/chat`) — o coração do produto

**Primeira visita (só se não houver perfil salvo).** Nada de despejar as quatro
perguntas de uma vez. É um assistente de 4 passos, **uma pergunta por tela**, com
botões grandes e indicador de progresso em bolinhas:

1. `¿Qué tanto inglés sabes?` → [Nada] [Entiendo pero no hablo] [Me defiendo] [Bastante]
2. `¿Para qué lo necesitas?` → [Trabajo] [Viaje] [Estudio] [Mudarme] [Gusto personal]
3. `¿Cuántos minutos al día tienes?` → [5] [10] [15] [30 o más]
4. `¿Qué es lo que más se te dificulta?` → [Hablar] [Entender cuando me hablan]
   [Gramática] [Vocabulario] [Pronunciación] + campo livre `"Otra cosa…"`

As respostas viram um objeto `perfil` no `localStorage`. Existe um botão
**"Editar mi perfil"** no cabeçalho do chat para refazer depois.

**O chat.**

- Thread comum. Mensagens do professor à esquerda, em card branco. Mensagens do aluno
  à direita, na cor primária (âmbar).
- Indicador de digitação (três pontinhos animados) enquanto a resposta chega.
- Placeholder do campo: `"Escribe en inglés o en español…"`
- Botão **"＋ Comandos"** ao lado do campo abre uma folha inferior com os 200
  comandos, com busca. Tocar num comando **insere o texto no campo, não envia** —
  o aluno precisa preencher os `[colchetes]` antes.
- A conversa inteira é persistida em `localStorage`: recarregar não perde nada.
- Botão **"Nueva conversación"** no cabeçalho, com confirmação:
  `"¿Empezar de cero? Se borra esta conversación."`
- Quatro sugestões quando a conversa está vazia:
  - `Quiero practicar una conversación de nivel principiante`
  - `Corrige este texto que escribí en inglés`
  - `Explícame cuándo uso do y cuándo uso does`
  - `Hazme una entrevista de trabajo en inglés`

**O perfil vai para o servidor em toda requisição**, anexado ao prompt de sistema
como um bloco curto:

```
PERFIL DEL ALUMNO: nivel declarado = Entiendo pero no hablo; objetivo = Trabajo;
tiempo diario = 10 minutos; mayor dificultad = Hablar.
```

### 4.3 200 Comandos (`/comandos`)

Biblioteca de 200 prompts prontos em 10 categorias de 20:

1. Conversación diaria
2. Corrección de errores
3. Gramática explicada
4. Vocabulario y memoria
5. Pronunciación
6. Inglés para el trabajo
7. Inglés para viajar
8. Entrevistas y exámenes
9. Práctica de escritura
10. Juegos y retos

Guardados num arquivo TypeScript tipado:
`{ id: number; categoria: string; texto: string }[]`

Interface: campo de busca fixo no topo (`"Buscar un comando…"`) filtrando por texto e
categoria, chips de categoria abaixo, e uma lista de cards. Cada card mostra o comando
e dois botões:

- **"Copiar"** → copia; o botão vira **"¡Copiado!"** por um instante.
- **"Usar en el chat"** → navega para `/chat` com o texto **já no campo, sem enviar**.

Os comandos têm marcadores entre `[colchetes]`. Esses colchetes são pintados na cor
primária para o usuário perceber que precisa substituí-los.

### 4.4 Mapas para Niños (`/ninos`)

Galeria de 60 imagens em seis blocos temáticos de dez:
`Mi mundo` · `Animales` · `Comida` · `Mi día` · `Afuera` · `Palabras que unen`

Grade de miniaturas: duas colunas no celular, quatro no desktop. Tocar abre um visor
em tela cheia com deslizar (swipe), setas do teclado e botão **"Descargar"**.

A lista de arquivos vem de um manifesto em `/data/ninos.json`, para dar para
acrescentar imagens sem tocar em código. Toda miniatura carrega preguiçosamente
(`loading="lazy"`).

### 4.5 Guía de Uso (`/guia`)

Uma página só, seis seções curtas com bastante respiro:

1. **Qué es esto** — um professor disponível a qualquer hora, não um curso.
2. **Cómo empezar** — as 4 perguntas e por que importam.
3. **La rutina de 10 minutos** — um mapa do kit + uma conversa sobre esse mesmo tema.
4. **Cómo pedir mejor** — diga seu nível, um comando por vez, peça "más fácil" ou
   "más corto".
5. **Si la IA se equivoca** — o mapa manda; a IA é para praticar, não para ditar regras.
6. **Cómo usarlo gratis** — o texto de instruções para colar em qualquer IA gratuita,
   dentro de um bloco com botão de copiar.

---

## 5. O prompt do professor (vai no servidor, em espanhol, ao pé da letra)

```
Eres "Alex", un profesor de inglés paciente y cercano. Tu alumno es hispanohablante
de América Latina y compró un kit de más de 360 mapas mentales de inglés (A1 a C2).
Tu trabajo es que hable, no que memorice reglas.

CÓMO HABLAS
- Explicas SIEMPRE en español. El inglés aparece solo en los ejemplos y en la práctica.
- Frases cortas. Nada de párrafos largos ni listas de veinte puntos.
- Un concepto por mensaje. Al final, SIEMPRE una pregunta o un mini reto.
- Cero jerga gramatical sin traducir: no digas "present perfect" sin explicar qué es.
- Tono de amigo que sabe inglés, no de libro de texto. Puedes usar humor.

CÓMO CORRIGES (regla más importante)
Cuando el alumno escriba en inglés, responde en este orden exacto:
1. Primero reacciona al CONTENIDO, como en una conversación real.
2. Luego: "Pequeño ajuste:" y muestra la frase corregida.
3. Después: "¿Por qué?" y una sola línea explicando en español.
4. Cierra devolviendo la conversación con otra pregunta.
Nunca corrijas más de dos errores por mensaje, aunque haya diez. Elige los dos que
más estorban para entenderse. Los demás los dejas pasar.
Si la frase está bien, dilo con entusiasmo y sube un poco la dificultad.

NIVEL
Ajusta el vocabulario al nivel del alumno. Si es principiante, usa frases de 5 a 7
palabras y traduce todo. Sube de dificultad solo cuando acierte tres veces seguidas.
Si se traba dos veces, baja.

PRONUNCIACIÓN
Cuando enseñes una palabra difícil, escribe la pronunciación aproximada en español
entre corchetes: through [zrú] · comfortable [cámfterbol] · answer [ánser].
No uses símbolos fonéticos internacionales — no los entiende nadie.

LO QUE NUNCA HACES
- No prometes fluidez en X días.
- No das listas de 50 palabras para memorizar.
- No respondes en inglés cuando te preguntan algo en español.
- No cambias de tema si el alumno todavía no entendió el anterior.
- No sigues adelante sin haber hecho una pregunta al final.

SI EL ALUMNO SE PIERDE
Si escribe "no entendí", "más fácil" o algo parecido, no repitas lo mismo: explícalo
de otra forma, con un ejemplo de la vida diaria de tu alumno.

CIERRE DE SESIÓN
Si el alumno dice "ya" o "hasta aquí", dale un resumen de tres líneas: qué practicó,
qué mejoró y una sola tarea para mañana.
```

---

## 6. Design visual

Precisa combinar com a área de membros que o cliente já tem. Definido como
custom properties de CSS, com o Tailwind lendo delas:

```css
--background: 40 60% 97%;   /* branco quente */
--foreground: 20 14% 12%;
--card:       0 0% 100%;
--primary:    38 80% 55%;   /* âmbar/dourado: botões, estados ativos, balões do aluno */
--muted:      40 40% 94%;
--accent:     42 78% 91%;
--radius:     1rem;
```

Fontes do Google Fonts: **Poppins** (600/700/800) para títulos, **Inter**
(400/500/600) para texto, sempre com uma pilha de fallback real.

Estilo: cards arredondados e macios, padding generoso, sombras sutis, sem bordas
duras. Quente e calmo, não corporativo. **Modo escuro** dirigido pelos mesmos tokens.

Acessibilidade: anéis de foco de verdade, `aria-label` em todo botão que é só ícone, e
a thread do chat como região `aria-live` para leitores de tela anunciarem as respostas
novas.

---

## 7. Estrutura dos arquivos

```
profesor-ingles/
├── api/
│   ├── chat.ts              Função serverless: valida, limita e transmite
│   └── _lib/
│       ├── provider.ts      Único arquivo que fala com o provedor do modelo
│       ├── systemPrompt.ts  O prompt do Alex + o bloco do perfil do aluno
│       └── rateLimit.ts     Limite de mensagens por hora
├── public/
│   ├── data/ninos.json      Manifesto da galeria (6 blocos × 10 mapas)
│   ├── ninos/               Onde entram as imagens dos mapas
│   └── favicon.svg
├── src/
│   ├── pages/               Login, Home, Chat, Comandos, Ninos, Guia
│   ├── components/          Encabezado, AsistentePerfil, HojaComandos, Confirmacion,
│   │                        BotonCopiar, BotonTema, Marca, Iconos, TextoComando,
│   │                        TextoMensaje
│   ├── data/comandos.ts     A biblioteca de comandos
│   ├── lib/
│   │   ├── almacenamiento.ts  Tudo que toca localStorage
│   │   ├── profesor.ts        Cliente do chat (fetch + leitura do SSE)
│   │   └── tipos.ts           Tipos compartilhados
│   ├── index.css            Tokens de design e classes base
│   ├── App.tsx              Rotas e proteção por código
│   └── main.tsx
├── vercel.json              Build, função e reescrita de rotas
├── tailwind.config.js       Tailwind lendo as custom properties
├── .env.example
├── README.md                Como rodar, publicar e manter
└── PROMPT.md                Este arquivo
```

**Como uma mensagem viaja:** o navegador manda a conversa e o perfil para
`/api/chat` → a função monta o prompt de sistema, checa o limite e chama o modelo →
a resposta volta em pedacinhos (SSE) e vai sendo escrita na tela.

**O que fica guardado no navegador:** `ivp.acceso`, `ivp.nombre`, `ivp.perfil`,
`ivp.conversacion`, `ivp.conversaciones`, `ivp.sesion` (id anônimo para o limite por
hora) e `ivp.tema`.

---

## 8. Estado atual — o que está pronto e o que falta

**Pronto e verificado no navegador** (65 checagens automatizadas a 360 px, todas
passando; zero erro de JavaScript):

- As cinco telas, com todos os textos em espanhol neutro.
- Login, assistente de perfil, chat com streaming, persistência ao recarregar.
- Busca e filtro dos comandos, "Copiar" e "Usar en el chat".
- Galeria com visor, teclado e download.
- Modo claro e escuro, foco visível, `aria-live` na thread.
- A chave **não** aparece no bundle (verificado compilando com uma chave falsa).
- Limite de 30/hora testado: a requisição 31 devolve o aviso em espanhol.

**Falta (e é trabalho do dono do projeto, não bug):**

1. **120 comandos.** Existem 80 reais, 8 por categoria. Cada categoria tem faixa de id
   reservada (1–20, 21–40, 41–60, …) e uma marca no arquivo:
   `// TODO: pegar aquí los 12 comandos restantes de … (ids 9–20)`.
   É só substituir a linha pelos objetos que faltam, no mesmo formato.
2. **As 60 imagens dos mapas infantis.** O manifesto `public/data/ninos.json` já está
   completo com os nomes dos arquivos. Enquanto a imagem não existir, o card mostra um
   marcador cinza em vez de ícone quebrado. Basta colocar os arquivos em
   `public/ninos/`.
3. **O deploy na Vercel** com a chave (seção abaixo).

---

## 9. Como rodar e publicar

**Na sua máquina** (precisa de Node 20+):

```bash
cd profesor-ingles
npm install
cp .env.example .env      # coloque sua ANTHROPIC_API_KEY dentro
npm run dev               # http://localhost:5173
```

O servidor de desenvolvimento do Vite também atende `/api/chat`, então o chat funciona
igual à produção sem precisar do `vercel dev`.

**Variáveis de ambiente:**

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Sim | Chave da API. **Nunca** com prefixo `VITE_`. |
| `LLM_MODEL` | Não | Padrão `claude-sonnet-5`. |
| `LLM_BASE_URL` | Não | Outro endereço do provedor (gateway ou testes). |
| `RATE_LIMIT_MAX` | Não | Padrão 30. |
| `RATE_LIMIT_WINDOW_MS` | Não | Padrão 3600000 (1 hora). |

**Na Vercel:** projeto `profesor-personal`, **Root Directory `profesor-ingles`**
(o repositório tem mais de um projeto), variável `ANTHROPIC_API_KEY` em Production,
Preview e Development. Depois de mudar qualquer variável é preciso **redeploy** para a
função enxergar. O passo a passo detalhado está no `README.md`.

---

## 10. O que NÃO fazer

- Não colocar a chave da API em lugar nenhum do cliente.
- Não adicionar cadastro, e-mail, pagamento nem contas de usuário.
- Não prometer fluência em X dias em nenhum texto.
- Não usar voseo nem "vosotros"; não deixar nenhum texto de interface em português ou
  em inglês.
- Não construir landing page — este é o produto de depois da compra.
- Não inventar telas além das cinco descritas.

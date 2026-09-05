# Prompt do projeto — "Seu Professor de Inglês com IA"

Este documento descreve o aplicativo inteiro. Serve para três coisas:

1. reconstruir o app do zero em qualquer IA, colando o texto abaixo;
2. explicar para outra pessoa (ou para você daqui a seis meses) o que existe e por quê;
3. pedir mudanças sem ter que reexplicar o produto toda vez.

Se for usar como prompt, cole da seção **"O QUE CONSTRUIR"** até o fim.

---

## O QUE CONSTRUIR

Construa um aplicativo web completo, pronto para produção. Leia o texto inteiro antes de
escrever qualquer código.

### 1. O que é isto

"Seu Professor de Inglês com IA" — um complemento pago (R$ 89) para brasileiros que já
compraram um kit com mais de 360 mapas mentais ilustrados de inglês.

O comprador já tem o material impresso. O que ele **não** tem é com quem praticar. Este app
é esse alguém: um professor de inglês por IA que fala no nível dele, corrige e explica em
português — mais uma biblioteca de 200 comandos prontos para copiar e colar e uma seção de
mapas mentais para crianças.

A interface inteira é em **português do Brasil**. Nada de português de Portugal (sem "ecrã",
"telemóvel", "estás a fazer"). Nada de espanhol nem de inglês em rótulo de interface — o
inglês só aparece no conteúdo que está sendo ensinado.

Não é uma página de vendas. É o produto que o comprador vê **depois** de pagar.

### 2. Stack e restrições rígidas

- Vite + React + TypeScript + Tailwind CSS. React Router para a navegação.
- Uma única função serverless (padrão Vercel: `/api/chat.ts`) que faz a ponte com o modelo.
- Sem banco de dados. Todo o estado do aluno vive no `localStorage`.
- Celular primeiro. A maioria abre isso no telefone, no 4G. Toda tela precisa funcionar a
  **360 px de largura** antes de você pensar em desktop.

**REGRA DE SEGURANÇA — não viole:** a chave da API do modelo é lida de uma variável de
ambiente do servidor, dentro de `/api/chat.ts`. Ela **nunca** pode aparecer no código do
cliente, em variável com prefixo `VITE_`, no pacote gerado nem em resposta de rede. O
navegador chama `/api/chat`, e só o servidor chama o provedor do modelo. Se você estiver
prestes a colocar uma chave no front-end, pare e use a função serverless.

**Modelo:** Claude Sonnet 5 (id `claude-sonnet-5`) pela Messages API da Anthropic. Mantenha
o provedor isolado em um único módulo, para poder trocar depois. Envie a resposta em
streaming, pedaço por pedaço (Server-Sent Events ou corpo de fetch em streaming) — um
professor que vai digitando parece vivo; seis segundos de silêncio parecem defeito.

Implemente também, dentro de `/api/chat.ts`:

- teto rígido de **4000 tokens de saída** por requisição;
- limite simples por sessão (por exemplo, 30 mensagens por hora) devolvendo uma frase
  amigável em português quando estourar, nunca um 429 cru;
- `try`/`catch` que devolve um erro em português para a tela mostrar:
  *"O professor não conseguiu responder agora. Tente de novo daqui a pouco."*

### 3. Acesso

Um único código compartilhado, igual ao da área de membros que o cliente já usa.
Código: **`PROFESSOR17`**

Tela de entrada: um cartão centralizado sobre fundo suave.

- área de logotipo com o texto "Idioma Visual" e, embaixo, "Seu Professor com IA";
- um campo opcional "Seu nome (opcional)";
- um campo de senha rotulado "CÓDIGO DE ACESSO";
- botão "Entrar";
- erro de código errado: *"Esse código não está certo. Confira o e-mail da sua compra."*

Ao acertar, guarde uma marca e o nome no `localStorage` e vá para o Início. A sessão
continua até a pessoa apertar "Sair".

### 4. Telas

#### 4.1 Início (`/`)

Saudação: "Olá, {nome}!" (ou "Olá!" sem nome). Uma linha curta: "Seu professor está pronto.
Vamos começar?"

Quatro cartões grandes, empilhados no celular e 2x2 no desktop:

1. **"O Professor"** — "Converse, ele corrige e explica em português." → `/chat`
2. **"200 Comandos"** — "Copie, cole e pronto. Não precisa saber usar IA." → `/comandos`
3. **"Mapas para Crianças"** — "60 mapas ilustrados para aprender em família." → `/criancas`
4. **"Guia de Uso"** — "Como aproveitar em 10 minutos por dia." → `/guia`

Abaixo dos cartões, uma faixa fina de progresso: "Você já teve {n} conversas com o
professor" (contando do `localStorage`). Se n for 0, mostre no lugar: "Você ainda não falou
com o professor. Na primeira vez ele faz 4 perguntas rápidas."

#### 4.2 O Professor (`/chat`) — o coração do produto

**As 4 perguntas da primeira vez** (só se não houver perfil no `localStorage`): não despeje
as quatro de uma vez como um paredão de texto. Mostre um assistente de 4 passos, uma
pergunta por tela, com botões grandes de tocar e bolinhas indicando o progresso:

- **Passo 1** — "Quanto de inglês você sabe?" `[Nada]` `[Entendo mas não falo]` `[Me viro]` `[Bastante]`
- **Passo 2** — "Para que você precisa de inglês?" `[Trabalho]` `[Viagem]` `[Estudo]` `[Morar fora]` `[Gosto pessoal]`
- **Passo 3** — "Quantos minutos por dia você tem?" `[5]` `[10]` `[15]` `[30 ou mais]`
- **Passo 4** — "O que mais te dá trabalho?" `[Falar]` `[Entender quando falam comigo]` `[Gramática]` `[Vocabulário]` `[Pronúncia]` mais um campo livre "Outra coisa…"

Guarde as respostas como um objeto `perfil` no `localStorage`. Mostre um botão "Editar meu
perfil" no cabeçalho do chat, para a pessoa refazer depois.

**O chat em si:**

- fio de mensagens comum. Mensagens do professor à esquerda, em cartão branco; mensagens do
  aluno à direita, na cor âmbar principal;
- indicador de digitação (três pontinhos animados) enquanto a resposta chega;
- o campo de escrita tem o texto de exemplo: "Escreva em inglês ou em português…";
- um botão "＋ Comandos" ao lado do campo abre uma gaveta de baixo com os 200 comandos, com
  busca. Tocar em um comando **escreve o texto no campo, sem enviar**, para a pessoa
  preencher os [colchetes] antes;
- guarde o fio inteiro no `localStorage`, para recarregar a página nunca perder a conversa;
- um botão "Nova conversa" no cabeçalho, com confirmação: "Começar do zero? Esta conversa
  será apagada.";
- quatro sugestões quando o fio está vazio:
  - "Quero praticar uma conversa de nível iniciante"
  - "Corrija este texto que eu escrevi em inglês"
  - "Me explique quando eu uso do e quando eu uso does"
  - "Me faça uma entrevista de emprego em inglês"

O `perfil` do aluno tem que ser injetado no prompt do sistema **em toda requisição**, como
um bloco curto no fim, por exemplo: "PERFIL DO ALUNO: nível declarado = Entendo mas não
falo; objetivo = Trabalho; tempo diário = 10 minutos; maior dificuldade = Falar."

**PROMPT DO SISTEMA — use este texto na íntegra, no servidor:**

```
Você é "Alex", um professor de inglês paciente e próximo. Seu aluno é brasileiro e comprou um kit com mais de 360 mapas mentais de inglês (A1 a C2). Seu trabalho é fazer ele falar, não decorar regras.

COMO VOCÊ FALA
- Você explica SEMPRE em português. O inglês aparece só nos exemplos e na prática.
- Frases curtas. Nada de parágrafos longos nem listas de vinte itens.
- Um conceito por mensagem. No final, SEMPRE uma pergunta ou um mini desafio.
- Zero jargão gramatical sem tradução: não diga "present perfect" sem explicar o que é.
- Tom de amigo que sabe inglês, não de livro didático. Pode usar humor.

COMO VOCÊ CORRIGE (a regra mais importante)
Quando o aluno escrever em inglês, responda nesta ordem exata:
1. Primeiro reaja ao CONTEÚDO, como numa conversa de verdade.
2. Depois: "Pequeno ajuste:" e mostre a frase corrigida.
3. Em seguida: "Por quê?" e uma única linha explicando em português.
4. Feche devolvendo a conversa com outra pergunta.
Nunca corrija mais de dois erros por mensagem, mesmo que haja dez. Escolha os dois que mais atrapalham o entendimento. Os outros você deixa passar. Se a frase estiver certa, diga isso com entusiasmo e aumente um pouco a dificuldade.

NÍVEL
Ajuste o vocabulário ao nível do aluno. Se ele for iniciante, use frases de 5 a 7 palavras e traduza tudo. Só aumente a dificuldade quando ele acertar três vezes seguidas. Se ele travar duas vezes, diminua.

PRONÚNCIA
Quando ensinar uma palavra difícil, escreva a pronúncia aproximada em português entre colchetes: through [trú] · comfortable [cãmf-ter-bou] · answer [ãn-ser]. Não use símbolos fonéticos internacionais — ninguém entende.

O QUE VOCÊ NUNCA FAZ
- Não promete fluência em X dias.
- Não dá listas de 50 palavras para decorar.
- Não responde em inglês quando te perguntam algo em português.
- Não muda de assunto se o aluno ainda não entendeu o anterior.
- Não segue em frente sem ter feito uma pergunta no final.

SE O ALUNO SE PERDER
Se ele escrever "não entendi", "mais fácil" ou algo parecido, não repita a mesma coisa: explique de outro jeito, com um exemplo do dia a dia do seu aluno.

FIM DA SESSÃO
Se o aluno disser "chega" ou "por hoje é só", dê um resumo de três linhas: o que ele praticou, o que melhorou e uma única tarefa para amanhã.
```

#### 4.3 200 Comandos (`/comandos`)

Uma biblioteca de 200 comandos prontos, em 10 categorias de 20 cada:

1. Conversa do dia a dia
2. Correção de erros
3. Gramática explicada
4. Vocabulário e memória
5. Pronúncia
6. Inglês para o trabalho
7. Inglês para viajar
8. Entrevistas e provas
9. Prática de escrita
10. Jogos e desafios

Guarde-os em um arquivo TypeScript tipado: `{ id: number; categoria: string; texto: string }[]`.

Interface: campo de busca fixo no topo ("Buscar um comando…") filtrando por texto e
categoria, os selos de categoria embaixo dele, e uma lista de cartões. Cada cartão mostra o
texto do comando e dois botões:

- **"Copiar"** → copia para a área de transferência; o botão vira "Copiado!" por um instante;
- **"Usar no chat"** → vai para `/chat` com o texto já escrito no campo.

Os comandos têm marcadores entre [colchetes]. Pinte esses colchetes na cor principal, para a
pessoa perceber que precisa trocá-los.

#### 4.4 Mapas para Crianças (`/criancas`)

Uma galeria de 60 imagens, seis blocos temáticos de dez: "Meu mundo" · "Animais" · "Comida"
· "Meu dia" · "Lá fora" · "Palavras que ligam".

Grade de miniaturas, duas colunas no celular e quatro no desktop. Tocar abre um visualizador
em tela cheia com arrastar para o lado, setas do teclado e um botão "Baixar". Leia a lista de
arquivos de um manifesto JSON em `/data/criancas.json`, para dar para acrescentar imagens sem
mexer em código. Carregue toda miniatura com `loading="lazy"`.

#### 4.5 Guia de Uso (`/guia`)

Uma página só, seis seções curtas com bastante respiro:

1. "O que é isto" — um professor disponível a qualquer hora, não um curso.
2. "Como começar" — as 4 perguntas e por que elas importam.
3. "A rotina de 10 minutos" — um mapa do kit + uma conversa sobre esse mesmo tema.
4. "Como pedir melhor" — diga seu nível, um comando por vez, peça "mais fácil" ou "mais curto".
5. "Se a IA errar" — quem manda é o mapa; a IA é para praticar, não para ditar regra.
6. "Como usar de graça" — o texto de instruções para colar em qualquer IA gratuita, dentro de
   um bloco com botão de copiar.

### 5. Visual — precisa combinar com a área de membros existente

Defina como variáveis CSS e faça o Tailwind ler delas:

```
--background: 40 60% 97%   (branco quente)
--foreground: 20 14% 12%
--card: 0 0% 100%
--primary: 38 80% 55%      (âmbar/dourado — botões, estados ativos, balões do aluno)
--muted: 40 40% 94%
--accent: 42 78% 91%
--radius: 1rem
```

Fontes do Google Fonts: Poppins (600/700/800) para títulos, Inter (400/500/600) para o
corpo. Sempre com uma pilha de fallback de verdade.

Estilo: cartões arredondados e macios, bastante espaçamento interno, sombras discretas, sem
bordas duras. Quente e calmo, não corporativo. Inclua tema escuro movido pelas mesmas
variáveis.

Acessibilidade: anéis de foco de verdade, `aria-label` em botão que só tem ícone, e o fio do
chat como região `aria-live`, para o leitor de tela anunciar cada resposta nova.

### 6. O que NÃO fazer

- Não colocar a chave da API em lugar nenhum do cliente.
- Não adicionar cadastro, e-mail, pagamento nem conta de usuário no servidor.
- Não prometer fluência em X dias em nenhum texto.
- Não usar português de Portugal; não deixar nenhum texto de interface em inglês ou espanhol.
- Não construir página de vendas — este é o produto que o comprador vê DEPOIS de pagar.
- Não inventar telas além das cinco descritas.

### 7. Entregar

Um app funcionando mais um README em português com: como rodar na máquina, qual variável de
ambiente guarda a chave e onde colocá-la na Vercel, como trocar o código de acesso e como
acrescentar imagens em `/data/criancas.json`.

Antes de terminar, confira você mesmo cada um destes itens:

- [ ] a chave da API não aparece em lugar nenhum do pacote gerado;
- [ ] entrar com `PROFESSOR17` funciona; código errado mostra o erro em português;
- [ ] a primeira visita ao `/chat` mostra o assistente de 4 passos, e o perfil salvo chega
      ao prompt do sistema no servidor;
- [ ] a resposta do professor chega aos poucos, em vez de aparecer de uma vez;
- [ ] recarregar a página mantém o perfil e a conversa;
- [ ] "Usar no chat" preenche o campo sem enviar;
- [ ] toda tela é usável a 360 px de largura;
- [ ] não há português de Portugal, nem texto de interface em inglês ou espanhol.

---

## O QUE JÁ ESTÁ PRONTO NESTE ZIP

Tudo o que está acima está implementado. O que segue é o mapa do que você vai encontrar.

### Como rodar

```bash
cd professor-ingles
npm install
cp .env.example .env        # coloque sua chave em ANTHROPIC_API_KEY
npm run dev                 # http://localhost:5173
```

O `npm run dev` já serve a função `/api/chat` junto com o site — há um plugin dentro do
`vite.config.ts` que converte a requisição do Node em `Request` padrão e chama o mesmo
handler que roda na Vercel. Não precisa da CLI da Vercel para desenvolver.

`npm run build` confere os tipos e gera a pasta `dist/`.

### Estrutura

```
professor-ingles/
├── api/
│   ├── chat.ts              função serverless (Edge): valida, aplica o limite,
│   │                        monta o prompt e devolve SSE
│   └── _lib/
│       ├── prompt.ts        o texto do professor "Alex" + o bloco PERFIL DO ALUNO
│       ├── provedor.ts      ÚNICO arquivo que conhece a Anthropic (troque só ele
│       │                    para mudar de provedor)
│       └── limite.ts        30 mensagens por hora por sessão
├── public/
│   ├── data/criancas.json   manifesto dos 60 mapas, em 6 blocos
│   ├── mapas/*.svg          as 60 imagens (provisórias)
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── AssistenteDePerfil.tsx   as 4 perguntas, uma por tela
│   │   ├── FolhaDeComandos.tsx      a gaveta de comandos dentro do chat
│   │   ├── TextoComColchetes.tsx    pinta os [colchetes] na cor principal
│   │   ├── Cabecalho.tsx            barra de topo das telas internas
│   │   └── BotaoDeTema.tsx          claro/escuro
│   ├── data/comandos.ts     a biblioteca de comandos
│   ├── lib/
│   │   ├── acesso.ts        o código PROFESSOR17
│   │   ├── armazenamento.ts todo acesso ao localStorage, protegido por try/catch
│   │   ├── clienteDoChat.ts o fetch em streaming e a leitura do SSE
│   │   └── tipos.ts
│   ├── pages/               Entrar, Inicio, Chat, Comandos, Criancas, Guia
│   ├── index.css            as variáveis de cor e os componentes de estilo
│   ├── App.tsx              rotas e a proteção por código
│   └── main.tsx
├── vercel.json              framework, build e as rotas do SPA
├── vite.config.ts           React + o plugin que serve /api em desenvolvimento
└── README.md
```

### Decisões que valem saber

- **Onde o app vive.** A raiz do repositório já era outro projeto (o sistema Estilo
  Fashion). Por isso o app fica em `professor-ingles/`. Na Vercel, aponte
  **Settings → General → Root Directory** para essa pasta.
- **O código de acesso não é um segredo de verdade.** Ele é compartilhado e conferido no
  navegador, então quem abrir o código-fonte do site vê. Ele faz o mesmo papel da senha da
  área de membros: manter a porta fechada para quem não comprou. Quem precisa de sigilo é a
  chave da API, e essa fica só no servidor. Para trocar o código, mude uma linha em
  `src/lib/acesso.ts`.
- **O limite por hora é por instância.** Ele é guardado na memória da instância que atende a
  requisição. Como a Vercel pode ter várias no ar, o número real por sessão pode passar um
  pouco de 30. Um controle exato pediria um Redis, e o projeto foi pedido sem banco.
- **A conversa não vai inteira para o modelo.** Só as últimas 40 mensagens, e o servidor
  garante que a última seja do aluno, como a API exige.
- **Erro nunca vaza cru.** Qualquer falha — chave ausente, provedor fora do ar, resposta
  interrompida no meio — vira a mesma frase em português na tela.

### O que fica pendente de propósito

- `src/data/comandos.ts` tem **80 comandos escritos** (8 por categoria) e um marcador
  `TODO: faltam 12 comandos` no fim de cada categoria, com os números de `id` livres
  anotados. Cole os que faltam no mesmo formato; a busca, os filtros e os botões leem a
  lista sozinhos.
- Os 60 arquivos de `public/mapas/` são SVGs provisórios (a palavra em inglês e a tradução).
  Troque pelas ilustrações reais mantendo os nomes, ou ajuste os nomes em
  `public/data/criancas.json`.

### Variáveis de ambiente

| Variável                      | Obrigatória | Para que serve                                       |
| ----------------------------- | ----------- | ---------------------------------------------------- |
| `ANTHROPIC_API_KEY`           | sim         | chave da API da Anthropic                            |
| `TUTOR_MODELO`                | não         | modelo usado (padrão: `claude-sonnet-5`)             |
| `TUTOR_LIMITE_MENSAGENS_HORA` | não         | limite por sessão por hora (padrão: 30)              |
| `ANTHROPIC_BASE_URL`          | não         | endereço da API (só para testes)                     |

Nunca use o prefixo `VITE_` nessas variáveis: tudo que começa com `VITE_` é embutido no
arquivo que o navegador baixa.

### Como foi verificado

34 checagens automatizadas no Chromium a 360 px de largura, 33 passando. A única falha é o
Google Fonts bloqueado pelo proxy do ambiente de teste — por isso as fontes têm pilha de
fallback de verdade. Foi conferido, com o app rodando de verdade: a ausência de qualquer
vestígio da chave ou do provedor no `dist/`; a entrada certa e a errada; o assistente na
primeira visita e o bloco `PERFIL DO ALUNO` chegando ao servidor; a resposta crescendo aos
poucos na tela; o perfil e a conversa sobrevivendo ao recarregamento; "Usar no chat"
preenchendo sem enviar; nenhuma tela rolando para o lado a 360 px; e a 31ª mensagem na mesma
hora devolvendo o aviso amigável em vez de um 429 cru.

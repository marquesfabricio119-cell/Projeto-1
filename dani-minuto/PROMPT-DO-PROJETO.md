# Prompt do projeto — Dani Minuto

Cole o texto abaixo (da linha de traços em diante) em qualquer assistente de IA para que ele
entenda o projeto por inteiro antes de continuar o trabalho. Depois de colar, escreva o que você
quer que seja feito.

---

## Contexto

Você vai trabalhar no site da **Dani Minuto**, uma marca pessoal de consultoria de skin care.
A assinatura da marca é **"A ponte entre os mundos"**: ela existe no espaço entre a ciência
farmacêutica e a cura integrativa, e a identidade não escolhe um lado — ela é a ponte.
Frase de sustentação: *"A ciência que sente. A cura que pensa."*

O produto é uma **consultoria de skin care vendida pelo site**. O caminho da cliente é:

1. Escolhe um protocolo e preenche nome, e-mail e WhatsApp. Recebe na hora um código de acesso
   no formato `DM-XXXXXX` e a chave PIX.
2. Paga por PIX e manda o comprovante no WhatsApp. A Dani confirma o pagamento no painel.
3. Com o código, entra na área da cliente e responde **a anamnese** — um quiz guiado de 6 blocos.
4. Ao enviar, o sistema calcula uma primeira leitura da pele e levanta alertas de segurança.
5. A Dani revisa tudo no painel, escreve anotações e entrega o protocolo personalizado.

## Stack

HTML, CSS e JavaScript puros. **Sem framework, sem build, sem dependências.** Os arquivos são
servidos como estáticos. O estado fica num único JSON (`{ settings, orders, anamneses, removidos }`),
gravado no `localStorage` e sincronizado com o Supabase na linha `id = 'dani_minuto'` da tabela
`loja_roupas_db`. Toda chamada de rede tem prazo de 8 segundos e o site continua funcionando offline.

## Arquivos

| Caminho | O que é |
|---|---|
| `index.html` | Página de vendas |
| `checkout.html` | Contratação, geração do código de acesso e PIX |
| `area.html` | Área da cliente: status do pedido e acesso à anamnese |
| `anamnese.html` | O quiz da anamnese |
| `admin.html` | Painel da Dani (senha inicial `dani123`) |
| `app.js` | Núcleo: estado, sincronização, sessão, cabeçalho e rodapé |
| `quiz.js` | As perguntas da anamnese e o cálculo da leitura do resultado |
| `style.css` | A identidade visual inteira |
| `marca/` | Símbolo e logo em SVG |
| `social/` | Kit de Instagram: 18 artes em PNG, legendas e material de marca |
| `previa-offline.html` | O site inteiro num arquivo só, para abrir sem servidor |

## Identidade visual (Manual "Vulcão", Lapidari 2026)

**Símbolo:** dois círculos que se sobrepõem. Carmim é ciência, sol, matéria. Ameixa é
espiritualidade, lua, etéreo. A interseção que emerge é o espaço da Dani: a ponte.

**Paleta:**

| Cor | Hex | Papel |
|---|---|---|
| Carmim | `#B83240` | Primária: fogo, força, presença |
| Laranja Brasa | `#D4782A` | Secundária: energia e chamadas para ação |
| Ameixa | `#7A4E6A` | Acento: lua intensa, mistério |
| Aurora | `#F8EDE8` | Fundo |
| Obsidiana | `#1A0F0F` | Texto (substitui o preto puro) |

Regra de uso: carmim para conteúdo de estética e ciência, ameixa para conteúdo integrativo,
laranja brasa reservado a botões e chamadas de ação.

**Tipografia:** Fraunces para display e títulos, **sempre em peso light (300), nunca bold** — é a
regra mais visível do manual. Sans neutra para corpo e rótulos. Captions em caixa-alta com
tracking generoso. As fontes estão em `social/fontes/`, servidas localmente.

**Três princípios, que valem como restrição de design:**

- **Essencialismo** — muito espaço em branco, nenhum elemento decorativo sem função.
- **Fluidez** — sem bordas duras, sem grades rígidas. Profundidade vem de lavagem de cor e sombra
  difusa, nunca de contorno de 1px.
- **Dualidade** — carmim e ameixa nunca competem, coexistem como sol e lua.

## Regras de texto (não negociáveis)

- **Primeira pessoa do plural.** "Analisamos", "montamos", "aproveitamos o que você já tem em casa".
  Nunca "eu analiso".
- **Sem travessão (—).** Use dois-pontos, ponto ou vírgula. O ponto médio (·) separa itens.
- Fala com a cliente, não sobre ela: "sua pele", não "a pele da mulher moderna".
- Explica o porquê antes do quê. Nunca dá regra sem motivo.
- **Não promete resultado, não vende medo, não chama nada de milagre.**
- Diz o limite em voz alta: consultoria de skin care é orientação estética e educativa e **não
  substitui consulta, diagnóstico ou prescrição médica**. Todo material que fala de preço ou
  tratamento carrega esse aviso.
- Nunca indicar medicamento, nem inventar depoimento de cliente.

## Como o quiz funciona

Uma pergunta por tela. Escolher uma resposta única já avança sozinho; múltipla escolha e texto
livre têm botão. Funciona no teclado: `1`–`9` escolhem, `Enter` continua, `Backspace` volta.
As perguntas condicionais entram e saem conforme as respostas (marcar "acne" abre perguntas de
grau e local). Cada bloco novo abre com uma tela de passagem. Dá para sair no meio e retomar
depois, porque o rascunho fica salvo por código de acesso. Na revisão final, cada resposta tem
um "editar" que leva direto à pergunta.

Os 6 blocos: **Sua pele hoje**, **Suas queixas**, **Sua rotina atual**, **Saúde e segurança**,
**Rotina e estilo de vida** e **Seus objetivos**.

`calcularResultado()` em `quiz.js` cruza as respostas e devolve tipo de pele, nível de
sensibilidade, estado da barreira cutânea, qualidade da fotoproteção, maturidade da rotina, as
prioridades do tratamento, um esqueleto de rotina manhã/noite e **alertas de segurança** para a
Dani (gestação, isotretinoína, rosácea, melasma, procedimento recente, acne inflamatória).
Isso não é diagnóstico: é a primeira leitura que a Dani revisa antes de montar o protocolo.

## Publicação

O site é estático, não tem build. Ele vive numa subpasta de um repositório que também contém
outro projeto na raiz, então o deploy precisa apontar para a pasta: na Vercel, **Root Directory =
`dani-minuto`**, Framework Preset "Other", comandos de build e install vazios.

## O que ainda falta preencher

No painel, em Configurações: trocar a senha, preencher o WhatsApp (com o 55 na frente) e a chave
PIX, confirmar nome da marca e Instagram, e revisar preços e itens de cada protocolo. Os valores
atuais (R$ 197 / R$ 347 / R$ 597) são um ponto de partida, não uma decisão fechada.

## Ao continuar o trabalho

Mantenha o padrão: nada de framework, nada de dependência nova, nada de CDN. Respeite os três
princípios visuais, o peso light do display e as regras de texto acima. Se mudar uma frase que
também aparece nas artes de Instagram (`social/`), atualize as duas pontas.

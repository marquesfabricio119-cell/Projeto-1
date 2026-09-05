# Marca — Dani Minuto

Tudo aqui vem do **Manual de Identidade Visual "Vulcão"** (Lapidari, 2026). Onde este arquivo acrescenta
algo que não estava no manual, está marcado como **decisão de implementação**.

---

## 1. A marca em uma frase

> **Dani Minuto · A ponte entre os mundos**
> Uma marca pessoal que existe no espaço entre a ciência farmacêutica e a cura integrativa.
> Esta identidade não escolhe um lado — ela é a ponte.

Frase de sustentação: **"A ciência que sente. A cura que pensa."**

---

## 2. Símbolo

Dois círculos se sobrepõem — **carmim** (ciência, sol, matéria) e **ameixa** (espiritualidade, lua, etéreo).
A forma central que emerge é o espaço da Dani: a ponte. Funciona em positivo, negativo e monocromático.

> "Dois mundos que se encontram. A interseção é onde ela vive."

Já está desenhado e pronto no repositório, em SVG:

| Arquivo | Uso |
|---|---|
| `../marca/simbolo.svg` | Só o símbolo, colorido. Favicon, avatar, selo. |
| `../marca/simbolo-mono.svg` | Traço em `currentColor` — herda a cor do contexto. Fundos escuros, carimbo, bordado. |
| `../marca/logo.svg` | Símbolo + "Dani Minuto" + assinatura. Assinatura de peça, rodapé, papelaria. |

### Prompt para explorar variações

Se quiser testar caminhos alternativos num gerador de imagem (Midjourney, Ideogram, DALL·E):

```
Minimalist logo mark: two overlapping circles forming a vesica piscis, the intersection
subtly filled — the meeting point is the subject, not the circles.
Left circle outlined in deep carmine red (#B83240), right circle in muted plum (#7A4E6A),
on a warm blush cream background (#F8EDE8).
Thin uniform stroke, flat vector, no gradients, no 3D, no shadow.
Geometric precision, generous negative space, calm and quietly clinical.
Meaning: the bridge between pharmaceutical science and integrative healing — sun and moon
coexisting, never opposing.
Works at 40px and engraved on paper. No text, no letters, white background, vector-ready.
```

**Prompt negativo:**

```
text, letters, watermark, gradient, 3d, bevel, drop shadow, glossy, photorealistic,
yin yang symbol, infinity symbol, mandala, chakra, lotus, busy detail, cluttered, mockup
```

Depois de gerar: escolha 2 ou 3, **vetorize** (o gerador entrega PNG e PNG não escala), teste em 40 px de
altura e exporte em três versões — colorida, toda obsidiana e toda aurora.

---

## 3. Paleta "Vulcão"

| Cor | Hex | Papel | Significado |
|---|---|---|---|
| **Carmim** | `#B83240` | Primária | Fogo, força, presença |
| **Laranja Brasa** | `#D4782A` | Secundária | Calor, energia, vitalidade |
| **Ameixa** | `#7A4E6A` | Acento | Lua intensa, mistério |
| **Aurora** | `#F8EDE8` | Fundo | Calor suave, leveza |
| **Obsidiana** | `#1A0F0F` | Texto | Noite profunda |

**Regra de uso do manual:** Carmim + Aurora para conteúdo de estética e ciência. Ameixa + Aurora para
conteúdo integrativo e espiritual. Laranja Brasa como elemento de energia e chamada para ação.
Obsidiana substitui o preto puro em todos os textos.

### Tons derivados — decisão de implementação

O manual define cinco cores. Interface e artes precisam de lavagens e neutros intermediários; estes
saíram das próprias artes do manual, não foram inventados do zero:

| Tom | Hex | Uso |
|---|---|---|
| Lavagem carmim | `#FDEAEC` | Fundo de bloco do lado sol |
| Lavagem ameixa | `#F0EBF4` | Fundo de bloco do lado lua |
| Lavagem brasa | `#FDF0E6` | Avisos e destaques de energia |
| Areia | `#E8D8D0` | Fios sutis, campos de formulário |
| Tinta 2 | `#6B5654` | Texto secundário |
| Tinta 3 | `#9A8480` | Legendas e rótulos |

---

## 4. Uso de cor por contexto

| Lado | Cor | Conteúdo |
|---|---|---|
| **Sol** | Carmim | Hydrafacial · skincare · farmácia · consultorias · antes e depois |
| **Lua** | Ameixa | Reiki · Access Bars · meditação · ciclo feminino · espiritualidade |
| **Energia** | Laranja Brasa | Chamadas para ação · destaques · lançamentos |
| **Base** | Obsidiana + Aurora | Todo texto corrido · fundos de stories · layouts gerais |

> Sobre antes e depois: o manual prevê esse conteúdo no lado sol. Se for usar, tenha autorização por
> escrito de quem aparece e confira as regras de publicidade do seu conselho profissional — elas mudam
> conforme a profissão e o procedimento.

---

## 5. Tipografia

| Nível | Fonte | Tamanho | Uso |
|---|---|---|---|
| Display | GFS Baskerville / **Fraunces** | 32–40 pt | Títulos principais, capa, hero |
| H2 | Fraunces | 20–24 pt | Subtítulos de seção |
| H3 | Fraunces | 14–16 pt | Títulos de bloco |
| Itálico | Fraunces itálico | 13–16 pt | Citações, frases de efeito |
| Corpo | Sans neutra | 10–11 pt | Texto corrido, descrições |
| Caption | Sans neutra | 7–8 pt | Labels e legendas, caixa-alta, tracking 1,4 pt |

**Display sempre em peso light — nunca bold.** É a regra mais visível do manual: é o peso light que dá
o ar de presença sem esforço. No site e nas artes isso está travado em `font-weight: 300`.

**Decisão de implementação:** o manual nomeia "Liberation Sans" para o corpo — uma fonte de sistema.
Na web usamos `Inter`, que tem a mesma neutralidade e desenho melhor em tela, com `Liberation Sans` e
`Arial` como fallback. Fraunces e Inter estão salvas em `fontes/` (SIL Open Font License), então as
artes saem idênticas com ou sem internet.

---

## 6. Princípios visuais

**Essencialismo** — muito espaço em branco. Nenhum elemento decorativo sem função. O vazio é parte do
design: ele respira.

**Fluidez** — sem bordas duras, sem grades rígidas. Layouts que se movem como brasa, com calor e sem
violência. Na prática: profundidade vem de lavagem de cor e sombra difusa, nunca de contorno de 1px.

**Dualidade** — carmim e ameixa nunca competem. Coexistem como sol e lua: complementares, jamais opostos.

### Como isso aparece nas peças

O motivo gráfico recorrente é o **próprio símbolo em escala grande e translúcida** — dois círculos
que se sobrepõem, sangrando pela borda da arte. Ele nunca disputa com o texto (opacidade baixa) e nunca
vira moldura. É o mesmo gesto no site: as duas auras difusas atrás do título da página inicial.

---

## 7. Instagram

### Bio (limite de 150 caracteres)

**Opção 1 — a ponte (recomendada)**

```
A ponte entre os mundos
Farmacêutica · consultoria de skin care
Reiki · Access Bars · ciclo feminino
↓ comece pela sua anamnese
```

**Opção 2 — foco em skin care**

```
Farmacêutica · skin care com anamnese completa
A ciência que sente. A cura que pensa.
Protocolo feito para a sua pele, não para a internet
↓
```

**Opção 3 — pela dor**

```
Sua pele merece um plano, não um palpite
Consultoria de skin care com anamnese completa
Orientação estética — não substitui dermato
↓
```

### Campo "Nome"

```
Dani Minuto | Skin Care e Terapias Integrativas
```

Esse campo é indexado na busca do Instagram. Deixar só "Dani Minuto" desperdiça a chance de aparecer
para quem procura "consultoria de pele" ou "reiki".

### Destaques

`A ponte` · `Anamnese` · `Como funciona` · `Protocolos` · `Lado sol` · `Lado lua` · `Dúvidas`

### Link da bio

Aponte direto para a página de vendas. Se usar agregador de links, deixe "Fazer minha anamnese" como
primeiro item.

---

## 8. Tom de voz

- Fala com a cliente, não sobre ela. "Sua pele", não "a pele da mulher moderna".
- Explica o porquê antes do quê. Nunca dá regra sem motivo.
- Não promete resultado, não vende medo, não chama nada de milagre.
- Diz o limite em voz alta: quando o caso é de dermatologista, ela fala.
- Nenhum dos dois lados desqualifica o outro. É o princípio da dualidade aplicado ao texto.

---

*Manual original: Lapidari · Estratégia de Marca · 2026.*

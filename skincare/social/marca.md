# Marca — prompt da logo, bio e identidade

## 1. Prompt da logo

Cole em Midjourney, DALL·E, Ideogram ou similar. O primeiro é o principal; os outros são caminhos
alternativos para você comparar.

### Prompt principal

```
Minimalist logo mark for a skincare consultancy called "Duda Skin Care".
A single elegant water droplet whose lower curve doubles as a woman's chin and jawline in
profile — one continuous line, negative space doing the work.
Flat vector, no gradients, no 3D, no shadows. Two colors only: warm nude terracotta (#C08E72)
on a soft cream background (#FBF7F3).
Geometric precision, generous negative space, calm and clinical rather than decorative.
Centered, balanced, works at 40px and on a signboard.
Style reference: modern editorial branding, boutique dermatology clinic, Scandinavian restraint.
White background, high resolution, vector-ready, no text, no letters.
```

### Variação A — monograma

```
Elegant monogram logo, letter "D" formed by a water droplet silhouette, single weight line,
warm nude terracotta (#C08E72) on cream (#FBF7F3). Flat vector, geometric, minimal,
generous negative space, luxury skincare brand. No text besides the letterform, no gradients,
no 3D, white background, vector-ready.
```

### Variação B — botânico contido

```
Minimal skincare logo: a droplet and two small leaves rendered as one continuous thin line,
sage green (#7C8C7A) and warm nude (#C08E72) on cream (#FBF7F3). Flat vector, delicate,
symmetric, apothecary feel, lots of white space. No text, no gradients, no 3D, white background.
```

### Prompt negativo (onde o gerador aceitar)

```
text, letters, words, watermark, gradient, 3d, bevel, drop shadow, glossy, photorealistic,
stock photo, busy detail, multiple objects, cluttered, face photo, realistic skin, mockup
```

### Como usar o resultado

1. Gere 8 a 12 variações e escolha 2 ou 3.
2. Peça para **vetorizar** (o gerador entrega PNG, e logo em PNG não escala). Vectorizer.ai, Illustrator
   (Traçado de imagem) ou Inkscape (Traçar bitmap) resolvem.
3. Teste em 40 px de altura. Se não der para reconhecer, simplifique.
4. Exporte três versões: colorida, toda preta e toda branca.
5. Guarde o SVG final em `skincare/marca/`, substituindo `logo.svg` e `simbolo.svg`.

> Já existe uma logo provisória pronta em `skincare/marca/logo.svg` e `simbolo.svg` — a gota sobre círculo
> nude que aparece nas artes. Ela funciona; o prompt acima é para quando você quiser uma versão autoral.

---

## 2. Bio do Instagram

O limite é 150 caracteres. As três opções cabem.

### Opção 1 — direta (recomendada)

```
Consultoria de skin care 🌿
Anamnese completa + rotina feita pra sua pele
Chega de comprar por indicação de vídeo
👇 comece pela sua anamnese
```

### Opção 2 — pela dor

```
Sua pele não precisa de mais produto 🌿
Precisa dos produtos certos, na ordem certa
Consultoria com anamnese completa
👇 monte a sua rotina
```

### Opção 3 — com autoridade e limite claro

```
Duda · consultoria de skin care 🌿
Rotina personalizada a partir de anamnese completa
Orientação estética — não substitui dermato
👇
```

### Campo "Nome" (o que o Instagram usa na busca)

```
Duda | Consultoria de Skin Care
```

Esse campo é indexado na busca. Deixar só "Duda" desperdiça a chance de aparecer para quem procura
"skin care" ou "consultoria de pele".

### Destaques (capas dos stories)

`Anamnese` · `Como funciona` · `Planos` · `Rotinas` · `Dúvidas` · `Antes de comprar`

### Link da bio

Aponte direto para `/skincare/` (a página de vendas). Se usar agregador de links, deixe
"Fazer minha anamnese" como o primeiro item.

---

## 3. Identidade visual (o que as artes seguem)

### Cores

| Uso | Cor | Hex |
|---|---|---|
| Fundo claro | Creme | `#FBF7F3` |
| Fundo alternativo | Creme rosado | `#F1E7DD` |
| Fundo escuro | Tinta | `#2E2A28` |
| Texto | Tinta | `#2E2A28` |
| Texto secundário | Tinta suave | `#6B615B` |
| Destaque principal | Nude | `#C08E72` |
| Destaque escuro (texto) | Nude escuro | `#A8724F` |
| Apoio | Sage | `#7C8C7A` |
| Fios e bordas | Linha | `#DCCFC2` |

### Tipografia

- **Fraunces** — títulos e números. Serifada com personalidade, dá o tom editorial.
- **Inter** — textos, legendas e rótulos. Neutra e legível em tela pequena.

Ambas são gratuitas (SIL Open Font License) e estão em `fontes/`.

### O motivo visual: a ficha

As artes imitam uma **ficha de anamnese**: fio grosso no topo, rótulo em caixa-alta espaçada
("FICHA 01"), linhas de campo, caixas de marcar. É o que diferencia visualmente de qualquer perfil de
skin care — a marca vende justamente o método, não o produto.

Mantenha isso: numere as fichas em sequência (`FICHA 07`, `FICHA 08`…) conforme publica.

### Tom de voz

- Fala com a cliente, não sobre ela. "Sua pele", não "a pele da mulher moderna".
- Explica o porquê antes do quê. Nunca dá regra sem motivo.
- Não promete resultado, não vende medo, não chama nada de milagre.
- Diz o limite em voz alta: quando o caso é de dermatologista, você fala.
- Frase de sustentação da marca: **"Sua pele merece um plano, não um palpite."**

### O que nunca entra nas artes

- Antes e depois de pele (o Conselho Federal de Medicina restringe, e para consultoria estética é
  terreno perigoso).
- Depoimento inventado. Só publique depoimento real, com autorização de quem escreveu.
- Promessa de cura, de "acabar com a acne", de resultado em X dias.
- Indicação de medicamento — inclusive os "que todo mundo usa".

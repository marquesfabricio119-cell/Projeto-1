# Instagram — artes, legendas e marca

Kit de conteúdo da consultoria: 15 artes prontas para postar, as legendas de cada uma, o prompt para
gerar a logo e as opções de bio.

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `png/` | **As artes prontas.** 12 posts em 1080×1350 e 3 stories em 1080×1920. |
| `legendas.md` | A legenda de cada arte, com hashtags e o calendário da primeira semana. |
| `marca.md` | Prompt da logo, opções de bio, paleta, tipografia e tom de voz. |
| `posts.html` | O arquivo-fonte das artes. Edite aqui para mudar texto ou criar novas. |
| `gerar.mjs` | Exporta cada arte de `posts.html` como PNG no tamanho nativo. |
| `fontes/` | Fraunces e Inter (SIL Open Font License), para as artes saírem sempre iguais. |

## As artes

**Carrossel "5 erros que fazem a sua pele piorar"** — poste as 7 nesta ordem:
`c1-capa` · `c1-erro1` · `c1-erro2` · `c1-erro3` · `c1-erro4` · `c1-erro5` · `c1-fecho`

**Posts avulsos:** `p-tipo` (tipo de pele) · `p-anamnese` (o que é anamnese) · `p-como` (como funciona) ·
`p-rotina` (3 passos) · `p-planos` (preços)

**Stories:** `s-enquete` (com enquete por cima) · `s-cta` (com sticker de link) · `s-erro` (link para o post)

## Antes de postar

1. Troque `@dudaskincare` pelo perfil real — está em `posts.html` (constante no rodapé de cada arte) e
   nas legendas.
2. Confira os preços em `p-planos`: eles precisam bater com os planos cadastrados no painel do site.
3. Coloque o link do site na bio antes de publicar qualquer arte que diga "link na bio".

## Mudando um texto ou criando arte nova

Todo o conteúdo está no array `ARTES` dentro de `posts.html`. Cada item tem um `id` (vira o nome do PNG),
uma `classe` opcional (`escura`, `nude`, `story`) e o `html`. Os componentes prontos são `topo()`,
`rodape()`, `campo()` e `passo()`.

Depois de editar, gere de novo:

```bash
# na raiz do repositório
python3 -m http.server 8799 &
cd skincare/social && node gerar.mjs
```

Os PNGs saem em `png/`, com o mesmo nome do `id`. É preciso ter o Playwright instalado
(`npm i playwright`) e um Chromium disponível — ajuste a variável `CHROME` se o caminho for outro.

## Limites que o conteúdo respeita

As artes e legendas foram escritas para não passar do que uma consultoria de skin care pode dizer:
nada de promessa de cura, de indicação de medicamento ou de antes e depois. Todo material que fala de
preço ou de tratamento carrega o aviso de que não substitui consulta médica. Mantenha isso ao criar
artes novas — o detalhamento está no fim de `marca.md`.

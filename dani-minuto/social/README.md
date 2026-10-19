# Instagram — artes, legendas e marca

Kit de conteúdo da Dani Minuto: 18 artes prontas para postar, as legendas de cada uma, e o material
de marca (símbolo, paleta Vulcão, tipografia, bio e tom de voz).

Tudo segue o **Manual de Identidade Visual "Vulcão"** (Lapidari, 2026).

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `png/` | **As artes prontas.** 15 posts em 1080×1350 e 3 stories em 1080×1920. |
| `legendas.md` | A legenda de cada arte, com hashtags e o calendário da primeira semana. |
| `marca.md` | Símbolo, paleta Vulcão, tipografia, uso de cor por contexto, bio e tom de voz. |
| `posts.html` | O arquivo-fonte das artes. Edite aqui para mudar texto ou criar novas. |
| `gerar.mjs` | Exporta cada arte de `posts.html` como PNG no tamanho nativo. |
| `fontes/` | Fraunces e Inter (SIL Open Font License), para as artes saírem sempre iguais. |

## As artes

**Carrossel "5 erros que fazem a sua pele piorar"** — poste as 7 nesta ordem:
`c1-capa` · `c1-erro1` · `c1-erro2` · `c1-erro3` · `c1-erro4` · `c1-erro5` · `c1-fecho`

**Posts avulsos:**

| Arte | Assunto | Lado |
|---|---|---|
| `p-manifesto` | "A ciência que sente. A cura que pensa." | obsidiana |
| `p-tipo` | Qual é o seu tipo de pele | sol |
| `p-anamnese` | O que é uma anamnese de pele | sol |
| `p-ciclo` | Sua pele muda com o seu ciclo | lua |
| `p-como` | Como funciona a consultoria | sol |
| `p-rotina` | Rotina de 3 passos | obsidiana |
| `p-dois-mundos` | Ciência e inteireza lado a lado | ponte |
| `p-planos` | Preços | sol |

**Stories:** `s-enquete` (com enquete por cima) · `s-cta` (com sticker de link) · `s-erro` (link para o post)

## Antes de postar

1. Troque `@daniminuto` pelo perfil real — está em `posts.html` (no rodapé de cada arte) e nas legendas.
2. Confira os preços em `p-planos`: eles precisam bater com os planos cadastrados no painel do site.
3. Coloque o link do site na bio antes de publicar qualquer arte que diga "link na bio".

## Mudando um texto ou criando arte nova

Todo o conteúdo está no array `ARTES` dentro de `posts.html`. Cada item tem um `id` (vira o nome do PNG),
uma `classe` opcional (`sol`, `lua`, `escura`, `story`) e o `html`. Os componentes prontos são `topo()`,
`rodape()`, `item()`, `passo()` e `MUNDOS()` — este último desenha o símbolo em escala como fundo.

As classes de fundo seguem a regra de cor do manual: `sol` para conteúdo de estética e ciência, `lua`
para conteúdo integrativo, `escura` para manifesto e base, e o laranja brasa reservado aos botões de
chamada para ação.

Depois de editar, gere de novo:

```bash
# na raiz do repositório
python3 -m http.server 8799 &
cd dani-minuto/social && node gerar.mjs
```

Os PNGs saem em `png/`, com o mesmo nome do `id`. É preciso ter o Playwright instalado
(`npm i playwright`) e um Chromium disponível — ajuste a variável `CHROME` se o caminho for outro.

## Limites que o conteúdo respeita

As artes e legendas foram escritas para não passar do que uma consultoria de skin care pode dizer:
nada de promessa de cura nem de indicação de medicamento. Todo material que fala de preço ou de
tratamento carrega o aviso de que não substitui consulta médica.

O manual prevê antes e depois no lado sol. Se for usar, tenha autorização por escrito de quem aparece
e confira as regras de publicidade do conselho profissional — o detalhamento está em `marca.md`.

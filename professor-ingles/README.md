# Seu Professor de Inglês com IA — Idioma Visual

Aplicativo que acompanha o kit de mais de 360 mapas mentais de inglês. É a parte que o
comprador vê **depois** de pagar: um professor de IA que conversa, corrige e explica em
português, uma biblioteca de comandos prontos, os mapas para crianças e um guia de uso.

Interface 100% em português do Brasil. Feito para celular primeiro — tudo funciona a partir
de 360 px de largura.

---

## Telas

| Endereço    | O que é                                                               |
| ----------- | --------------------------------------------------------------------- |
| `/entrar`   | Código de acesso compartilhado e nome opcional                        |
| `/`         | Início, com os quatro cartões e o contador de conversas               |
| `/chat`     | O Professor: 4 perguntas na primeira visita e o chat em streaming     |
| `/comandos` | 200 comandos prontos, com busca, cópia e "Usar no chat"               |
| `/criancas` | 60 mapas ilustrados em 6 blocos, com visualizador em tela cheia       |
| `/guia`     | Guia de uso em seis seções                                            |

---

## Como rodar no seu computador

Você precisa do Node.js 18 ou mais novo.

```bash
cd professor-ingles
npm install
cp .env.example .env        # e coloque a sua chave em ANTHROPIC_API_KEY
npm run dev
```

Abra <http://localhost:5173>. O código de acesso é **`PROFESSOR17`**.

O `npm run dev` já serve a função `/api/chat` junto com o site (isso é feito pelo plugin
`api-em-desenvolvimento`, dentro de `vite.config.ts`), então não é preciso instalar a CLI
da Vercel para desenvolver.

Outros comandos:

```bash
npm run build     # confere os tipos e gera a pasta dist/
npm run preview   # abre a versão de produção (sem a função /api)
```

---

## A chave da API

**A chave nunca aparece no navegador.** Ela é lida de uma variável de ambiente dentro da
função `/api/chat.ts`, que roda no servidor. O site só conhece o endereço `/api/chat`.

| Variável                     | Obrigatória | Para que serve                                        |
| ---------------------------- | ----------- | ----------------------------------------------------- |
| `ANTHROPIC_API_KEY`          | sim         | Chave da API da Anthropic                             |
| `TUTOR_MODELO`               | não         | Modelo usado (padrão: `claude-sonnet-5`)              |
| `TUTOR_LIMITE_MENSAGENS_HORA`| não         | Limite de mensagens por sessão por hora (padrão: 30)  |
| `ANTHROPIC_BASE_URL`         | não         | Endereço da API (só para testes)                      |

> Nunca use o prefixo `VITE_` nessas variáveis. Tudo que começa com `VITE_` é embutido no
> arquivo que o navegador baixa e ficaria visível para qualquer pessoa.

### Onde colocar a chave na Vercel

1. Abra o projeto na Vercel.
2. Vá em **Settings → Environment Variables**.
3. Crie `ANTHROPIC_API_KEY` com o valor da sua chave.
4. Marque os ambientes **Production**, **Preview** e **Development**.
5. Clique em **Save** e faça um novo deploy (**Deployments → ⋯ → Redeploy**).

### Publicando

Este aplicativo fica na pasta `professor-ingles/` do repositório. Na Vercel, em
**Settings → General → Root Directory**, aponte para `professor-ingles`. O resto
(`framework`, build e rotas) já está no `vercel.json` da pasta.

---

## Como trocar o código de acesso

Abra `src/lib/acesso.ts` e mude uma linha:

```ts
export const CODIGO_DE_ACESSO = 'PROFESSOR17';
```

Publique de novo e o código novo passa a valer. A comparação ignora maiúsculas, minúsculas
e espaços sobrando.

Vale ser honesto sobre o que esse código é: como ele é compartilhado e conferido no
navegador, quem abrir o código-fonte do site consegue vê-lo. Ele cumpre o mesmo papel da
senha da área de membros — manter a porta fechada para quem não comprou. Quem precisa
mesmo de sigilo é a chave da API, e essa fica só no servidor.

---

## Como adicionar ou trocar os mapas para crianças

As imagens são lidas de um manifesto, então dá para mexer na galeria sem tocar em código.

1. Coloque o arquivo da imagem em `public/mapas/`.
2. Abra `public/data/criancas.json` e acrescente a linha dentro do bloco certo:

```json
{
  "blocos": [
    {
      "nome": "Meu mundo",
      "mapas": [
        { "arquivo": "/mapas/meu-mundo-01.svg", "titulo": "A família · Family" }
      ]
    }
  ]
}
```

- `arquivo` é o caminho a partir de `public/` — sempre começando com `/mapas/`.
- `titulo` é o que aparece embaixo da miniatura e no visualizador (serve também de texto
  alternativo para quem usa leitor de tela).
- Os blocos aparecem na ordem do arquivo. Para criar um bloco novo, é só acrescentar outro
  item em `blocos`.

Os 60 arquivos que vêm no repositório são provisórios (SVG simples com a palavra em inglês
e a tradução). Substitua pelas ilustrações reais mantendo os mesmos nomes de arquivo, ou
troque os nomes no manifesto.

---

## Como completar os 200 comandos

O arquivo `src/data/comandos.ts` já traz **8 comandos reais por categoria** (80 no total) e
um marcador `TODO: faltam 12 comandos` no fim de cada categoria, com os números de `id`
livres anotados. Cole os textos que faltam seguindo o mesmo formato:

```ts
{ id: 9, categoria: 'Conversa do dia a dia', texto: 'Seu comando aqui com [algo para trocar].' },
```

A busca, os filtros e os botões da tela `/comandos` leem essa lista sozinhos — nenhum outro
arquivo precisa ser alterado. Os trechos entre `[colchetes]` são destacados na cor do app
automaticamente.

---

## Como o professor funciona por dentro

- `api/_lib/prompt.ts` — o texto do professor "Alex" e o bloco `PERFIL DO ALUNO` que é
  acrescentado ao prompt em toda requisição.
- `api/_lib/provedor.ts` — o único arquivo que conhece o provedor do modelo. Para trocar de
  provedor, reescreva só ele.
- `api/_lib/limite.ts` — o limite de mensagens por hora.
- `api/chat.ts` — junta as três coisas e devolve a resposta em streaming (SSE), para o
  professor "digitar" na tela em vez de aparecer tudo de uma vez.

Limites e proteções já embutidos:

- teto de **4000 tokens** por resposta;
- **30 mensagens por hora** por sessão, com um aviso em português quando estoura (nunca um
  erro cru do tipo 429);
- qualquer falha vira a mesma frase na tela: *"O professor não conseguiu responder agora.
  Tente de novo daqui a pouco."*

O limite por hora é guardado na memória da instância que atende a requisição. Como a Vercel
pode ter várias instâncias no ar, o número real por sessão pode passar um pouco de 30. Para
um controle exato seria preciso um Redis, e este projeto foi pedido sem banco de dados.

---

## Onde ficam os dados do aluno

Não existe banco de dados nem conta de usuário. Tudo fica no `localStorage` do próprio
aparelho, com o prefixo `professor-ingles:`: acesso, nome, perfil das 4 perguntas, a
conversa inteira, o contador de conversas e o tema escolhido. Sair pelo botão **Sair**
apaga só a marca de acesso — a conversa continua ali quando a pessoa voltar a entrar.

---

## Estrutura

```
professor-ingles/
├── api/
│   ├── chat.ts              função serverless (Edge) que fala com o modelo
│   └── _lib/                prompt, provedor e limite por hora
├── public/
│   ├── data/criancas.json   manifesto dos mapas
│   └── mapas/               as 60 imagens
├── src/
│   ├── components/          cabeçalho, assistente de perfil, gaveta de comandos…
│   ├── data/comandos.ts     a biblioteca de comandos
│   ├── lib/                 acesso, localStorage, cliente do chat, tipos
│   ├── pages/               Entrar, Início, Chat, Comandos, Crianças, Guia
│   └── index.css            as cores e o tema (claro e escuro)
├── vercel.json
└── vite.config.ts
```

# Dani Minuto — site da consultoria + anamnese

Site onde as clientes **compram a consultoria de skin care**, recebem um código de acesso e
**fazem a anamnese** (o quiz da anamnese) na própria área. A Dani acompanha tudo pelo painel.

HTML/CSS/JS puro, sem framework. A identidade visual segue o Manual "Vulcão" (Lapidari, 2026) —
paleta, tipografia e princípios estão documentados em `social/marca.md`.

## Páginas

| Arquivo         | O que é                                                                              |
|-----------------|--------------------------------------------------------------------------------------|
| `index.html`    | Página de vendas: proposta, o que está incluso, planos, prévia da anamnese e dúvidas.  |
| `checkout.html` | Dados da cliente → gera o **código de acesso** e mostra o PIX.                          |
| `area.html`     | Área da cliente: entra com código + e-mail, vê o status e faz/rever a anamnese.        |
| `anamnese.html` | **O quiz da anamnese**: uma pergunta por tela, salva sozinho, revisão final e envio.      |
| `admin.html`    | Painel da Dani: pedidos, anamneses, exclusões, configurações e backup.                  |
| `app.js`        | Núcleo: estado, sincronização, sessão, cabeçalho e rodapé.                             |
| `quiz.js`       | Perguntas da anamnese e a leitura automática do resultado.                             |
| `social/`       | Kit de Instagram: 18 artes prontas, legendas e o material de marca.                     |

## O fluxo

1. **Compra** — a cliente escolhe o plano, preenche nome, e-mail e WhatsApp e aceita o aviso de que
   a consultoria não substitui consulta médica. O sistema gera um código `DM-XXXXXX`, cria o pedido
   como `pendente` e mostra a chave PIX.
2. **Comprovante** — ela manda o PIX pelo WhatsApp. No painel, a Dani clica em *Confirmar pago*.
3. **Anamnese** — com o código, a cliente entra na área e responde o quiz. Ela já pode responder antes
   da confirmação do pagamento; as respostas ficam salvas no aparelho enquanto ela avança.

   O quiz mostra **uma pergunta por tela**. Escolher uma resposta única já avança sozinho; múltipla
   escolha e texto têm botão. Funciona no teclado — `1`–`9` escolhem, `Enter` continua, `Backspace`
   volta — e cada bloco novo abre com uma tela de passagem, para dar ritmo. Na revisão final dá para
   editar qualquer resposta e voltar direto para ela.
4. **Leitura automática** — ao enviar, o sistema calcula um primeiro perfil (tipo de pele,
   sensibilidade, barreira, fotoproteção, prioridades e um esqueleto de rotina) e levanta **alertas de
   segurança** para a Dani.
5. **Protocolo** — a Dani revisa tudo no painel, escreve suas anotações e entrega o protocolo.

## A anamnese

Seis blocos, com perguntas condicionais (quem marca acne recebe as perguntas de acne, e assim por diante):

1. **Sua pele hoje** — oleosidade, comportamento após a lavagem, sensibilidade, poros e conforto.
2. **Suas queixas** — até 4 queixas principais, grau e local da acne, origem das manchas, há quanto tempo.
3. **Sua rotina atual** — o que usa, protetor solar, número de lavagens, reação a ácidos e retinol, maquiagem.
4. **Saúde e segurança** — gestação/amamentação, isotretinoína, diagnósticos, procedimentos recentes,
   alergias, medicamentos e ciclo hormonal.
5. **Rotina e estilo de vida** — sol, sono, água, estresse e hábitos.
6. **Seus objetivos** — objetivo principal, tempo disponível, faixa de investimento e o que já tem em casa.

### A leitura automática

`calcularResultado()` em `quiz.js` cruza as respostas e devolve:

- **Tipo de pele** (oleosa, mista, mista com desidratação, normal, normal a seca, seca)
- **Sensibilidade** (baixa / moderada / alta)
- **Barreira cutânea** (íntegra / em atenção / comprometida)
- **Fotoproteção** (adequada / boa, falta reaplicar / insuficiente / ausente)
- **Maturidade da rotina** (iniciante → avançada)
- **Prioridades** do tratamento e um **esqueleto de rotina** manhã/noite
- **Alertas de segurança**: gestação, amamentação, isotretinoína, rosácea, melasma, dermatite,
  procedimento recente, acne inflamatória, sensibilidade alta, sabonete de corpo no rosto

Isso **não é diagnóstico** — é a primeira leitura que a Dani revisa antes de montar o protocolo.
As telas deixam isso explícito para a cliente.

## Antes de publicar

Entre em `admin.html` (senha inicial **`dani123`**) e preencha em *Configurações*:

- **Troque a senha do painel** — é a primeira coisa a fazer.
- **WhatsApp** com código do país (ex.: `5511999999999`) — sem isso os botões de WhatsApp abrem sem destino.
- **Chave PIX** e nome do titular — sem isso o checkout pede para a cliente chamar no WhatsApp.
- Nome da marca, assinatura, Instagram, e-mail, título e subtítulo da página inicial.
- Nome, preço e itens de cada plano.

## Excluindo coisas

No painel:

- **Excluir pedido** — apaga o pedido e, junto, a anamnese dele. A cliente perde o acesso por aquele código.
- **Excluir anamnese** — apaga só as respostas (pela lista ou de dentro da ficha). O pedido continua ativo e a
  cliente pode responder de novo pela área dela — útil quando ela pede para refazer.
- **Remover plano** (em *Configurações*) — tira o plano do site. Pedidos já feitos nele continuam na lista.
  O site sempre mantém pelo menos um plano.
- **Cancelar** é diferente de excluir: mantém o registro na lista, só marca como cancelado.

Toda exclusão pede confirmação e não tem volta. Os ids excluídos ficam guardados em `removidos` para que um
registro apagado num aparelho não reapareça ao sincronizar com outro.

## Dados e sincronização

Tudo fica num único JSON: `{ settings, orders, anamneses, removidos }`.

- Grava sempre no `localStorage` (chave `daniMinutoDB`) e tenta o Supabase em seguida.
- Supabase: tabela `loja_roupas_db`, linha `id = 'dani_minuto'` — separada da linha `main`, que é do sistema da loja.
- Toda chamada de rede tem prazo de 8s; sem internet, o site continua funcionando com os dados locais.
- Ao reler a nuvem, pedidos e anamneses criados offline são preservados (união por `id`).
- Rascunho da anamnese: `daniMinutoRascunho:DM-XXXXXX`, apagado no envio.

## Limitações conhecidas

- A chave do Supabase é pública (site estático), então **a proteção real precisa vir das políticas de RLS
  do banco**. A senha do painel só esconde a interface — não é uma barreira de segurança.
- Pagamento é PIX manual, conferido pela consultora. Não há gateway integrado.
- Sem upload de fotos: peça as fotos da pele pelo WhatsApp.

## Publicando na Vercel

O repositório tem dois projetos independentes: a raiz é o sistema da Estilo & Cia, e o site da Dani está
nesta pasta. Por isso o deploy precisa apontar para cá — senão o domínio mostra o login da loja de roupas.

Na Vercel:

1. **Add New → Project** e importe `marquesfabricio119-cell/Projeto-1`.
2. Em **Project Name**, dê o nome desejado (ele vira o endereço `<nome>.vercel.app`).
3. Em **Root Directory**, clique em *Edit* e escolha **`dani-minuto`**. É este passo que faz a diferença.
4. Framework Preset: **Other**. Build Command e Install Command ficam vazios — é HTML estático.
5. **Deploy**.

O `vercel.json` desta pasta já cuida do resto: URLs sem `.html`, cache longo para fontes e imagens,
cache curto para o CSS e o JS (para correção entrar na hora) e `noindex` nas páginas internas
(`/admin`, `/area`, `/anamnese`, `/checkout`), que não devem aparecer no Google.

Depois do primeiro deploy, cada push no branch publica sozinho.

## Rodando localmente

```bash
python3 -m http.server 8765
```

E acesse `http://localhost:8765/dani-minuto/`.

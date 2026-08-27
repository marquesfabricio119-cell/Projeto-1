# Consultoria de Skin Care — site + anamnese

Site onde as clientes **compram a consultoria de skin care**, recebem um código de acesso e
**fazem a anamnese** (o quiz da anamnese) na própria área. A consultora acompanha tudo pelo painel.

HTML/CSS/JS puro, sem framework — no mesmo padrão do resto do repositório.

## Páginas

| Arquivo         | O que é                                                                              |
|-----------------|--------------------------------------------------------------------------------------|
| `index.html`    | Página de vendas: proposta, o que está incluso, planos, prévia da anamnese e dúvidas.  |
| `checkout.html` | Dados da cliente → gera o **código de acesso** e mostra o PIX.                          |
| `area.html`     | Área da cliente: entra com código + e-mail, vê o status e faz/rever a anamnese.        |
| `anamnese.html` | **O quiz da anamnese**: 6 blocos, salva sozinho, revisão final e envio.                 |
| `admin.html`    | Painel da consultora: pedidos, anamneses, exclusões, configurações e backup.            |
| `app.js`        | Núcleo: estado, sincronização, sessão, cabeçalho e rodapé.                             |
| `quiz.js`       | Perguntas da anamnese e a leitura automática do resultado.                             |

## O fluxo

1. **Compra** — a cliente escolhe o plano, preenche nome, e-mail e WhatsApp e aceita o aviso de que
   a consultoria não substitui consulta médica. O sistema gera um código `SKIN-XXXXXX`, cria o pedido
   como `pendente` e mostra a chave PIX.
2. **Comprovante** — ela manda o PIX pelo WhatsApp. No painel, a consultora clica em *Confirmar pago*.
3. **Anamnese** — com o código, a cliente entra na área e responde o quiz. Ela já pode responder antes
   da confirmação do pagamento; as respostas ficam salvas no aparelho enquanto ela avança.
4. **Leitura automática** — ao enviar, o sistema calcula um primeiro perfil (tipo de pele,
   sensibilidade, barreira, fotoproteção, prioridades e um esqueleto de rotina) e levanta **alertas de
   segurança** para a consultora.
5. **Protocolo** — a consultora revisa tudo no painel, escreve suas anotações e entrega o protocolo.

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

Isso **não é diagnóstico** — é a primeira leitura que a consultora revisa antes de montar o protocolo.
As telas deixam isso explícito para a cliente.

## Antes de publicar

Entre em `admin.html` (senha inicial **`duda123`**) e preencha em *Configurações*:

- **Troque a senha do painel** — é a primeira coisa a fazer.
- **WhatsApp** com código do país (ex.: `5511999999999`) — sem isso os botões de WhatsApp abrem sem destino.
- **Chave PIX** e nome do titular — sem isso o checkout pede para a cliente chamar no WhatsApp.
- Nome da marca, Instagram, e-mail, título e subtítulo da página inicial.
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

- Grava sempre no `localStorage` (chave `skincareDB`) e tenta o Supabase em seguida.
- Supabase: tabela `loja_roupas_db`, linha `id = 'skincare'` — separada da linha `main`, que é do sistema da loja.
- Toda chamada de rede tem prazo de 8s; sem internet, o site continua funcionando com os dados locais.
- Ao reler a nuvem, pedidos e anamneses criados offline são preservados (união por `id`).
- Rascunho da anamnese: `skincareAnamneseDraft:SKIN-XXXXXX`, apagado no envio.

## Limitações conhecidas

- A chave do Supabase é pública (site estático), então **a proteção real precisa vir das políticas de RLS
  do banco**. A senha do painel só esconde a interface — não é uma barreira de segurança.
- Pagamento é PIX manual, conferido pela consultora. Não há gateway integrado.
- Sem upload de fotos: peça as fotos da pele pelo WhatsApp.

## Rodando localmente

```bash
python3 -m http.server 8765
```

E acesse `http://localhost:8765/skincare/`.

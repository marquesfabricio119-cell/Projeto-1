# Estilo & Cia — Sistema de Loja de Roupas

Sistema completo para loja de roupas feminina (ERP/PDV) + loja virtual integrada + identidade visual.
HTML/CSS/JS puro, sem framework. Estado em `localStorage`, sincronizado com Supabase (estado inteiro num JSON).

## Login padrão

- Usuário: `admin`
- Senha: `1234`

⚠️ Troque a senha em **Configurações → Usuários** assim que possível.

## Estrutura

- `index.html` + `app.js` + `style.css` — sistema (Painel, PDV, Produtos, Estoque, Clientes, Vendas, Caixa,
  Financeiro, Gastos Mensais, Abrir Loja, Relatórios, Configurações)
- `loja/index.html` — loja virtual (arquivo único, lê o mesmo Supabase)
- `marca/` — `logo.svg`, `simbolo.svg`, `identidade.html` (manual da marca)
- `skincare/` — **site da consultoria de skin care**: página de vendas, checkout com código de acesso,
  área da cliente, quiz da anamnese e painel da consultora. Projeto independente do sistema da loja —
  veja `skincare/README.md`.

## Funcionalidades

- **PDV**: busca/bipe de código de barras, variações tamanho/cor, desconto, cliente, PIX/Dinheiro/Débito/Crédito,
  comprovante com impressão.
- **Leitor de código de barras**: campo `barcode` por variação. Bipagem por câmera (BarcodeDetector) com fallback
  de digitação manual em PDV, Estoque (entrada/saída) e cadastro de Produtos.
- **Produtos**: SKU, categoria, marca, custo/venda, variações com estoque e código de barras; foto (URL),
  descrição, opção "Mostrar na loja virtual", selo NOVO.
- **Estoque**: entrada/saída por bipe, ajuste manual, alerta de estoque mínimo configurável.
- **Clientes**: cadastro simples com histórico de compras.
- **Vendas**: histórico completo; cancelamento devolve estoque; pedidos da loja virtual com fluxo
  Pendente → Pago (gera receita no Financeiro) → Entregue.
- **Caixa**: abertura/fechamento, sangria, reforço, resumo por forma de pagamento.
- **Financeiro**: receitas/despesas, contas a pagar/receber, saldo do mês (vendas entram automaticamente).
- **Gastos Mensais**: controle recorrente de despesas fixas da loja — Aluguel, Água, Luz, Internet, Telefone,
  Manutenção, Salários e encargos, Contador, Segurança/Alarme, Embalagens, Marketing, IPTU, Taxas de maquininha,
  Limpeza e outras categorias personalizáveis. Marcar como pago lança automaticamente no Financeiro.
- **Abrir Loja (custos de implantação)**: previsto × pago × falta, por categoria (Ponto/Aluguel, Reforma, Mão de
  obra, Móveis, Equipamentos, Estoque inicial, Documentação, Marketing, Outros).
- **Relatórios**: gráfico de vendas dos últimos 7 dias, ticket médio, top produtos, vendas por forma de
  pagamento e por vendedor(a).
- **Configurações**: nome da loja, estoque mínimo, usuários (admin/vendedor), backup em JSON (exportar/importar),
  e dados da loja virtual (WhatsApp, chave PIX, endereço, frase do topo).

## Loja virtual

Catálogo por categoria (produto aparece se `showInStore !== false` e houver estoque), página do produto com
seleção de tamanho/cor, sacola (`localStorage` `estiloCiaCart`), checkout que revalida estoque direto no
Supabase, dá baixa no estoque, cria cliente + venda (`origem: 'loja'`, `status: 'pendente'`), mostra a chave PIX
e abre o WhatsApp da loja com o resumo do pedido. Pagamento é manual via PIX (sem gateway integrado, por ora).

## Sincronização (Supabase)

Tabela `loja_roupas_db`: `id = 'main'`, `data` (jsonb = estado inteiro do sistema), `updated_at`.
O app faz `cloudPull()` ao abrir e `cloudPush()` (debounce de 800ms) a cada alteração salva localmente.

## Rodando localmente

Como é HTML/CSS/JS puro, basta servir a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8765
```

E acessar `http://localhost:8765`.

## Pendências

- Preencher em Configurações: WhatsApp real da loja, chave PIX, endereço.
- Criar usuários das vendedoras (perfil "Vendedor(a)").
- Futuro possível: gateway de pagamento real (Mercado Pago/PIX automático), fotos dos produtos via upload
  (hoje é URL manual).

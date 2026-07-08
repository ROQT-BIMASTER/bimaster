# Integração iPaper × Estoque Huugs (automação do catálogo)

## Problema

Hoje o time monta manualmente a planilha `ESTOQUE CATALOGOS IPAPER PADRÃO.xlsx`
(1.534 produtos: ID iPaper, nome, estoque, CODHB, preço, embalagem) e sobe no
iPaper para atualizar o estoque dos catálogos digitais. O processo leva dias e
o catálogo fica defasado.

## Solução

O iPaper suporta **Enrichment Automation com product feed por URL**: em vez de
receber arquivo, ele lê uma URL (CSV/JSON) e atualiza estoque/preço dos
flipbooks sozinho (com Auto Update, disponível nos planos Commerce Plus /
Enterprise+).

O estoque já chega vivo no Huugs: o conector da Futura (droplet) envia o saldo
a cada **15 minutos** para a tabela `fornecedor_estoque_futura`, com
`codigo_produto` = REFERENCIA do produto (o mesmo código HB/RR da planilha).

A automação então é só **expor esse estoque no formato que o iPaper espera**:

```
Futura (Firebird, on-prem)
   └─ connector-futura (droplet, a cada 15 min)
        └─ Edge receber-estoque-fornecedor
             └─ tabela fornecedor_estoque_futura        ← estoque vivo
                                                            │
tabela ipaper_produtos (seed da planilha)                   │
  ID iPaper ↔ CODHB + nome + preço + package size           │
                                                            ▼
             Edge ipaper-feed (GET, token) ── CSV/JSON ── iPaper
                                                (Enrichment Automation
                                                 lê a URL e atualiza
                                                 os catálogos sozinho)
```

## Componentes (nesta PR)

1. **Migration `20260708120000_…ipaper_produtos`**
   - Tabela `ipaper_produtos` (ipaper_id PK, nome, codhb, preco, package_size, ativo).
   - Seed com as 1.534 linhas válidas da planilha (35 linhas `#N/A` descartadas).
   - RLS: leitura para `authenticated` via `check_user_access()`; escrita só service role.

2. **Edge Function `ipaper-feed`** (pública, token compartilhado)
   - `GET …/functions/v1/ipaper-feed?token=<IPAPER_FEED_TOKEN>` → CSV com as
     colunas exatas da planilha: `ID,NAME,STOCK,DESCRIPTION,CODHB,PRICE,PACKAGE SIZE`.
   - `&format=json` → mesmo conteúdo em JSON (se o suporte do iPaper preferir).
   - STOCK = soma de `estoque_caixas` de `fornecedor_estoque_futura` por código
     (todas as empresas da Futura), casando `upper(trim(codhb))`.
   - Produto sem match no estoque → STOCK 0 (nunca some do feed).
   - Cache 5 min; rate limit 60/min; token em query string ou `Authorization: Bearer`.

## Configuração no iPaper (admin.ipaper.io)

1. Gerar um token forte e salvar como secret `IPAPER_FEED_TOKEN` (prompt Lovable).
2. Testar a URL no navegador:
   `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-feed?token=…`
3. Abrir chamado com o suporte iPaper (support@ipaper.io) ou usar o setup de
   Enrichment Automation no admin: informar a URL do feed, formato CSV,
   coluna-chave (`ID` ou `CODHB` — o suporte confirma qual o EA deles usa hoje,
   já que a planilha atual era importada com essas mesmas colunas).
4. Modo de geração: **On request** (dado muda o dia todo) ou **On schedule**
   (2–4×/dia) — recomendação: On request, o feed responde em <2s com cache.
5. Ativar **Auto Update** nos catálogos para re-enriquecer sem ação manual.

## Decisões assumidas (validar com o time do catálogo)

| # | Decisão | Default adotado | Alternativa |
|---|---------|-----------------|-------------|
| 1 | Unidade do STOCK | caixas (`estoque_caixas`, como o conector converte DZ→CX) | unidades (multiplicar por package_size) |
| 2 | Escopo de empresas | soma das empresas 1, 2 e 3 da Futura | filtrar 1 empresa (ajuste de 1 linha na function) |
| 3 | Preço | congelado no seed da planilha (editável em `ipaper_produtos.preco`) | fase 2: sincronizar tabela de preço da Futura |
| 4 | Produtos novos no catálogo | inserir linha em `ipaper_produtos` (tela admin futura ou SQL) | fase 2: tela de gestão no Huugs |

## Fase 2 (não incluída)

- Tela no Huugs para gerenciar `ipaper_produtos` (adicionar produto novo ao
  catálogo, ajustar preço, inativar).
- Preço automático via tabela de preço da Futura (`descobrir-tabela-preco.js`
  já mapeou a fonte).
- Alerta se o feed for consultado e o sync da Futura estiver velho (>2h).

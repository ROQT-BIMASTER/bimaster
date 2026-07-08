# Integração iPaper × Estoque Huugs (automação do catálogo)

## Problema

Hoje o time monta manualmente a planilha `ESTOQUE CATALOGOS IPAPER PADRÃO.xlsx`
(1.534 produtos: ID iPaper, nome, estoque, CODHB, preço, embalagem) e sobe no
iPaper para atualizar o estoque dos catálogos digitais. O processo leva dias e
o catálogo fica defasado.

## Solução

O iPaper suporta **Enrichment Automation com product feed por URL**: em vez de
receber arquivo, ele lê uma URL (CSV/JSON) e atualiza estoque/preço dos
flipbooks sozinho (com Auto Update, planos Commerce Plus / Enterprise+).

A fonte do estoque é o **Result (Ruby_SP)** — o mesmo saldo disponível que o
força de vendas mostra aos vendedores.

### Investigação no Result (08/07/2026, somente leitura)

- O força de vendas consome a função `dbo.Live_function_EstoqueProdutos()`
  (inline TVF, definição criptografada pelo fornecedor). Retorna 1 linha por
  produto: `id_pro`, `estoque` (disponível), ~5.978 produtos.
- Validação empírica contra `Cust_EstoqueDistribuidora` (base completa):
  o disponível ≈ `Estoque − Bloqueado − reserva_Infpro` da distribuidora dona
  do produto (2.325 exatos com estoque−bloq; resíduos −5/−30 = campo
  `reserva`; pedido pendente NÃO é descontado). Como a função já resolve
  tudo isso, **consumimos a própria função** — zero reengenharia, zero drift.
- De-para catálogo ↔ Result: `CODHB` da planilha = `Produtos.codfor_pro`
  (código de fábrica). **1.494 de 1.496** códigos casam direto (exceções:
  HBF5823, INSUMOI). 1.480 têm linha no Live.
- **Preço do catálogo = `InformacoesProdutos.pcvenda_infpro`** (empresa 6,
  a mesma do força de vendas): **1.495 de 1.496 preços da planilha batem
  exatos** ("qualquer empresa"; por empresa: 1.489 — preço é praticamente
  idêntico nas 11). Os 7 divergentes são INSUMO* (itens internos) e
  caixas/BX com granularidade própria → marcados `preco_fixo = true` no
  seed (feed mantém o preço da planilha para eles).
- Acesso 100% leitura: login `db_datareader`; nada é alterado no Result.

## Atualização 08/07 (tarde) — filtro de filiais + push via Backend API

1. **Filiais limitadas (decisão do Leandro)**: o catálogo recebe estoque só das
   empresas **6 (GLASS), 9 (NEW COSMIC), 10 (MIDDAY), 11 (A GENTE)** — PR (4) e
   PE (8) fora. Como a Live_function não expõe filial, o sync passou a calcular
   o disponível POR EMPRESA (`Estoque_InfPro − Bloqueado − reserva_Infpro`,
   fórmula validada: 96% dos produtos a ≤5 un. do força de vendas) e
   `erp_estoque_live` ganhou a dimensão empresa (PK `erp_id` = empresa-cod).
   Lista configurável via env `IPAPER_EMPRESAS` (default 6,9,10,11) sem deploy.
2. **Plano B sem depender do suporte iPaper**: o admin não permite trocar a
   fonte da Enrichment Automation para URL (config é feita pelo suporte). Mas a
   Backend API tem `Media.UploadFile` que **sobrescreve por nome** — então a
   edge `ipaper-push` gera o XLSX (mesmas colunas da planilha) e sobrescreve
   `ESTOQUE-CATALOGOS-HUUGS-AUTO.xlsx` na Media library; o Auto Update (já
   ativo no flipbook "Catálogo interativo Ruby Rose") re-executa a automação.
   Passo único manual no admin: apontar a automação para esse arquivo.
3. **Crons criados**: `sync-estoque-live-horario` (09–23 UTC, :05) e
   `ipaper-push-horario` (:25), via pg_cron + x-cron-secret.
4. **Guarda de dado velho**: o push aborta (409) se `erp_estoque_live` estiver
   sem sync há mais de 24h — não empurra catálogo congelado.
5. O feed por URL (`ipaper-feed`) continua no ar — vira o Plano A se/quando o
   suporte do iPaper aceitar apontar a automação para URL (perguntar também se
   o fetcher deles suporta `Authorization: Bearer` em vez de token na URL).
   Secrets: `IPAPER_FEED_TOKEN` (feed) e `IPAPER_API_KEY` (Backend API, gerada
   pelo admin em account-settings; opcional `IPAPER_PARENT_ID` para fixar a
   pasta da Media — sem ela a função procura a pasta "Data" via GetTree).

## Arquitetura

```
Result / Ruby_SP (SQL Server, read-only)
   └─ dbo.Live_function_EstoqueProdutos() + dbo.Produtos (codfor_pro)
        └─ erp-sync-engine  rota sync-estoque-live
           (roda também ao final de todo sync-estoque-full /
            botão "Sincronizar ERP" / cron)
             └─ tabela erp_estoque_live (cod_produto, cod_fabricante,
                estoque_disponivel)                      ← saldo do vendedor
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

1. **Migration `…120000` — `ipaper_produtos`**: de-para ID iPaper ↔ CODHB +
   preço/embalagem, seed com as 1.534 linhas válidas da planilha.
2. **Migration `…130000` — `erp_estoque_live`**: saldo disponível do força de
   vendas (cod_produto PK, cod_fabricante indexado, estoque_disponivel).
3. **erp-sync-engine**: nova rota `sync-estoque-live` (query única na função
   Live + join Produtos, upsert + remoção de produtos que saíram do app);
   também roda automaticamente ao final de `sync-estoque-full`.
4. **Edge `ipaper-feed`** (pública, token compartilhado):
   `GET …/functions/v1/ipaper-feed?token=<IPAPER_FEED_TOKEN>` → CSV com as
   colunas exatas da planilha `ID,NAME,STOCK,DESCRIPTION,CODHB,PRICE,PACKAGE SIZE`
   (`&format=json` também disponível). Join: `upper(trim(codhb))` =
   `cod_fabricante`. Sem match → STOCK 0 (produto nunca some do feed).
   RLS nas duas tabelas no molde padrão (leitura authenticated via
   `check_user_access()`, escrita só service role).

## Configuração no iPaper (admin.ipaper.io)

1. Gerar token forte → secret `IPAPER_FEED_TOKEN` (prompt Lovable).
2. Testar a URL do feed no navegador (deve baixar o CSV).
3. Configurar a Enrichment Automation com a URL do feed (ou via
   support@ipaper.io, que monta o EA para o cenário — fluxo padrão deles).
   Chave de match: mesma da planilha atual (colunas idênticas).
4. Geração "On request" + **Auto Update** ativado nos catálogos.
5. Conferir 3–5 produtos contra o app do vendedor após a 1ª atualização.

## Decisões assumidas

| # | Decisão | Racional |
|---|---------|----------|
| 1 | STOCK = disponível do força de vendas | pedido do negócio: catálogo mostra o mesmo saldo que o vendedor vê |
| 2 | Consumir a função Live, não replicar fórmula | definição criptografada; réplica teria drift (reserva, bloqueio, empresa dona) |
| 3 | PRICE = `pcvenda_infpro` (empresa 6) do Result, com `preco_fixo` por item para exceções | 99,5% de bate exato com a planilha; ERP vira fonte de verdade do preço; seed fica como fallback/override |
| 4 | Atualização junto do sync de estoque do ERP | mesma cadência da tela Visão de Estoque; iPaper relê via feed URL |

## Fase 2 (não incluída)

- Tela no Huugs para gerenciar `ipaper_produtos` (produto novo, preço fixo, inativar).
- Alerta se o feed for consultado com sync velho (>2h).
- Cobrir os 2 códigos sem match (HBF5823, INSUMOI) — cadastro no Result ou
  correção do código no catálogo.
- Revisar os 4 itens BX/S14/S22 com `preco_fixo` (granularidade caixa×unidade
  difere entre catálogo e ERP — confirmar preço certo com o time do catálogo).

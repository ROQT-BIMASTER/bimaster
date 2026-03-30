

# Auditoria do Modulo Trade Marketing — O Que Falta Terminar

## Estado Atual

O modulo Trade tem **~50 rotas** registradas no `App.tsx`, **~27 itens** no sidebar, e cobre: PDVs, Visitas, Fotos, Sell Out, Auditorias, Shelf, Marcas, Competidores, Campanhas, Verbas, Financeiro, Performance, Premiações, Materiais, Banners, Incentivos, Insights IA e WhatsApp.

A estrutura geral esta funcional, mas ha falhas criticas de consistencia e areas incompletas.

---

## Problema 1: Screen codes INCONSISTENTES entre sidebar e rotas (CRITICO)

O sidebar (`AppSidebar.tsx`) usa codigos MAIUSCULOS para alguns itens, enquanto as rotas (`App.tsx`) usam codigos minusculos diferentes:

| Sidebar screenCode | Rota screenCode (App.tsx) | Item |
|---|---|---|
| `TRADE_DASHBOARD` | `trade_performance` | Performance |
| `TRADE_DASHBOARD` | `trade_equipe` | Minha Equipe |
| `TRADE_LOJAS` | `trade_stores` | PDVs |
| `TRADE_VISITAS` | `trade_visits` | Visitas |
| `TRADE_FOTOS` | `trade_photos` | Fotos |
| `TRADE_AUDITORIAS` | `trade_auditorias` | Auditorias |

**Impacto**: Um usuario pode VER o item no sidebar (permissao `TRADE_DASHBOARD` concedida) mas ao clicar ser BLOQUEADO pela rota (que exige `trade_performance`). Ou o inverso: ter acesso pela rota mas o item nao aparecer no sidebar.

**Correcao**: Padronizar todos os screen codes para lowercase (o formato usado nas rotas).

## Problema 2: Itens do sidebar com screenCode generico demais

Varios itens usam `TRADE_DASHBOARD` como screenCode generico:
- Minha Equipe
- Promocoes
- Performance
- Equipe Performance
- Ranking

Isso significa que nao ha controle granular — se o usuario tem `TRADE_DASHBOARD`, ve TODOS esses itens. Mas as rotas no `App.tsx` usam screen codes especificos (`trade_performance`, `trade_equipe`, `trade_ranking`), entao o acesso real pode falhar.

**Correcao**: Usar os mesmos screen codes da rota no sidebar.

## Problema 3: Pagina de "Visao Executiva" nao esta no sidebar Trade

A rota `/dashboard/trade/admin/executivo` existe (linha 424) mas NAO aparece no `tradeSubMenus`. So e acessivel via link manual dentro do `TradeAdminModule`.

## Problema 4: Performance/Rewards acessiveis a todos no sidebar mas restritos na rota

- `trade_rewards` usa screenCode correto no sidebar E na rota — OK
- `trade_performance` na rota exige `trade_performance`, mas o sidebar usa `TRADE_DASHBOARD` — Inconsistente

## Problema 5: Paginas sem ModuleBreadcrumb

Algumas paginas trade nao possuem `ModuleBreadcrumb` para navegacao:
- `TradeRewards`
- `TradePromotions`
- `TradeCalendar` (tem breadcrumb)
- `TradeCompetitors` (verificar)

## Problema 6: KPI "Sell Out" na home mostra investimentos, nao sell out

No `TradeModule.tsx` linha 48, o card "Sell Out" exibe `totalInvestments` (da tabela `trade_investments`), nao dados reais de sell out. E enganoso.

## Problema 7: Financeiro Trade vs Financeiro Geral — ambiguidade no sidebar

O sidebar mostra itens de "Verbas" e "Campanhas" tanto no modulo Trade quanto no Financeiro, usando as mesmas rotas (`/dashboard/trade/financeiro/*`). Isso pode confundir usuarios que nao entendem que sao os mesmos dados.

---

## Plano de Correcao

### Fase 1 — Screen codes (critico, afeta acesso)

1. **AppSidebar.tsx**: Padronizar TODOS os screen codes do Trade para lowercase, alinhando com os codigos usados nas rotas:

```
TRADE_DASHBOARD → trade_marketing (home do modulo)
TRADE_LOJAS → trade_stores
TRADE_VISITAS → trade_visits
TRADE_FOTOS → trade_photos
TRADE_AUDITORIAS → trade_auditorias
```

2. Usar screen codes granulares em vez de `TRADE_DASHBOARD` generico:
- Performance → `trade_performance`
- Equipe Performance → `trade_performance`
- Minha Equipe → `trade_equipe`
- Promocoes → `trade_promotions`
- Ranking → `trade_ranking`

3. Adicionar "Visao Executiva" ao sidebar com screenCode `trade_admin`

### Fase 2 — Dados e UX

4. **TradeModule.tsx**: Corrigir KPI "Sell Out" para buscar da tabela `sell_out_entries` em vez de `trade_investments`

5. **TradeRewards / TradePromotions**: Adicionar `ModuleBreadcrumb` para navegacao consistente

### Fase 3 — Telas no banco

6. Verificar se os screen codes padronizados ja existem na tabela `telas_sistema`. Se nao existirem, criar via migration INSERT.

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/components/dashboard/AppSidebar.tsx` | Padronizar screen codes do Trade |
| `src/pages/modules/TradeModule.tsx` | Corrigir KPI Sell Out |
| `src/pages/TradeRewards.tsx` | Adicionar ModuleBreadcrumb |
| `src/pages/TradePromotions.tsx` | Adicionar ModuleBreadcrumb |
| Migration SQL | INSERT telas faltantes em telas_sistema |


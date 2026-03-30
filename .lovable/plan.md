

# Revisao do Modulo Trade Marketing — Problemas Remanescentes e Melhorias

## Estado Atual

As correcoes anteriores resolveram: screen codes padronizados no sidebar, breadcrumbs adicionados, KPI Sell Out corrigido na home, e "Visao Executiva" no sidebar. O modulo esta em bom estado, mas restam problemas pontuais.

---

## Problemas Encontrados

### 1. TradeDashboardWidget ainda mostra "Investimentos" em vez de Sell Out

O widget `TradeDashboardWidget.tsx` (usado na home geral do dashboard) busca de `trade_investments` e exibe como "Investimentos". Porem o `TradeModule.tsx` ja foi corrigido para mostrar Sell Out real. Inconsistencia: o widget da home geral mostra dado diferente do modulo Trade.

**Correcao**: Alinhar o widget para tambem buscar de `sell_out_entries`, ou renomear o label para deixar claro que sao investimentos (se for intencional).

### 2. `(supabase as any)` no TradeModule — type safety quebrada

Linha 45: `(supabase as any).from("sell_out_entries")` indica que a tabela `sell_out_entries` nao existe no tipo gerado. Isso silencia erros de compilacao e pode falhar em runtime sem aviso.

**Correcao**: Verificar se a tabela existe no banco e se o tipo foi regenerado. Se a tabela existir, o cast `as any` pode ser removido apos regenerar os tipos.

### 3. Rotas com screenCode no App.tsx que NAO existem no sidebar (5 telas orfas)

Estas rotas existem no `App.tsx` mas nao tem entrada correspondente no sidebar — so acessiveis via link direto:

| Rota | screenCode | Descricao |
|------|-----------|-----------|
| `/dashboard/trade/minhas-solicitacoes` | `trade_solicitacoes` | Minhas Solicitacoes |
| `/dashboard/trade/materiais` | `trade_materiais` | Catalogo Materiais (user) |
| `/dashboard/trade/import-stores` | `trade_import` | Importar Lojas |
| `/dashboard/trade/calendar` | `trade_calendar` | Calendario (usa `trade_visits` no sidebar) |
| `/dashboard/trade/brand-share` | `trade_brands` | Brand Share Dashboard |

O Calendario aparece no sidebar com screenCode `trade_visits`, mas a rota usa `trade_calendar` — se o usuario tem `trade_visits` mas nao `trade_calendar`, ve o item mas e bloqueado.

**Correcao**: Alinhar screenCodes entre sidebar e rotas; adicionar itens faltantes ao sidebar (Minhas Solicitacoes, Materiais user, Importar Lojas).

### 4. Rotas admin do Trade usam `ScreenRoute` sem `ModuleRoute`

As rotas `/dashboard/trade/admin/*` e `/dashboard/trade/financeiro/*` usam apenas `ScreenRoute screenCode="trade_admin"` sem o wrapper `ModuleRoute moduleCode="trade"`. Isso significa que o guard de modulo NAO e verificado — um usuario com permissao `trade_admin` na tela mas SEM acesso ao modulo Trade consegue acessar essas paginas.

**Correcao**: Envolver todas as rotas admin/financeiro em `ModuleRoute moduleCode="trade"`.

### 5. Sidebar com 28 itens — lista muito longa, sem agrupamento visual

O array `tradeSubMenus` tem 28 itens renderizados em lista plana. Em telas menores, o usuario precisa rolar muito. Nao ha separadores ou sub-grupos (Admin, Operacional, Financeiro, Performance).

**Melhoria**: Adicionar separadores visuais (dividers com label) entre blocos logicos no submenu.

### 6. KPIs do TradeModule nao filtram por usuario/hierarquia

Os KPIs de visitas e fotos na home do Trade buscam TODOS os registros sem filtro por usuario ou hierarquia. Um promotor ve o total global, nao seus proprios dados. O `TradeDashboardWidget` ja implementa esse filtro via `shouldFilter` e `effectiveUserId`.

**Correcao**: Aplicar o mesmo padrao de filtro por hierarquia aos KPIs do `TradeModule.tsx`.

---

## Plano de Correcao

### Fase 1 — Consistencia de acesso (critico)

1. **App.tsx**: Envolver rotas `trade/admin/*` e `trade/financeiro/*` em `ModuleRoute moduleCode="trade"`
2. **AppSidebar.tsx**: Alinhar screenCode do Calendario para `trade_calendar`; adicionar "Minhas Solicitacoes" e "Catalogo Materiais" ao sidebar
3. **AppSidebar.tsx**: Adicionar "Importar Lojas" com `requireAdminOrSupervisor: true`

### Fase 2 — Dados corretos

4. **TradeDashboardWidget.tsx**: Substituir `trade_investments` por `sell_out_entries` ou renomear label para "Investimentos" (manter consistencia com TradeModule)
5. **TradeModule.tsx**: Remover cast `(supabase as any)` — usar tipagem correta
6. **TradeModule.tsx**: Filtrar KPIs por usuario/hierarquia usando `useFilteredStores` e `useImpersonation`

### Fase 3 — UX

7. **AppSidebar.tsx**: Adicionar separadores visuais no submenu Trade (blocos: Operacional, Performance, Admin, Financeiro)

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/App.tsx` | Adicionar `ModuleRoute` nas rotas admin/financeiro do Trade |
| `src/components/dashboard/AppSidebar.tsx` | Adicionar itens faltantes; alinhar screenCodes; separadores visuais |
| `src/components/dashboard/TradeDashboardWidget.tsx` | Alinhar KPI com sell_out ou renomear |
| `src/pages/modules/TradeModule.tsx` | Remover `as any`; filtrar KPIs por hierarquia |




# Plano: Mover opções da tela principal Trade para o menu lateral

## O que será feito

Remover a seção "Mais funcionalidades" (collapsibles com links) da tela principal do `TradeModule.tsx` e adicionar os itens faltantes no sidebar, mantendo as permissões existentes.

## Itens que faltam no sidebar

Estas rotas existem no `App.tsx` e aparecem na tela principal, mas **não estão no sidebar**:

| Item | Rota | Screen/Permission |
|---|---|---|
| Redes | `/dashboard/trade/store-chains` | `trade` (module) |
| Calendário | `/dashboard/trade/calendar` | `trade` (module) |
| Comparação Produtos | `/dashboard/trade/comparacao-produtos` | `trade` (module) |
| Promoções | `/dashboard/trade/promotions` | `trade` (module) |
| Performance | `/dashboard/trade/performance` | `trade` (module), admin only |
| Equipe Performance | `/dashboard/trade/team-performance` | `trade` (module), admin only |
| Ranking | `/dashboard/ranking` | `trade` (module), admin only |
| Central de Aprovações | `/dashboard/trade/aprovacoes` | `trade_admin` (screen) |

## Alterações

### 1. `src/components/dashboard/AppSidebar.tsx`
Adicionar ao `tradeSubMenus` os 8 itens acima, com os mesmos controles de permissão (`screenCode` e `requireAdminOrSupervisor`) que já existem na tela principal.

### 2. `src/pages/modules/TradeModule.tsx`
Remover toda a seção `secondaryModules` (linhas 90-326) — os collapsibles "Administrativo", "Cadastros e Configurações", "Execução e Auditoria", "Inteligência Competitiva", "Performance e Vendas" e "Gamificação". A tela ficará limpa com: header, busca, banners, KPIs, incentivos e tour.

## Segurança preservada

- Sidebar já usa `hasPermission(item.screenCode)` e `isAdminOrSupervisor` para filtrar itens
- Rotas no `App.tsx` continuam protegidas por `ModuleRoute`/`ScreenRoute`
- Nenhuma permissão é alterada, apenas o local de navegação muda


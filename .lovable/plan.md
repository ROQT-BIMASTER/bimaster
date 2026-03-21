

# Plano: Adicionar Banners e Incentivos ao Menu Lateral do Trade

## Problema
As novas telas `/dashboard/trade/admin/banners` e `/dashboard/trade/admin/incentivos` existem mas não estão no sidebar, impossibilitando a navegação.

## Solução
Adicionar dois itens ao array `tradeSubMenus` no `AppSidebar.tsx`, logo após o item "Admin" existente:

```
{ title: "Banners", url: "/dashboard/trade/admin/banners", icon: Image, screenCode: "trade_admin" },
{ title: "Incentivos", url: "/dashboard/trade/admin/incentivos", icon: Trophy, screenCode: "trade_admin" },
```

Ambos usam `screenCode: "trade_admin"` (mesmo guard do painel admin), garantindo que apenas admins vejam esses itens.

## Arquivo alterado
- `src/components/dashboard/AppSidebar.tsx` — 2 linhas adicionadas ao array `tradeSubMenus`


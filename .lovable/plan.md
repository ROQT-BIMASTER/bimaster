
# Plano: Adicionar Botão de Voltar nas Telas de Trade Marketing

## Objetivo
Adicionar o botão "Voltar" em todas as telas do módulo Trade Marketing para melhorar a navegação, especialmente para usuários do Financeiro que acessam essas telas.

---

## Situação Atual

### Telas que JÁ possuem navegação de retorno:
- **TradeVisits** - Usa `ModuleBreadcrumb` 
- **TradeAprovacoes** - Botão de voltar para `/dashboard/trade/financeiro`
- **TradeLancamentos** - Botão de voltar para `/dashboard/trade/financeiro`
- **TradeAdminApprovalLevels** - Botão de voltar para `/dashboard/trade/admin`
- **TradeAdminUsers** - Botão de voltar para `/dashboard/trade/admin`
- **TradeCampaignDetail** - Botão de voltar com `navigate(-1)`
- **TradePhotos, TradeStores, TradeSellOut** - Usam `TradePageHeader` com voltar

### Telas que PRECISAM do botão de voltar (15 páginas):

| Página | Destino do Voltar |
|--------|-------------------|
| TradeCampaigns | `/dashboard/trade/financeiro` |
| TradeCompetitors | `/dashboard/trade` |
| TradeFinanceiro | `/dashboard/trade` |
| TradeVerbasSemestrais | `/dashboard/trade/financeiro` |
| TradeContasCorrentes | `/dashboard/trade/financeiro` |
| TradeStoreChains | `/dashboard/trade` |
| TradeCalendar | `/dashboard/trade` |
| TradeIdealPhotos | `/dashboard/trade` |
| TradeInsights | `/dashboard/trade` |
| TradePerformance | `/dashboard/trade` |
| TradeShelfMeasurements | `/dashboard/trade` |
| TradeLancamentosCampanhas | `/dashboard/trade/financeiro` |
| TradeReportCampaigns | `/dashboard/trade/admin` |
| TradeReportClients | `/dashboard/trade/admin` |
| TradeReportSellers | `/dashboard/trade/admin` |

---

## Padrão de Implementação

Usarei o componente `ModuleBreadcrumb` já existente, que fornece:
- Botão "Voltar" com ícone de seta
- Breadcrumb mostrando a hierarquia de navegação (Módulo > Página Atual)

Exemplo de uso:
```tsx
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";

<ModuleBreadcrumb 
  moduleName="Trade Marketing" 
  moduleHref="/dashboard/trade" 
  currentPage="Nome da Página" 
/>
```

---

## Benefícios

- Navegação consistente em todo o módulo Trade
- Facilidade para usuários do Financeiro voltarem às suas telas
- Breadcrumb visual mostrando o contexto de navegação
- Padrão unificado usando componente existente

---

## Detalhes Técnicos

### Arquivos a Modificar (15 arquivos):

1. `src/pages/TradeCampaigns.tsx`
2. `src/pages/TradeCompetitors.tsx`
3. `src/pages/TradeFinanceiro.tsx`
4. `src/pages/TradeVerbasSemestrais.tsx`
5. `src/pages/TradeContasCorrentes.tsx`
6. `src/pages/TradeStoreChains.tsx`
7. `src/pages/TradeCalendar.tsx`
8. `src/pages/TradeIdealPhotos.tsx`
9. `src/pages/TradeInsights.tsx`
10. `src/pages/TradePerformance.tsx`
11. `src/pages/TradeShelfMeasurements.tsx`
12. `src/pages/TradeLancamentosCampanhas.tsx`
13. `src/pages/trade/reports/TradeReportCampaigns.tsx`
14. `src/pages/trade/reports/TradeReportClients.tsx`
15. `src/pages/trade/reports/TradeReportSellers.tsx`

### Exemplo de Modificação

Antes:
```tsx
<DashboardLayout>
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Título</h1>
        <p className="text-muted-foreground">Descrição</p>
      </div>
```

Depois:
```tsx
<DashboardLayout>
  <div className="space-y-6">
    <ModuleBreadcrumb 
      moduleName="Trade Marketing" 
      moduleHref="/dashboard/trade" 
      currentPage="Nome da Página" 
    />
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Título</h1>
        <p className="text-muted-foreground">Descrição</p>
      </div>
```

### Mapeamento de Páginas e Contextos

Para páginas dentro de sub-módulos, o breadcrumb refletirá a hierarquia:
- Páginas sob `/trade/financeiro/*` → moduleHref: `/dashboard/trade/financeiro`
- Páginas sob `/trade/admin/*` → moduleHref: `/dashboard/trade/admin`
- Páginas diretas do Trade → moduleHref: `/dashboard/trade`

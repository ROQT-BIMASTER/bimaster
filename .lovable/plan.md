
# Plano: Dashboard Executivo Trade Marketing

## Objetivo
Criar um painel consolidado em uma única tela de rolagem para a diretoria visualizar todas as operações de Trade Marketing: campanhas, lançamentos, visitas, fotos e KPIs operacionais.

---

## Layout Proposto

```text
+--------------------------------------------------+
|  HEADER: Trade Marketing - Visão Executiva       |
|  [Atualizar] [Filtro Período]                    |
+--------------------------------------------------+
|                                                  |
|  SEÇÃO 1: KPIs PRINCIPAIS (4 cards)              |
|  [PDVs Ativos] [Visitas Mês] [Fotos Mês] [ROI]   |
|                                                  |
+--------------------------------------------------+
|                                                  |
|  SEÇÃO 2: CAMPANHAS (2 cards lado a lado)        |
|  [Resumo Campanhas]  [Campanhas por Status]      |
|                                                  |
+--------------------------------------------------+
|                                                  |
|  SEÇÃO 3: GRÁFICOS (2 gráficos)                  |
|  [Evolução Visitas/Fotos 6 meses]                |
|  [Lançamentos por Cliente - Top 10]              |
|                                                  |
+--------------------------------------------------+
|                                                  |
|  SEÇÃO 4: TABELA LANÇAMENTOS                     |
|  Lista detalhada com filtros e exportação        |
|                                                  |
+--------------------------------------------------+
|                                                  |
|  SEÇÃO 5: VISITAS RECENTES                       |
|  Últimas 10 visitas com status e duração         |
|                                                  |
+--------------------------------------------------+
|                                                  |
|  SEÇÃO 6: GALERIA DE FOTOS                       |
|  Miniaturas das últimas fotos processadas        |
|                                                  |
+--------------------------------------------------+
```

---

## Componentes a Criar

### 1. Página Principal
**Arquivo**: `src/pages/TradeExecutiveDashboard.tsx`
- Página de rolagem única
- Integração com hook de dados
- Botão atualizar e filtro de período
- Tour guiado integrado

### 2. Hook de Dados
**Arquivo**: `src/hooks/useTradeExecutiveDashboard.ts`
- Query para KPIs gerais (stores, visits, photos)
- Query para campanhas e lançamentos
- Query para evolução mensal (últimos 6 meses)
- Query para fotos recentes
- Query para visitas recentes

### 3. Componentes de Visualização

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| TradeExecutiveKPIs | `components/trade/executive/TradeExecutiveKPIs.tsx` | 4 cards com métricas principais |
| TradeExecutiveCampaigns | `components/trade/executive/TradeExecutiveCampaigns.tsx` | Cards de campanhas ativas/concluídas |
| TradeExecutiveEvolutionChart | `components/trade/executive/TradeExecutiveEvolutionChart.tsx` | Gráfico de linhas: visitas e fotos por mês |
| TradeExecutiveTopClients | `components/trade/executive/TradeExecutiveTopClients.tsx` | Gráfico de barras: top 10 clientes por lançamentos |
| TradeExecutiveVisitsTable | `components/trade/executive/TradeExecutiveVisitsTable.tsx` | Tabela com últimas visitas |
| TradeExecutivePhotosGallery | `components/trade/executive/TradeExecutivePhotosGallery.tsx` | Grid de miniaturas com análise IA |

---

## Métricas e Dados

### KPIs Principais
- **PDVs Ativos**: Total de stores com status = 'active'
- **Visitas do Mês**: Count de visits do mês atual
- **Fotos do Mês**: Count de photos do mês atual
- **ROI Médio**: Média de roi_percentual dos lançamentos

### Campanhas
- Total de campanhas ativas
- Total de campanhas concluídas
- Valor total investido
- Distribuição por status (gráfico pizza)

### Evolução Mensal
- Últimos 6 meses
- Linha: quantidade de visitas
- Linha: quantidade de fotos
- Área: taxa de processamento IA

### Top Clientes
- Top 10 clientes por valor de lançamentos
- Barras horizontais com valor e quantidade

### Visitas Recentes
- Últimas 10 visitas
- Colunas: PDV, Vendedor, Data, Duração, Status, Score

### Galeria de Fotos
- Últimas 12 fotos processadas
- Thumbnail clicável
- Badge de status IA

---

## Detalhes Técnicos

### Estrutura de Arquivos

```
src/
├── pages/
│   └── TradeExecutiveDashboard.tsx
├── hooks/
│   └── useTradeExecutiveDashboard.ts
└── components/
    └── trade/
        └── executive/
            ├── TradeExecutiveKPIs.tsx
            ├── TradeExecutiveCampaigns.tsx
            ├── TradeExecutiveEvolutionChart.tsx
            ├── TradeExecutiveTopClients.tsx
            ├── TradeExecutiveVisitsTable.tsx
            └── TradeExecutivePhotosGallery.tsx
```

### Queries do Hook

```typescript
// Hook principal com react-query
const kpisQuery = useQuery({
  queryKey: ['trade-executive-kpis'],
  queryFn: async () => {
    // Queries paralelas para stores, visits, photos, campanhas
  }
});

const evolutionQuery = useQuery({
  queryKey: ['trade-executive-evolution'],
  queryFn: async () => {
    // Dados mensais dos últimos 6 meses
  }
});

const visitsQuery = useQuery({
  queryKey: ['trade-executive-visits'],
  queryFn: async () => {
    // Últimas 10 visitas com joins
  }
});

const photosQuery = useQuery({
  queryKey: ['trade-executive-photos'],
  queryFn: async () => {
    // Últimas 12 fotos processadas
  }
});
```

### Rota de Acesso

A página será acessível via:
- `/dashboard/trade/admin/executivo`
- Link no menu do módulo Trade Admin

### Tecnologias Utilizadas
- **Gráficos**: Recharts (já instalado)
- **UI**: Shadcn/ui (já instalado)
- **Data**: TanStack Query (já instalado)
- **Exportação**: xlsx (já instalado)

---

## Permissões

O acesso será restrito a usuários com permissão `trade_admin`, seguindo o padrão existente do módulo administrativo.

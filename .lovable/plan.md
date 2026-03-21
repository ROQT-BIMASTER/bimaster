

# ETAPA 7 - Central de Inteligência Avançada

## Scope Assessment

This request contains ~40+ distinct enhancements across 8 dashboards. To be deliverable without breaking anything, the work will be split into **3 phases**, implemented sequentially. This plan covers **all phases**.

---

## Phase 1: Global Infrastructure (affects all 8 dashboards)

### 1.1 Add "Tabela de Preços" filter to DashboardFiltersBar
- **File**: `src/components/painel-executivo/DashboardFilters.tsx`
- Add a new `Select` dropdown for price table, populated from `config_tabelas_usuario`
- Add `tabela?: string | null` to `DashboardFilters` interface in `src/hooks/useDashboardKPIs.ts`
- When selected, pass it through filters; hooks that query `vendas_union` will add `.eq("tabela", filters.tabela)` to filter rows by that price table
- Note: The request says "use price from selected table instead of venda/preco_venda" but the data model has a single `tabela` column per row (it's the price table the sale was made under). So filtering by table is the correct interpretation -- it filters to show only sales made under that price table.

### 1.2 KPI Cards: Meta comparison + Period variation
- Create a reusable `EnhancedKPICard` component that:
  - Shows the current value
  - Shows meta value + % achievement with color coding (green >= 100%, yellow >= 80%, red < 80%)
  - Shows variation vs previous period with up/down arrow (green/red)
- Integrate `useMetasVendas` data into KPI cards across dashboards
- The `useDashboardKPIs` hook already calculates trends (e.g., `receita_trend`, `pedidos_trend`) -- these will be surfaced in the new card

### 1.3 Standardized detailed table component
- Create `src/components/ui/DataDetailTable.tsx` -- a reusable paginated table (20 rows/page) with:
  - Column sorting (click header)
  - Text search
  - CSV export
  - Totals row
- Replace ad-hoc tables across dashboards with this component

---

## Phase 2: Dashboard-specific enhancements (Part 1 -- 4 dashboards)

### 2.1 Painel Executivo (`/dashboard/painel-executivo`)
- Add "Melhor Mês" KPI card showing the month with highest revenue (derived from `useReceitaMensal` data)
- Add "Top 10 Clientes por Receita" as a new tab in ChartTabs (fetch from `vendas_union`, aggregate by `cod_cliente`)
- Replace bottom data tables with `DataDetailTable` showing: Ranking, Empresa, Receita Total, Qtde Pedidos, Ticket Médio, Clientes Ativos, Positivação %, Mix Médio
- Integrate `EnhancedKPICard` with meta/trend data

### 2.2 Performance Vendas (`/dashboard/performance-vendas`)
- Add columns to supervisor cards: Ticket Médio, % Participação, Meta, % Atingimento Meta
- Add progress bar for % Atingimento Meta
- When expanding a supervisor, show vendedores with same columns + Ticket Médio
- When clicking a vendedor, drilldown modal shows clients: Cod.Cliente, Nome, UF, Cidade, Receita, Pedidos, Dias sem Compra
- Add per-supervisor sparkline (already partially implemented, needs refinement to be per-supervisor instead of global)

### 2.3 Análise Clientes (`/dashboard/clientes`)
- Enhance detail table with: Cod.Cliente, CNPJ, Razão Social, UF, Cidade, Vendedor, Supervisor, Receita Total, Qtde Pedidos, Ticket Médio, Dias sem Compra, Última Compra
- Add segmentation: Novos (first purchase in period), Recorrentes, Inativos (>60 days)
- Add "Clientes em Risco" card (30-60 days without purchase) with clickable list
- Add scatter chart tab: Frequência x Ticket Médio (using Recharts ScatterChart)

### 2.4 Detalhamento (`/dashboard/detalhamento`)
- Add Valor Unitário column (preco_venda)
- The table already has most requested columns; add CNPJ column
- Add Operação dropdown filter in the filter bar
- Add grouping by Operação with subtotals (toggle option)
- Totals row already exists, verify it's complete

---

## Phase 3: Dashboard-specific enhancements (Part 2 -- 4 dashboards)

### 3.1 Geográfico (`/dashboard/geografico`)
- Existing UF table already has: UF, Receita, % Participação, Qtde Clientes, Ticket Médio
- Add drill-down: clicking UF filters cities table; clicking city shows clients modal
- Add heatmap intensity tab using color-coded bar chart by region

### 3.2 Produtos (`/dashboard/produtos`)
- Add Código column to product table
- Treemap chart tab for brand/category participation (Recharts Treemap)
- "Produtos sem venda no período" tab/section
- ABC classification already exists, add visual indicator (colored dots/bars)

### 3.3 Metas (`/dashboard/metas`)
- Add gauge/speedometer visualization (SVG-based semicircular gauge)
- Enhance table: already has Supervisor, Vendedor, Meta, Realizado, %, Gap, Projeção
- Add daily cumulative evolution chart (line chart: realized cumulative vs linear meta target)
- Projection based on business days remaining

### 3.4 Consolidado (`/dashboard/consolidado`)
- Cross-company comparison table already exists with most columns
- Add Meta and % Atingimento columns (from `metas_vendas`)
- Add Positivação column
- Add grouped bar chart tab (barras agrupadas por empresa)
- Monthly comparative with overlapping lines already exists

---

## Technical Details

### Files to create:
- `src/components/ui/DataDetailTable.tsx` -- Reusable paginated/sortable/searchable table
- `src/components/ui/EnhancedKPICard.tsx` -- KPI card with meta + trend
- `src/components/ui/GaugeChart.tsx` -- SVG gauge for metas

### Files to modify:
- `src/hooks/useDashboardKPIs.ts` -- Add `tabela` to DashboardFilters interface
- `src/components/painel-executivo/DashboardFilters.tsx` -- Add tabela filter dropdown
- All 8 dashboard pages (PainelExecutivo, PerformanceVendas, AnaliseClientes, DetalhamentoVendas, AnaliseGeografico, AnaliseProdutos, MetasProjecoes, Consolidado)
- Relevant hooks where `tabela` filter needs to be applied

### Key constraints maintained:
- Revenue formula: `COALESCE(venda, preco_venda * quantidade, 0)` -- no changes
- All existing filters preserved
- ChartContainer and ChartTabs patterns maintained
- Visual design unchanged
- Data from `vendas_union` table via compatibility view

### Implementation order:
1. Global infrastructure (filters, reusable components)
2. Painel Executivo + Performance Vendas + Clientes + Detalhamento
3. Geográfico + Produtos + Metas + Consolidado

Due to the size of this change, implementation will proceed in multiple messages, starting with Phase 1 (global infrastructure) and the first 2 dashboards.


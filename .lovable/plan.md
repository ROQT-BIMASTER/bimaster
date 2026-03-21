

## Plano: Painel Executivo — Dashboard de Vendas (Etapa 1)

### Descoberta Importante

Os nomes de colunas na tabela `vendas_union` diferem do que foi descrito:
- Não existe `receita_total` → existe `preco_venda` (preço unitário) e `quantidade`
- Não existe `qtde` → existe `quantidade`
- Receita será calculada como: `preco_venda * quantidade` (ou `preco_venda * quantidade - vl_desconto` se preferir receita líquida)
- Há campo `operacao` que pode conter 'VENDA', 'SAIDA MONTAGEM DE KIT', etc. — as views filtrarão por `operacao = 'VENDA'` para KPIs consistentes (ou incluir todas, a definir)

Também já existe um `EmpresaContext` no sistema que gerencia filtro por empresa do usuário — será integrado.

### Parte 1: Migrations SQL (4 views materializadas)

**`vw_dashboard_kpis`** — KPIs agregados por mês/empresa/supervisor/vendedor/UF:
```sql
SELECT 
  EXTRACT(YEAR FROM data) AS ano,
  EXTRACT(MONTH FROM data) AS mes,
  id_empresa, supervisor, cod_vend, uf,
  SUM(preco_venda * quantidade) AS receita_total,
  COUNT(DISTINCT pedido) AS qtde_pedidos,
  SUM(preco_venda * quantidade) / NULLIF(COUNT(DISTINCT pedido), 0) AS ticket_medio,
  COUNT(DISTINCT cod_cliente) AS clientes_ativos,
  SUM(quantidade) AS qtde_itens
FROM vendas_union
WHERE operacao = 'VENDA'
GROUP BY ano, mes, id_empresa, supervisor, cod_vend, uf
```

**`vw_receita_empresa`** — Receita por empresa/mês

**`vw_ranking_supervisores`** — Receita + pedidos por supervisor/mês

**`vw_ranking_vendedores`** — Receita + pedidos + clientes por vendedor/mês

Todas as views são `CREATE VIEW` (não materializadas) para herdar automaticamente o RLS da tabela `vendas_union`.

### Parte 2: Página do Dashboard

**Rota**: `/dashboard/painel-executivo` (nova página, não substitui a home atual que é um redirect dinâmico)

**Estrutura de arquivos**:
```
src/pages/PainelExecutivo.tsx              — Página principal
src/hooks/useDashboardKPIs.ts             — Hook para KPI cards
src/hooks/useReceitaEmpresa.ts            — Hook para gráfico por empresa
src/hooks/useRankingSupervisores.ts        — Hook para ranking supervisores
src/hooks/useRankingVendedores.ts          — Hook para ranking vendedores
src/components/painel-executivo/
  DashboardFilters.tsx                     — Barra de filtros (Ano, Mês, Empresa, Supervisor, Vendedor, UF, Marca)
  KPICards.tsx                             — 6 cards com badges de tendência
  ReceitaMensalChart.tsx                   — LineChart com área gradiente
  ReceitaEmpresaChart.tsx                  — BarChart horizontal
  RankingSupervisoresChart.tsx             — BarChart horizontal top 10
  RankingVendedoresChart.tsx               — BarChart horizontal top 10
```

**Filtros**: Período (Ano + Mês multi-select), Empresa (do EmpresaContext), Supervisor, Vendedor, UF, Marca — todos atualizando queries via React Query.

**KPI Cards** (6): Receita Total, Qtde Pedidos, Ticket Médio, Clientes Ativos, Mix Médio (itens/pedido), Positivação % — cada um com badge % vs mês anterior (verde/vermelho).

**Gráficos** (Recharts): Evolução mensal (AreaChart 12 meses), Receita por empresa (horizontal bar), Top 10 supervisores, Top 10 vendedores — em grid 2x2.

**Hooks**: Cada hook consulta a view correspondente filtrando pelo período/filtros selecionados, usando `fetchAllRows` para garantir todos os dados.

### Parte 3: Sidebar e Rota

- Nova rota `/dashboard/painel-executivo` em `App.tsx`
- Novo item "Painel Executivo" no sidebar (ícone BarChart3) — visível para todos os usuários autenticados
- Lazy load com `lazyWithRetry`

### Decisão necessária

O cálculo de receita deve usar `preco_venda * quantidade` (receita bruta) ou `preco_venda * quantidade - vl_desconto` (receita líquida)? E deve filtrar apenas `operacao = 'VENDA'` ou incluir todas as operações?


# Módulo: Central de Inteligência

> **Última atualização:** 2026-03-21 | **Versão:** 2.0.0

---

## 1. Visão Geral

A Central de Inteligência é a suíte de dashboards analíticos de vendas do BiMaster. Composta por **8 dashboards** especializados, consome dados da tabela fato `vendas_union` (nome físico `"Union"`) e de dimensões auxiliares.

### Fórmula de Receita (CRÍTICA — usada em TODOS os dashboards)

```sql
COALESCE(venda, preco_venda * quantidade, 0)
```

> **NUNCA** usar `vl_outros_custos` como receita.

### Guard de Rota

Todos os dashboards usam `ProtectedRoute` (sem guard de módulo/tela específico).

---

## 2. Modelo Dimensional

```
                  ┌─────────────────┐
                  │   dim_empresa    │
                  │ ─────────────── │
                  │ id (PK)         │
                  │ codigo_empresa  │
                  │ nome_empresa    │
                  │ empresa_id (FK) │
                  └────────┬────────┘
                           │
┌──────────────┐    ┌──────┴──────────────────────────┐    ┌─────────────────┐
│ dim_supervisor│    │      vendas_union (FATO)         │    │  dim_vendedor   │
│ ────────────  │    │ ────────────────────────────────│    │ ─────────────── │
│ id (PK)      │◄───│ supervisor                       │    │ id (PK)         │
│ supervisor   │    │ vendedor                  ───────│───►│ vendedor        │
│ nome_usuario │    │ empresa                          │    │ nome_usuario    │
│ user_id (FK) │    │ tabela                           │    │ user_id (FK)    │
└──────────────┘    │ operacao                         │    │ supervisor      │
                    │ marca, produto, grupo             │    └─────────────────┘
                    │ cliente, cnpj, uf, cidade          │
                    │ data_pedido, nota, pedido           │
                    │ quantidade, preco_venda, venda      │
                    │ desconto, preco_tabela              │
                    └─────────────────────────────────────┘
```

### Tabela Fato: `vendas_union` (nome físico: `public."Union"`)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `empresa` | text | Código da empresa |
| `tabela` | text | Tabela de preços |
| `operacao` | text | Tipo de operação (Venda, Bonificação, etc.) |
| `supervisor` | text | Nome/código do supervisor |
| `vendedor` | text | Nome/código do vendedor |
| `cliente` | text | Nome do cliente |
| `cnpj` | text | CNPJ do cliente |
| `uf` | text | UF do cliente |
| `cidade` | text | Cidade do cliente |
| `marca` | text | Marca do produto |
| `produto` | text | Nome do produto |
| `grupo` | text | Grupo/categoria |
| `codigo_produto` | text | Código do produto |
| `data_pedido` | date | Data do pedido |
| `nota` | text | Número da nota fiscal |
| `pedido` | text | Número do pedido |
| `quantidade` | numeric | Quantidade vendida |
| `preco_venda` | numeric | Preço unitário de venda |
| `preco_tabela` | numeric | Preço de tabela |
| `venda` | numeric | Valor total da venda (pode ser null) |
| `desconto` | numeric | Percentual de desconto |
| `cod_cliente` | text | Código do cliente |
| `created_at` | timestamptz | Data de ingestão |

### Dimensões

| Tabela | Colunas-Chave | Vinculação |
|--------|--------------|------------|
| `dim_vendedor` | `vendedor`, `nome_usuario`, `user_id`, `supervisor` | user_id → auth.users |
| `dim_supervisor` | `supervisor`, `nome_usuario`, `user_id` | user_id → auth.users |
| `dim_empresa` | `codigo_empresa`, `nome_empresa`, `empresa_id` | empresa_id → empresas.id |

### View de Compatibilidade

```sql
CREATE VIEW public.vendas_union AS SELECT * FROM public."Union";
```

---

## 3. Views Analíticas

| View | Descrição | Colunas Principais |
|------|-----------|-------------------|
| `vw_dashboard_kpis` | KPIs agregados por período | total_receita, total_pedidos, total_clientes, ticket_medio |
| `vw_receita_empresa` | Receita por empresa | empresa, receita, pedidos, clientes |
| `vw_ranking_supervisores` | Ranking de supervisores | supervisor, receita, pedidos, clientes, positivacao |
| `vw_ranking_vendedores` | Ranking de vendedores | vendedor, supervisor, receita, pedidos, clientes |

---

## 4. Dashboards Detalhados

### 4.1 Painel Executivo

| Aspecto | Detalhe |
|---------|--------|
| **Rota** | `/dashboard/painel-executivo` |
| **Página** | `PainelExecutivo.tsx` |
| **Hook** | `useDashboardKPIs`, `useReceitaEmpresa` |
| **Filtros** | Empresa, Supervisor, Vendedor, Período, Tabela de Preços |
| **KPI Cards** | Receita Total, Pedidos, Clientes Ativos, Ticket Médio, Positivação, Mix |
| **Gráficos** | Evolução mensal (área), Top 10 Clientes (barras), Receita por empresa (pizza) |
| **Tabela** | Ranking: Empresa, Receita, Pedidos, Ticket Médio, Clientes, Positivação |
| **Variação** | % vs mês anterior com seta verde/vermelha |
| **Meta** | Valor da meta + % atingimento (verde ≥100%, amarelo ≥80%, vermelho <80%) |

### 4.2 Performance de Vendas

| Aspecto | Detalhe |
|---------|--------|
| **Rota** | `/dashboard/performance-vendas` |
| **Página** | `PerformanceVendas.tsx` |
| **Hook** | `useRankingSupervisores`, `useRankingVendedores` |
| **Filtros** | Empresa, Período, Tabela de Preços |
| **Gráficos** | Barras horizontais por supervisor, Evolução temporal |
| **Tabela** | Supervisor → (expand) Vendedores → (expand) Clientes |
| **Colunas** | Receita, Pedidos, Ticket Médio, % Participação, Meta, % Atingimento (barra progresso) |
| **Drill-down Cliente** | Cod, Nome, CNPJ, UF, Cidade, Receita, Pedidos, Dias sem Compra |

### 4.3 Análise de Clientes

| Aspecto | Detalhe |
|---------|--------|
| **Rota** | `/dashboard/clientes` |
| **Página** | `AnaliseClientes.tsx` |
| **Hook** | `useAnaliseClientes` |
| **Filtros** | Empresa, Supervisor, Vendedor, Período, Tabela, Segmentação |
| **Segmentação** | Novos, Recorrentes, Inativos (>60 dias) |
| **Cards** | Clientes em Risco (30-60 dias sem compra), Pareto 80/20 |
| **Gráficos** | Dispersão (Frequência × Ticket Médio), Pareto de faturamento |
| **Tabela** | Cod, CNPJ, Razão Social, UF, Cidade, Telefone, Vendedor, Supervisor, Receita, Pedidos, Ticket Médio, Dias sem Compra, Última Compra |

### 4.4 Detalhamento de Vendas

| Aspecto | Detalhe |
|---------|--------|
| **Rota** | `/dashboard/detalhamento` |
| **Página** | `DetalhamentoVendas.tsx` |
| **Hook** | `useDetalhamentoVendas` |
| **Filtros** | Empresa, Supervisor, Vendedor, Operação, Data De/Até, Tabela |
| **Tabela Transacional** | Data, Pedido, Cliente, CNPJ, Vendedor, Supervisor, Operação, Marca, Produto, Qtd, Valor Unit, Valor Total |
| **Agrupamento** | Por Operação com subtotais |
| **Paginação** | 20 linhas/página, ordenação por coluna, busca texto, export CSV |

### 4.5 Análise Geográfica

| Aspecto | Detalhe |
|---------|--------|
| **Rota** | `/dashboard/geografico` |
| **Página** | `AnaliseGeografico.tsx` |
| **Hook** | `useAnaliseGeografico` |
| **Filtros** | Empresa, Supervisor, Vendedor, Período, Tabela |
| **Tabela** | UF: Receita, % Participação, Clientes, Ticket Médio |
| **Drill-down** | UF → Cidades → Clientes |
| **Gráficos** | Heatmap de intensidade, Mapa coroplético |

### 4.6 Análise de Produtos

| Aspecto | Detalhe |
|---------|--------|
| **Rota** | `/dashboard/produtos` |
| **Página** | `AnaliseProdutos.tsx` |
| **Hook** | `useAnaliseProdutos` |
| **Filtros** | Empresa, Marca, Grupo, Período, Tabela |
| **Ranking** | Código, Nome, Marca, Qtd Vendida, Receita, % Participação |
| **Curva ABC** | A=80% receita, B=15%, C=5% (automática) |
| **Gráficos** | Treemap por marca/categoria, Barras por produto |

### 4.7 Metas e Projeções

| Aspecto | Detalhe |
|---------|--------|
| **Rota** | `/dashboard/metas` |
| **Página** | `MetasProjecoes.tsx` |
| **Hook** | `useMetasProjecoes` |
| **Fonte Meta** | Tabela `metas_vendas` (empresa, supervisor, vendedor, mes, meta) |
| **Gauge** | Velocímetro de atingimento geral |
| **Tabela** | Supervisor, Vendedor, Meta, Realizado, % Atingimento, Gap |
| **Projeção** | Fechamento mês (dias úteis restantes × média diária) |
| **Gráfico** | Evolução diária acumulada vs meta linear |

### 4.8 Consolidado (Sell-In)

| Aspecto | Detalhe |
|---------|--------|
| **Rota** | `/dashboard/consolidado` |
| **Página** | `Consolidado.tsx` |
| **Hook** | `useConsolidado` |
| **Filtros** | Período, Tabela |
| **Comparativo** | 3 empresas lado a lado: Receita, Meta, %, Pedidos, Clientes, Ticket, Positivação |
| **Gráficos** | Barras agrupadas por empresa, Evolução mensal comparativa (linhas) |

---

## 5. Componentes Compartilhados

### ChartContainer

Wrapper universal para gráficos com:
- Toggle **Gráfico/Tabela**
- **Modo Foco** (fullscreen com `fetchAllRows` para dataset completo)
- Título e ícone configuráveis

### ChartTabs

Alterna visualizações no mesmo espaço (ex: "Barras" / "Pizza" / "Linha").

### AdvancedDataTable

Tabela de dados detalhada com:
- Paginação (20 linhas/página)
- Ordenação por coluna (asc/desc)
- Busca por texto (fulltext client-side)
- Export CSV
- Seleção de colunas visíveis

---

## 6. Lógica de Operações e Multiplicadores

### useOperacaoFilter

Filtra operações visíveis no dropdown de filtro. Operações com multiplicador negativo (ex: Devolução) subtraem da receita total.

```typescript
// Multiplicadores típicos
const operacaoMultipliers = {
  'Venda': 1,
  'Bonificação': 1,
  'Devolução': -1,
  'Troca': -1,
};
```

---

## 7. Ingestão de Dados (n8n → vendas_union)

### Edge Function: `vendas-union-api/sync`

| Aspecto | Detalhe |
|---------|--------|
| **Autenticação** | Header `x-api-key` (validado contra secret) |
| **Método** | POST |
| **Payload** | `{ "vendas": [...] }` — array de itens de pedido |
| **Batch** | Inserções em lotes de 2000 registros |
| **Mapeamento** | Campos legados (ex: `"Vl.Icm Subst."`) → snake_case |
| **RLS** | Ingestão opera com service_role; consumo filtrado por vendedor/supervisor/empresa |

### Sincronização de Dimensões

Edge Function: `sync-dimensao-vendedores`
- Popula `dim_vendedor`, `dim_supervisor`, `dim_empresa` via `SELECT DISTINCT` do histórico de vendas
- Vincula `user_id` do auth.users para habilitar RLS dinâmico

---

## 8. Filtros Globais

Presentes em **todos** os 8 dashboards:

| Filtro | Fonte | Componente |
|--------|-------|-----------|
| Empresa | `dim_empresa` / `empresas` | Select/Dropdown |
| Supervisor | `dim_supervisor` | Select filtrado por empresa |
| Vendedor | `dim_vendedor` | Select filtrado por supervisor |
| Período | Seletor de mês/ano ou range | DatePicker |
| Tabela de Preços | `config_tabelas_usuario` | Dropdown |
| Operação | Distinct de `vendas_union.operacao` | Multi-select |

---

## Referências

- [Mapa de Módulos](./MODULES_OVERVIEW.md)
- [Infraestrutura](./INFRASTRUCTURE.md)

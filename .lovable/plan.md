

# Dashboard Financeiro Consolidado - Contas a Pagar

## Objetivo
Criar um Dashboard Financeiro Consolidado acessivel a partir do modulo Contas a Pagar (e do modulo Financeiro), que unifica a visao de verbas, despesas e campanhas de **todas as origens** (Trade Marketing, Eventos Corporativos e Departamentos) em um unico painel, seguindo o mesmo layout visual do Dashboard Financeiro de Eventos (imagem de referencia).

## O que sera criado

### 1. Hook de Dados Consolidados
**Arquivo:** `src/hooks/useFinanceiroConsolidadoDashboard.ts`

Busca e consolida dados de 3 fontes:
- **Trade Marketing:** `trade_budgets` + `trade_campaign_expenses` + `trade_campaigns`
- **Eventos Corporativos:** `trade_budgets` (vinculadas a eventos) + `corporate_event_expenses` + `corporate_events`
- **Departamentos:** `department_budgets` + `department_expenses`

Calcula:
- **Verbas Consolidadas:** Total orcado, utilizado e disponivel de todas as fontes
- **Despesas Consolidadas:** Quantidade, pendentes, pagos com percentual
- **Fluxo de Caixa:** Entradas (verbas liberadas) vs Saidas (despesas pagas) dos ultimos 6 meses
- **Despesas por Origem:** Agrupamento por Trade / Eventos / Departamentos com valores pendentes e pagos

Filtro por periodo com presets (Este mes, Ultimos 30 dias, Ultimos 90 dias, Este ano, Personalizado).

### 2. Componentes do Dashboard
Seguindo a mesma arquitetura visual dos dashboards de Trade e Eventos:

**a) Card de Verbas Consolidadas** (`src/components/financeiro/consolidado/ConsolidadoVerbaCard.tsx`)
- 3 KPIs: Total Orcado | Utilizado | Disponivel
- Barra de progresso com percentual de utilizacao
- Lista das verbas de todas as origens com icone indicando a fonte (Trade/Eventos/Departamento)

**b) Card de Despesas Consolidadas** (`src/components/financeiro/consolidado/ConsolidadoDespesasCard.tsx`)
- 4 KPIs: Total Origens | Itens Ativos | Pendente | Pago
- Barra de progresso de pagamentos realizados
- Lista de despesas agrupadas por origem com badges de status

**c) Grafico de Fluxo de Caixa** (`src/components/financeiro/consolidado/ConsolidadoFluxoCaixaChart.tsx`)
- Grafico composto (barras + linha) com Entradas, Saidas e Saldo Acumulado
- Totais no cabecalho: Entradas, Saidas, Saldo
- Ultimos 6 meses

**d) Tabela de Despesas** (`src/components/financeiro/consolidado/ConsolidadoDespesasTable.tsx`)
- Todas as despesas de todas as origens
- Colunas: Origem | Campanha/Evento/Departamento | Descricao | Valor Realizado | Status | Data
- Filtro por busca e status
- Exportacao Excel
- Badge colorida indicando a origem (Trade = roxo, Eventos = azul, Departamentos = verde)

### 3. Pagina do Dashboard
**Arquivo:** `src/pages/FinanceiroConsolidadoDashboard.tsx`

Layout identico ao `CorporateEventsDashboard.tsx`:
- Breadcrumb: Financeiro > Dashboard Consolidado
- Cabecalho com titulo, filtro de periodo, botoes de acao
- Indicador do periodo selecionado
- Grid 2 colunas com cards de Verbas e Despesas
- Grafico de Fluxo de Caixa abaixo
- Tabela de despesas ao final

### 4. Rota e Navegacao

- Nova rota: `/dashboard/financeiro/consolidado`
- Adicionar link no sidebar do financeiro
- Adicionar card de navegacao na landing page do Financeiro (`src/pages/Financeiro.tsx`)

## Detalhes Tecnicos

### Fontes de Dados por Modulo

```text
TRADE MARKETING
  Verbas:    trade_budgets (status=active, inactivated_at IS NULL)
  Despesas:  trade_campaign_expenses (join trade_campaigns para nome)
  Campanhas: trade_campaigns

EVENTOS CORPORATIVOS
  Verbas:    trade_budgets (via corporate_events.budget_id)
  Despesas:  corporate_event_expenses (join corporate_events para nome)
  Eventos:   corporate_events

DEPARTAMENTOS
  Verbas:    department_budgets (status=active, approval_status=approved)
  Despesas:  department_expenses (join departamentos para nome)
```

### Mapeamento de Status (PT/EN)
Seguindo o padrao existente do projeto:
- Aprovado/Pago: `['approved', 'aprovado', 'completed', 'pago']`
- Pendente: `['pending', 'pendente']`

### Arquivos Novos (5)
1. `src/hooks/useFinanceiroConsolidadoDashboard.ts`
2. `src/components/financeiro/consolidado/ConsolidadoVerbaCard.tsx`
3. `src/components/financeiro/consolidado/ConsolidadoDespesasCard.tsx`
4. `src/components/financeiro/consolidado/ConsolidadoFluxoCaixaChart.tsx`
5. `src/components/financeiro/consolidado/ConsolidadoDespesasTable.tsx`
6. `src/pages/FinanceiroConsolidadoDashboard.tsx`

### Arquivos Modificados (3)
1. `src/App.tsx` - Adicionar rota
2. `src/pages/Financeiro.tsx` - Adicionar card de navegacao
3. `src/components/dashboard/AppSidebar.tsx` - Adicionar item no menu

### Sem alteracoes no banco de dados
Todas as tabelas necessarias ja existem. Apenas leitura de dados existentes.


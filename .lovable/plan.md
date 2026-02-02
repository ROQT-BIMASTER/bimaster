
# Dashboard Financeiro para Gerente de Trade Marketing

## Objetivo

Criar uma tela sofisticada de controle financeiro para a gerente de Trade (Milene), inspirada no layout de referencia fornecido, que centraliza:
- Verbas disponiveis e utilizadas
- Campanhas pagas e a pagar
- Detalhes de lancamentos por cliente
- Fluxo de caixa visual do Trade

## Arquitetura da Solucao

### Nova Pagina: TradeFinanceiroDashboard.tsx

```text
/dashboard/trade/financeiro/dashboard
```

## Layout Visual (Inspirado na Referencia)

```text
+------------------------------------------------------------------+
|  [Header] Dashboard Financeiro Trade                              |
|  [Breadcrumb] Trade Marketing > Financeiro > Dashboard            |
+------------------------------------------------------------------+

+-----------------------------------+  +-----------------------------------+
| VERBAS DISPONIVEIS          [...]|  | CAMPANHAS A PAGAR           [...] |
| +--------+ +--------+ +--------+ |  | +--------+ +--------+ +--------+  |
| | Total  | |Utiliza-| | Dispo- | |  | | Qtd    | |Pendente| |  Pago  |  |
| | Orcado | |do      | | nivel  | |  | |Campan. | |        | |        |  |
| +--------+ +--------+ +--------+ |  | +--------+ +--------+ +--------+  |
| [Barra de Progresso]             |  | [Barra de Progresso]              |
|                                   |  |                                   |
| Verba Semestre 1     R$ 50k  ... |  | Campanha ABCD    R$ 5.000   Pago  |
| Verba Marketing      R$ 30k  ... |  | Campanha XYZ     R$ 3.200   Pend. |
| Verba PDV            R$ 20k  ... |  | Campanha 123     R$ 8.500   Pend. |
+-----------------------------------+  +-----------------------------------+

+------------------------------------------------------------------+
| FLUXO DE CAIXA TRADE                                              |
| Periodo: Jan/2025 a Jun/2025                                      |
|                                                                   |
| [Grafico de Barras + Linha]                                       |
| - Barras verdes: Entradas (verbas liberadas)                      |
| - Barras vermelhas: Saidas (campanhas pagas)                      |
| - Linha azul: Saldo acumulado                                     |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
| DETALHES DE LANCAMENTOS POR CLIENTE                              |
| [Filtros: Campanha | Status | Data]                              |
|                                                                   |
| Cliente          | Campanha     | Valor    | Status   | ROI      |
| Supermercado X   | PROMOCAO-01  | R$ 5.000 | Aprovado | +15.2%   |
| Atacadao Y       | DEGUSTACAO   | R$ 3.200 | Pendente | -        |
+------------------------------------------------------------------+
```

## Dados e Metricas

### Card 1: Verbas Disponiveis
Dados de: `trade_budgets`
- Total Orcado: SUM(total_amount)
- Total Utilizado: SUM(spent_amount)
- Saldo Disponivel: SUM(available_amount)
- Lista das verbas ativas com % de utilizacao

### Card 2: Campanhas a Pagar
Dados de: `trade_campaigns` + `trade_campaign_expenses`
- Quantidade de campanhas ativas
- Valor total de despesas pendentes (status = pending)
- Valor total de despesas pagas (status = approved/completed)
- Lista das campanhas com valores e status de pagamento

### Grafico: Fluxo de Caixa Trade
Dados combinados de:
- Entradas: Liberacoes de verba (trade_budgets por periodo)
- Saidas: Despesas de campanhas (trade_campaign_expenses.valor_realizado)
- Agrupamento mensal com saldo acumulado

### Tabela: Detalhes de Lancamentos
Dados de: `trade_campaign_lancamentos` + `prospects`
- Cliente (via customer_id -> prospects.nome_empresa)
- Campanha (via campaign_id -> trade_campaigns.name)
- Valor do pedido
- Status do lancamento
- ROI percentual

## Componentes a Criar

| Arquivo | Descricao |
|---------|-----------|
| src/pages/TradeFinanceiroDashboard.tsx | Pagina principal do dashboard |
| src/components/trade/dashboard/TradeVerbaCard.tsx | Card de verbas disponiveis |
| src/components/trade/dashboard/TradeCampanhasAPagarCard.tsx | Card de campanhas a pagar |
| src/components/trade/dashboard/TradeFluxoCaixaChart.tsx | Grafico de fluxo de caixa |
| src/components/trade/dashboard/TradeLancamentosTable.tsx | Tabela de lancamentos detalhados |
| src/hooks/useTradeFinanceiroDashboard.ts | Hook para buscar todos os dados |

## Integracoes Necessarias

### 1. Rota Nova
Adicionar em App.tsx:
```typescript
<Route path="/dashboard/trade/financeiro/dashboard" element={
  <ScreenProtectedRoute screenCode="trade_admin">
    <TradeFinanceiroDashboard />
  </ScreenProtectedRoute>
} />
```

### 2. Link no Menu
Adicionar card na pagina TradeFinanceiro.tsx para acessar o dashboard.

## Funcionalidades Extras

### Filtros Avancados
- Por periodo (semestre/mes)
- Por verba especifica
- Por campanha
- Por cliente

### Acoes Rapidas
- Botao para aprovar despesas pendentes (link para aprovacoes)
- Botao para criar nova campanha
- Botao para adicionar verba

### Exportacao
- Exportar dados para Excel
- Gerar relatorio em PDF

## Fluxo de Dados

```text
useTradeFinanceiroDashboard.ts
  |
  +-- Query 1: trade_budgets (verbas ativas)
  |
  +-- Query 2: trade_campaigns (campanhas em andamento)
  |
  +-- Query 3: trade_campaign_expenses (despesas por status)
  |
  +-- Query 4: trade_campaign_lancamentos + prospects (lancamentos)
  |
  +-- Calculos: Totais, percentuais, fluxo mensal
  |
  +-- Return: { verbas, campanhas, despesas, lancamentos, metricas }
```

## Detalhes Tecnicos

### Estilo Visual
- Cards com bordas coloridas (verde para saldo positivo, vermelho para deficit)
- Barras de progresso para utilizacao de verba
- Badges de status (Pendente: amarelo, Aprovado: verde, Rejeitado: vermelho)
- Grafico com Recharts (mesmo padrao do FluxoDeCaixa.tsx)

### Performance
- React Query com staleTime de 3 minutos
- Queries paralelas para carregamento rapido
- Skeleton loaders durante carregamento

### Responsividade
- Grid adaptativo (1 coluna mobile, 2 colunas tablet, 3+ desktop)
- Scroll horizontal na tabela em telas pequenas
- Cards empilhados em mobile

## Beneficios para a Gerente

1. **Visao Consolidada**: Todas as metricas financeiras de Trade em uma unica tela
2. **Controle de Verbas**: Saber exatamente quanto foi utilizado e quanto resta
3. **Acompanhamento de Pagamentos**: Ver campanhas pendentes e pagas
4. **Analise de ROI**: Identificar campanhas com melhor retorno
5. **Tomada de Decisao**: Dados visuais para aprovar ou rejeitar gastos

## Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| src/pages/TradeFinanceiroDashboard.tsx | Criar | Pagina principal |
| src/components/trade/dashboard/*.tsx | Criar | 4 componentes de dashboard |
| src/hooks/useTradeFinanceiroDashboard.ts | Criar | Hook de dados |
| src/App.tsx | Modificar | Adicionar rota |
| src/pages/TradeFinanceiro.tsx | Modificar | Adicionar link para dashboard |


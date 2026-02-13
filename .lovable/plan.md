

# Traduzir Cards, Graficos e Colunas de Tabelas

## Problema
Os componentes de KPI cards, graficos (Recharts) e tabelas de dados continuam com textos hardcoded em portugues. Apenas 7 arquivos usam `useLanguage` atualmente -- a maioria dos widgets, dashboards e tabelas nao foi integrada.

## Componentes a Traduzir

### Dashboard Widgets (pagina principal)
- **TradeDashboardWidget** - 4 cards: "PDVs Ativos", "Visitas do Mes", "Fotos do Mes", "Investimentos" + descricoes
- **FinanceiroDashboardWidget** - 8 cards: "A Pagar (Pendentes)", "A Pagar (Vencidas)", "Total a Pagar", etc. + headers de secao "Contas a Pagar" / "Contas a Receber"
- **ExecutiveKPIs** - 5 cards: "Total de Prospects", "Visitas (30 dias)", "Taxa de Conversao", "Ticket Medio", "Metas Ativas" + label "vs periodo anterior"
- **FunilProspeccao** - Titulo "Funil de Prospeccao", descricao, tooltip labels ("Prospects:", "Percentual:")

### Trade Marketing
- **BrandShareKPIs** - 4 cards: "Total Medicoes", "Share Medio", "Marca Lider", "Crescimento" + descricoes
- **BrandSharePieChart** - Titulo "Distribuicao por Marca", mensagem vazia
- **BrandShareEvolutionChart** - Titulo "Evolucao Mensal por Marca", mensagem vazia
- **BrandShareRankingTable** - Titulo "Ranking de Lojas por Share", labels "medicoes"
- **TradeExecutiveKPIs** - 4 cards: "PDVs Ativos", "Visitas do Mes", "Fotos do Mes", "ROI Medio"
- **TradeExecutiveTopClients** - Titulo "Top 10 Clientes por Lancamentos"
- **TradeExecutivePhotosGallery** - Titulo "Fotos Recentes", badges "Pendente"
- **ApprovalKPICards** - 5 cards: "Total Pendente", "Campanhas", "Lancamentos", "Valor Total", "Status"

## Abordagem Tecnica

### 1. Expandir dicionario em `LanguageContext.tsx`
Adicionar ~80 novas chaves cobrindo todos os textos dos componentes listados acima, nos 4 idiomas (pt-BR, en, es, ar).

Exemplo de chaves:
```
"trade_widget.active_stores": "PDVs Ativos" / "Active Stores" / "PDVs Activos" / "نقاط البيع النشطة"
"trade_widget.monthly_visits": "Visitas do Mês" / "Monthly Visits" / ...
"finance_widget.payable_pending": "A Pagar (Pendentes)" / "Payable (Pending)" / ...
"chart.brand_distribution": "Distribuição por Marca" / "Brand Distribution" / ...
"table.store_ranking": "Ranking de Lojas por Share" / "Store Share Ranking" / ...
```

### 2. Integrar `useLanguage()` em cada componente
Para cada um dos 12 componentes:
- Importar `useLanguage` de `@/contexts/LanguageContext`
- Extrair `const { t } = useLanguage()`
- Substituir strings hardcoded por chamadas `t("chave")`

### 3. Ordem de implementacao
1. Expandir o dicionario com todas as chaves novas (1 arquivo)
2. Atualizar os 4 widgets do Dashboard principal (TradeDashboardWidget, FinanceiroDashboardWidget, ExecutiveKPIs, FunilProspeccao)
3. Atualizar os 4 componentes de Brand Share
4. Atualizar os 3 componentes Trade Executive
5. Atualizar ApprovalKPICards

## Resultado Esperado
Ao trocar o idioma no seletor, todos os cards de KPI, titulos de graficos, labels de tooltips e headers de tabelas mudarao para o idioma selecionado. Dados dinamicos (nomes de marcas, valores numericos, datas) permanecem no formato original.

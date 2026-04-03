

# Redesign Visual da Página de Prospects

## Problema

A página atual usa elementos básicos (h2 simples, cards genéricos em lista vertical, filtros dentro de Card) que não seguem o design system premium do projeto. Falta uso de `PageHeader`, `KpiCard`, e a listagem em cards empilhados verticalmente é pouco eficiente.

## Proposta

Redesign completo do `ProspectsOptimized.tsx` seguindo os padrões visuais das melhores páginas do projeto (Dashboard, OMS, Fábrica):

### 1. Header com PageHeader + Actions
- Usar `PageHeader` com ícone `Users`, título, descrição dinâmica com contagem
- Actions: botões "IA Insights", "Ver Kanban" (link), "Novo Prospect" (primário)

### 2. KPI Cards Strip (4 cards)
- **Total Prospects** — variant info, ícone Users
- **Em Negociação** — variant warning, ícone TrendingUp
- **Atividades Hoje** — variant success, ícone Activity
- **Taxa Conversão** — variant accent, ícone Target (ganhos / total * 100)
- Usar `KpiCard` do design system com loading state

### 3. Filtros Inline (sem Card wrapper)
- Barra de busca + select de status lado a lado, mais limpo
- Remover o Card que envolve os filtros

### 4. Tabela ao invés de Cards empilhados
- Substituir `InfiniteScrollList` de cards por uma tabela responsiva estilo planilha (padrão desktop do projeto)
- Colunas: Empresa, Contato, Status (badge), Vendedor, Último Contato
- No mobile: manter cards compactos
- Manter infinite scroll na tabela

### 5. Pipeline Mini-Chart
- Adicionar um bar chart horizontal simples mostrando distribuição por status (similar ao screenshot original mas com visual premium)

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/ProspectsOptimized.tsx` | Redesign completo: PageHeader, KpiCard strip, filtros inline, tabela desktop, pipeline chart |

## Componentes Reutilizados
- `PageHeader` de `@/components/ui/page-header`
- `KpiCard` de `@/components/ui/kpi-card`
- Recharts `BarChart` para pipeline (já instalado)
- `Badge` com `statusColors` existentes


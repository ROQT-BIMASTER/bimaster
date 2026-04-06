

# Dashboards Personalizados em "Minhas Tarefas"

## Objetivo

Permitir que o usuário crie e gerencie seus próprios dashboards customizados na tela de Minhas Tarefas, escolhendo quais widgets exibir e organizando-os visualmente.

## Abordagem

Persistir a configuração dos dashboards no banco de dados (tabela `user_custom_dashboards`) para que sobreviva entre sessões. Cada dashboard é uma coleção de widgets com posição definida pelo usuário.

## Widgets Disponíveis

| Widget | Descrição |
|---|---|
| `kpi_pendentes` | KPI de tarefas pendentes |
| `kpi_atrasadas` | KPI de tarefas atrasadas |
| `kpi_concluidas_hoje` | KPI de concluídas hoje |
| `kpi_produtividade` | KPI de produtividade semanal |
| `tarefas_por_projeto` | Gráfico de barras: tarefas agrupadas por projeto |
| `tarefas_por_prioridade` | Gráfico de pizza: distribuição por prioridade |
| `tarefas_por_status` | Gráfico de donut: distribuição por status |
| `timeline_conclusoes` | Gráfico de linha: conclusões nos últimos 7/30 dias |
| `lista_atrasadas` | Mini-lista das tarefas atrasadas |
| `lista_proximas` | Mini-lista das próximas tarefas com prazo |

## Implementação

### 1. Migração SQL — Tabela `user_custom_dashboards`

```sql
CREATE TABLE user_custom_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL DEFAULT 'Meu Dashboard',
  widgets JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

`widgets` armazena array JSON: `[{ "type": "kpi_pendentes", "order": 0, "size": "sm" }, ...]`

RLS: usuário só vê/edita seus próprios dashboards.

### 2. Hook `useCustomDashboards`

- CRUD de dashboards (criar, listar, atualizar widgets, excluir)
- Salvar ordem e seleção de widgets
- Marcar dashboard como padrão

### 3. Componente `CustomDashboardBuilder`

Interface visual com:
- **Aba "Dashboard"** ao lado de Lista/Quadro/Calendário (novo TabsTrigger com ícone BarChart3)
- **Seletor de dashboard** (dropdown com dashboards salvos + botão "Novo Dashboard")
- **Grid de widgets** renderizados em layout responsivo (2 colunas mobile, 4 desktop)
- **Modo edição**: botão "Editar" que mostra checkboxes para adicionar/remover widgets + drag para reordenar
- **Cada widget**: Card com título, conteúdo (KPI, gráfico ou mini-lista) e botão de remover no modo edição

### 4. Componentes de Widget

Criar `src/components/minhas-tarefas/widgets/` com:
- `WidgetTarefasPorProjeto.tsx` — gráfico de barras (Recharts)
- `WidgetTarefasPorPrioridade.tsx` — gráfico de pizza
- `WidgetTarefasPorStatus.tsx` — gráfico de donut
- `WidgetTimelineConclusoes.tsx` — gráfico de linha
- `WidgetListaAtrasadas.tsx` — mini tabela
- `WidgetListaProximas.tsx` — mini tabela
- `WidgetRegistry.tsx` — registro central com metadata (label, ícone, tamanho default)

Os KPIs existentes (`MinhasTarefasKPIs`) serão reutilizados como widgets individuais.

### 5. Integração em `MinhasTarefas.tsx`

- Adicionar view `"dashboard"` ao Tabs existente (Lista | Quadro | Calendário | **Dashboard**)
- Quando `view === "dashboard"`, renderizar `CustomDashboardBuilder` no lugar do conteúdo de tarefas
- Passa `tarefas` filtradas como prop para todos os widgets

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migração SQL | Criar `user_custom_dashboards` com RLS |
| `src/hooks/useCustomDashboards.ts` | Novo — CRUD de dashboards |
| `src/components/minhas-tarefas/CustomDashboardBuilder.tsx` | Novo — builder principal |
| `src/components/minhas-tarefas/widgets/WidgetRegistry.tsx` | Novo — registro de widgets |
| `src/components/minhas-tarefas/widgets/WidgetTarefasPorProjeto.tsx` | Novo — gráfico barras |
| `src/components/minhas-tarefas/widgets/WidgetTarefasPorPrioridade.tsx` | Novo — gráfico pizza |
| `src/components/minhas-tarefas/widgets/WidgetTarefasPorStatus.tsx` | Novo — gráfico donut |
| `src/components/minhas-tarefas/widgets/WidgetTimelineConclusoes.tsx` | Novo — gráfico linha |
| `src/components/minhas-tarefas/widgets/WidgetListaAtrasadas.tsx` | Novo — mini lista |
| `src/components/minhas-tarefas/widgets/WidgetListaProximas.tsx` | Novo — mini lista |
| `src/pages/MinhasTarefas.tsx` | Adicionar aba Dashboard + integrar builder |


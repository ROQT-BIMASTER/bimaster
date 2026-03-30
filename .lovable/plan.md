

# Revisão Completa de UI/UX — Plano Premium

## Diagnóstico

Após auditoria detalhada do codebase, identifiquei os seguintes problemas de consistência e oportunidades de melhoria:

| Problema | Impacto | Escala |
|----------|---------|--------|
| Cores hardcoded (Tailwind `text-blue-`, `bg-green-`, etc.) | Quebra do design system, impossibilita temas | ~1800 ocorrências em 91 arquivos |
| Hex hardcoded em charts/SVGs (`#3b82f6`, etc.) | Inconsistência visual | ~400 ocorrências em 11 arquivos |
| `PageHeader` usado em apenas 3 páginas (de ~150) | Headers inconsistentes | 147+ páginas sem padrão |
| `KpiCard` padronizado usado em apenas 4 arquivos | KPIs com estilos diferentes por módulo | ~10 implementações locais diferentes |
| Dashboard principal sem componentes padrão | Página mais vista é a menos polida | 1 página crítica |
| Múltiplas variantes de KPI locais (MeetingExecutiveDashboard, ExecutiveKPIs, etc.) | Experiência fragmentada | ~14 arquivos |

## Plano de Execução (5 Fases)

### Fase 1 — Design Tokens e Componentes Base (Fundação)

**1.1. Paleta de cores semântica para charts**
- Criar arquivo `src/lib/chart-colors.ts` com constantes que usam `hsl(var(--chart-N))` e fallbacks hex para libs que exigem hex
- Substituir hex hardcoded nos ~11 arquivos de charts/SVGs

**1.2. Evolução do `KpiCard`**
- Adicionar props: `trend` (percentual com seta up/down), `loading` (skeleton interno), `onClick`, `sparkline` (mini gráfico)
- Adicionar variant `"accent"` para destaque principal
- Manter retrocompatibilidade total

**1.3. Evolução do `PageHeader`**
- Adicionar props: `icon` (ícone do módulo), `breadcrumbs` (array de {label, href}), `subtitle` (diferente de description)
- Unificar `TradePageHeader` como alias de `PageHeader` com preset de backTo

### Fase 2 — Dashboard Principal (Impacto Visual Imediato)

**2.1. Redesign do Dashboard**
- Usar `PageHeader` com saudação contextual ("Bom dia, João")
- Substituir módulos quick-access por cards com gradiente sutil, ícone grande, e contadores de pendências
- KPIs principais usando `KpiCard` evoluído com trends
- Chart de atividades com gradiente sob a linha (area chart)
- Seção de atalhos rápidos com ícones modernos

### Fase 3 — Padronização por Módulo (Consistência)

**3.1. Migrar páginas para `PageHeader`**
- Prioridade: módulos China, Fábrica, Financeiro, Trade (páginas mais usadas)
- Substituir headers manuais `<h1>/<h2>` + botão voltar pelo componente padrão
- ~30 páginas prioritárias na primeira iteração

**3.2. Migrar KPIs para `KpiCard` padrão**
- Substituir implementações locais em: `ExecutiveKPIs`, `MeetingExecutiveDashboard`, `FluxoCaixaKPIsAdvanced`, `MarketKPICards`, `MunicipiosKPICards`, `ReactivationKPICards`, `WhitespaceKPICards`
- Usar variants semânticas (`success`, `warning`, `destructive`, `info`)

**3.3. Substituir cores Tailwind hardcoded**
- Batch 1 (~30 páginas críticas): trocar `text-blue-600` → `text-primary`, `text-green-600` → `text-success`, `text-red-600` → `text-destructive`, `text-amber-600` → `text-warning`
- Batch 2 (restante): varrer os 91 arquivos restantes

### Fase 4 — Micro-interações e Polish

**4.1. Loading states consistentes**
- Garantir que todas as páginas usem `Skeleton` nos mesmos padrões
- Adicionar loading skeleton ao `KpiCard` (built-in)

**4.2. Empty states**
- Criar componente `EmptyState` reutilizável (ícone + título + descrição + CTA)
- Aplicar nas listagens principais

**4.3. Transições de página**
- Adicionar `animate-fade-in-up` nos containers principais de cada página
- Stagger nos cards de KPI (`animation-delay-100`, `200`, etc.)

### Fase 5 — Header e Layout Global

**5.1. Refinar header global**
- Reduzir altura para 48px (de 52px)
- Melhorar espaçamento dos elementos à direita
- Adicionar breadcrumb contextual no header

## Prioridade de Execução

Dado o volume (~150 páginas), recomendo executar em blocos incrementais:

1. **Fase 1** (tokens + componentes) — pré-requisito para tudo
2. **Fase 2** (dashboard) — impacto visual imediato
3. **Fase 3 batch 1** (~30 páginas mais usadas)
4. **Fase 4** (polish)
5. **Fase 3 batch 2 + Fase 5** (restante)

## Arquivos Principais Afetados

| Arquivo | Ação |
|---------|------|
| `src/lib/chart-colors.ts` | Criar — paleta de cores para gráficos |
| `src/components/ui/kpi-card.tsx` | Evoluir — trends, loading, sparkline |
| `src/components/ui/page-header.tsx` | Evoluir — icon, breadcrumbs |
| `src/components/ui/empty-state.tsx` | Criar — componente reutilizável |
| `src/pages/Dashboard.tsx` | Redesign completo |
| ~30 páginas prioritárias | Migrar para PageHeader + KpiCard + tokens |
| ~91 arquivos com cores hardcoded | Substituir por tokens semânticos |

## Observação

Cada fase será executada como um bloco independente. Posso começar pela Fase 1 + Fase 2 juntas para que o impacto visual seja percebido imediatamente.


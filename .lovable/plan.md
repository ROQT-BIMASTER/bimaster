

# Padronização Visual do Sistema BiMaster

## Diagnóstico

Após análise completa do código, identifiquei os seguintes problemas de inconsistência:

### 1. Cores hardcoded espalhadas pelo código
Existem **~680 ocorrências** de cores hexadecimais escritas diretamente nos componentes (`text-[#DC2626]`, `bg-[#2563EB]`, `text-[#1B2A4A]`) em vez de usar as variáveis CSS do design system. Isso significa que mudanças de tema não afetam essas cores e a manutenção é impossível.

**Exemplos encontrados:**
- `text-[#1B2A4A]` para títulos (deveria ser `text-foreground`)
- `text-[#DC2626]` para erros (deveria ser `text-destructive`)
- `text-[#16A34A]` para sucesso (deveria ser `text-success`)
- `text-[#2563EB]` para info/primary (deveria ser `text-primary`)
- `text-[#EA580C]` para warning (deveria ser `text-warning`)
- `bg-[#F9FAFB]` para fundos alternados (deveria ser `bg-muted/50`)
- `border-[#dde1e9]` no card.tsx e header (deveria ser `border-border`)
- `bg-white` hardcoded no header (deveria ser `bg-card` ou `bg-background`)

### 2. Componentes UI sem consistência de espaçamento
- Páginas usam paddings diferentes (`p-4`, `p-6`, `px-4 py-6`)
- Headers de página sem componente padronizado (cada tela monta o seu)
- KPI cards com estruturas HTML diferentes em cada módulo

### 3. Tipografia sem escala definida
- Títulos de página variam entre `text-2xl font-semibold`, `text-xl font-bold`, `text-[20px] font-bold`
- Sem componente de PageHeader reutilizável

## Solução

### Fase 1 — Eliminar cores hardcoded (maior impacto)

Substituir todas as cores hex inline pelo token semântico correspondente em **14 arquivos de pages** e **6 arquivos de components**:

| Hardcoded | Token correto |
|-----------|---------------|
| `text-[#1B2A4A]` | `text-foreground` |
| `text-[#DC2626]` | `text-destructive` |
| `text-[#16A34A]` | `text-success` |
| `text-[#2563EB]` | `text-primary` |
| `text-[#EA580C]` | `text-warning` |
| `bg-[#F9FAFB]` | `bg-muted/50` |
| `bg-white` (em áreas dinâmicas) | `bg-card` |
| `border-[#dde1e9]` | `border-border` |

### Fase 2 — Componente PageHeader reutilizável

Criar `src/components/ui/page-header.tsx` com estrutura padronizada:
- Botão voltar (opcional)
- Título + subtítulo
- Área de ações à direita
- KPI badges inline (opcional)

### Fase 3 — Componente KpiCard padronizado

Criar `src/components/ui/kpi-card.tsx`:
- Ícone + label + valor + variação
- Variantes de cor semânticas (`default`, `success`, `warning`, `destructive`, `info`)
- Usa tokens CSS em vez de cores hardcoded

### Fase 4 — Corrigir card.tsx e header

- `card.tsx`: trocar `border-[#dde1e9]` por `border-border` e shadows hardcoded por variáveis CSS
- `DashboardLayout.tsx` header: trocar `border-[#dde1e9]` e `bg-white` por tokens

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/components/ui/page-header.tsx` | Criar componente |
| `src/components/ui/kpi-card.tsx` | Criar componente |
| `src/components/ui/card.tsx` | Substituir cores hardcoded |
| `src/components/dashboard/DashboardLayout.tsx` | Substituir cores hardcoded |
| `src/pages/financeiro/FilaExportacaoERP.tsx` | Migrar para tokens |
| `src/pages/financeiro/RelatorioAPxERP.tsx` | Migrar para tokens |
| `src/pages/financeiro/PainelCentralAP.tsx` | Migrar para tokens |
| `src/components/financeiro/ap/ErpStatusSection.tsx` | Migrar para tokens |
| `src/components/financeiro/ap/PostPaymentErpPrompt.tsx` | Migrar para tokens |
| `src/components/financeiro/ap/IACategorySuggestion.tsx` | Migrar para tokens |
| `src/components/theme/ThemeSelector.tsx` | Migrar para tokens onde aplicável |
| Demais pages com hardcoded hex | Migrar para tokens |


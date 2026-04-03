

# Padronização de Formatação de Valores Financeiros

## Problema Identificado

Existem **5 padrões diferentes** de formatação monetária espalhados pelos módulos financeiros, causando inconsistências visuais:

| Módulo | Formatação Atual | Exemplo |
|---|---|---|
| **Financeiro.tsx** (overview) | `toLocaleString` manual sem `style:'currency'` | `R$ 1.500,00` (sem Intl completo) |
| **Contas a Pagar** (Dashboard) | `Intl.NumberFormat` com `style:'currency'` + 2 decimais | `R$ 1.500,00` |
| **Contas a Receber** (Dashboard) | `Intl.NumberFormat` com `style:'currency'` + 2 decimais | `R$ 1.500,00` |
| **Fluxo de Caixa** (principal) | `Intl.NumberFormat` com `minimumFractionDigits: 0` | `R$ 1.500` (sem centavos) |
| **Fluxo de Caixa** (sub-componente) | Mesmo, sem centavos | `R$ 1.500` |
| **DRE Analítico** | `formatarValor` local com `notation:'compact'` para valores na tabela | `R$ 1,5 mil` vs `R$ 1.500,00` |
| **Dashboard Widget** | `toLocaleString` inline | `R$ 1.500,00` |
| **Saldos Bancários / KPIs** | `SmartValue` com abreviação M/K | `R$ 1,5K` |

### Inconsistências Concretas

1. **Fluxo de Caixa**: usa `minimumFractionDigits: 0` — não mostra centavos, todos os outros mostram
2. **Financeiro.tsx**: usa `toLocaleString` manual em vez de `Intl.NumberFormat` com `style:'currency'` — pode gerar diferenças sutis de espaço (non-breaking space)
3. **DRE**: valores na tabela usam `notation:'compact'` (ex: "R$ 1,5 mil") enquanto cards usam formato completo — está correto contextualmente mas a função local `formatarValor` duplica lógica de `formatters.ts`
4. **28+ componentes** definem `const formatCurrency` localmente em vez de importar de `src/lib/formatters.ts`
5. **Dashboard Widget**: usa `toLocaleString` inline em vez de formatter centralizado

## Plano de Correção

### 1. Padronizar Fluxo de Caixa — Adicionar centavos
- `src/pages/FluxoDeCaixa.tsx`: Alterar ambas as definições de `formatCurrency` para usar `minimumFractionDigits: 2`
- Ou importar `formatCurrency` de `src/lib/formatters.ts`

### 2. Padronizar Financeiro.tsx — Usar Intl completo
- `src/pages/Financeiro.tsx`: Substituir `toLocaleString` manual por import de `formatCurrency` de `src/lib/formatters.ts`

### 3. Padronizar Dashboard Widget
- `src/components/dashboard/FinanceiroDashboardWidget.tsx`: Substituir `toLocaleString` inline por import de `formatCurrency`

### 4. Padronizar DRE — Reutilizar formatters centralizados
- `src/pages/DREAnalitico.tsx`: Substituir `formatarValor` local por imports de `formatCurrency` e `formatCurrencyCompact` de `src/lib/formatters.ts`

### 5. Eliminar duplicações nos 28 componentes financeiros
- Substituir `const formatCurrency = ...` local por `import { formatCurrency } from "@/lib/formatters"`
- Componentes afetados (principais): `DashboardContasPagar`, `DashboardContasReceberAggregated`, `CalendarioVencimentos`, `CalendarioRecebimentos`, `PaymentQueueTable`, `PaymentQueueKPIs`, `ContasPagarSyncPanel`, `ContasReceberSyncPanel`, `FinanceiroChartsGrid`, `MarcarPagoDialog`, `PaymentReviewDialog`, `PaymentBankPrintSummary`, `ReceiptUploadSection`, `RejeicaoFinanceiraDialog`, `ConsolidadoFluxoCaixaChart`, `ConsolidadoDespesasCard`, `ConsolidadoVerbaCard`, `MetasReducaoChart`, `ContasPagarDREView`, `ImportarContasReceberCSV`, `SaldosBancarios`, `CobrancaInadimplentes`, `FluxoCaixaKPIsAdvanced`

## Resultado Esperado

- Todos os valores monetários usam `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })` como base
- Zero funções `formatCurrency` locais — tudo importado de `src/lib/formatters.ts`
- Valores compactos (dashboards/KPIs) usam `SmartValue` ou `formatCurrencyCompact` consistentemente
- Centavos sempre visíveis em tabelas e detalhes

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `src/pages/FluxoDeCaixa.tsx` | Importar formatCurrency, remover 2 definições locais |
| `src/pages/Financeiro.tsx` | Importar formatCurrency, remover definição local |
| `src/pages/DREAnalitico.tsx` | Importar formatCurrency/formatCurrencyCompact, remover formatarValor local |
| `src/components/dashboard/FinanceiroDashboardWidget.tsx` | Importar formatCurrency, remover toLocaleString inline |
| ~20 componentes em `src/components/financeiro/` | Importar formatCurrency, remover definições locais |
| `src/pages/SaldosBancarios.tsx` | Remover formatCurrency local (já usa SmartValue — OK) |
| `src/pages/CobrancaInadimplentes.tsx` | Importar formatCurrency |


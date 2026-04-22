

# Análise da sugestão `TitulosGrid` — não adotar como componente novo, extrair 1 utilitário

A sugestão propõe um componente `src/components/contas-pagar/TitulosGrid.tsx`. Avaliando contra o código real:

## Por quê **não** criar `TitulosGrid` novo

1. **Já existe um grid muito mais completo** em `src/pages/ContasAPagar.tsx` (1829 linhas) com 14+ colunas, ordenação por coluna, paginação server-side, seleção em lote, filtros multi-empresa, badge de classificação IA, ações contextuais por permissão (`canApprovePayment`, `useUIPermissions`) e realtime via Supabase channel. A sugestão tem **7 colunas, sem ordenação, sem paginação, sem permissões, sem realtime** — substituir seria regressão grave.

2. **Hook usado não existe na forma sugerida**. A sugestão chama `const { titulos, loading, buscarTitulos } = useContasPagar()`, mas o hook real (`src/hooks/useContasPagar.ts`) expõe `useContasPagarList()` (React Query, retorna `data`/`isLoading`) e a façade `useContasPagar()` retorna `{ upsert, pay, cancel, reverse, keys }` — sem `titulos`/`buscarTitulos`. Adotar quebraria.

3. **Enums lowercase reapareceriam**. A sugestão usa `pendente|pago|parcial|cancelado|vencido` — exatamente os valores que **rejeitamos na rodada anterior** porque o SDK público (`SdkDownloadButtons.tsx`) usa UPPERCASE com 4 valores. Importar isso reintroduziria o conflito que acabamos de resolver.

4. **`formatarMoeda` local duplicaria** o `formatCurrency` canônico de `src/lib/formatters.ts` (memória `display-and-data-integrity-standards`).

5. **`new Date(t.data_vencimento).toLocaleDateString("pt-BR")`** quebra timezone Brasil — exatamente o bug que `parseLocalDate`/`formatLocalDate` em `src/utils/dateUtils.ts` foi escrito para evitar.

## O que **vale aproveitar** (1 extração cirúrgica)

Existem **3 implementações duplicadas** de `getStatusBadge` para AP/AR (`CalendarioVencimentos.tsx:139`, `CalendarioRecebimentos.tsx:156`, `ConsolidadoDespesasTable.tsx:40`). A ideia da sugestão de centralizar a lógica de badge por status é boa — só não no componente sugerido.

**Extrair um helper único**: `src/components/financeiro/StatusTituloBadge.tsx`

```tsx
import { Badge } from "@/components/ui/badge";
import { StatusTitulo } from "@/types/financeiro/contas-pagar";

const VARIANTS: Record<string, { variant: "default"|"secondary"|"destructive"|"outline", label: string }> = {
  [StatusTitulo.PAGO]:       { variant: "default",     label: "Pago" },
  [StatusTitulo.PENDENTE]:   { variant: "outline",     label: "Pendente" },
  [StatusTitulo.VENCIDO]:    { variant: "destructive", label: "Vencido" },
  [StatusTitulo.CANCELADO]:  { variant: "secondary",   label: "Cancelado" },
  // status calculados (não persistidos) que aparecem via useFinancialStatus:
  parcial: { variant: "secondary", label: "Parcial" },
};

export function StatusTituloBadge({ status }: { status: string }) {
  const cfg = VARIANTS[status?.toLowerCase?.() ?? status] ?? VARIANTS[StatusTitulo.PENDENTE];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
```

Ganhos:
- Cobre os 4 valores persistidos (UPPERCASE do enum) **e** `parcial` calculado pelo `useFinancialStatus`.
- Usa o enum canônico — autocomplete e refactor-safe.
- Variants do shadcn (`default/outline/destructive/secondary`) em vez de `bg-{cor}` cru, mantendo consistência visual dark/light.

## Implementação

1. Criar `src/components/financeiro/StatusTituloBadge.tsx` (componente acima).
2. Refatorar `CalendarioVencimentos.tsx` (linhas 139–148, 379) para usar `<StatusTituloBadge status={conta.status} />`.
3. Refatorar `CalendarioRecebimentos.tsx` (linhas 156–168, 360) — mesma substituição (alias `recebido→pago` no map para reuso).
4. **Não tocar** `ContasAPagar.tsx`, `ConsolidadoDespesasTable`, `PaymentQueueTable`, `SyncMonitorPanel` nesta rodada — têm semânticas próprias (status de sync, status de fila SaaS) que **não** são `StatusTitulo`.
5. **Não criar** `src/components/contas-pagar/TitulosGrid.tsx`.

## Validação

- Grep `getStatusBadge` em `CalendarioVencimentos|CalendarioRecebimentos` deve retornar zero ocorrências após refactor.
- Visual: badge "Vencido" deve permanecer vermelho, "Pago" verde (variant default), "Pendente" outline.

## Não-escopo

- Sem alterações em `ContasAPagar.tsx`, hooks, tipos, SDK, Edge Functions ou `APP_VERSION`.
- Sem mudança em `formatCurrency` ou `dateUtils` (já são padrão).
- Sem novo componente `TitulosGrid` — o grid existente fica.


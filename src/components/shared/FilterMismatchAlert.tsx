import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EyeOff, Filter } from "lucide-react";
import type { FilterMismatchResult } from "@/hooks/useFilterMismatch";

interface Props<T> {
  /** Resultado do hook `useFilterMismatch`. */
  result: FilterMismatchResult<T>;
  /** Rótulo do KPI para contextualizar a mensagem (ex.: "Em Revisão"). */
  kpiLabel: string;
  /** Callback quando o usuário pede para liberar todos os filtros conflitantes. */
  onClearFilters?: () => void;
  /** Callback opcional para mostrar/destacar os itens ocultos (sem limpar tudo). */
  onShowHidden?: () => void;
  /** Esconde o alerta quando não há divergência. */
  hideWhenAligned?: boolean;
}

/**
 * Alerta padronizado que aparece quando o KPI conta mais itens do que a
 * lista filtrada exibe. Mostra detalhamento por motivo (filtro de status,
 * origem, oculto, busca…) e oferece atalhos para liberar a visualização.
 */
export function FilterMismatchAlert<T>({
  result,
  kpiLabel,
  onClearFilters,
  onShowHidden,
  hideWhenAligned = true,
}: Props<T>) {
  if (hideWhenAligned && !result.mismatch) return null;

  return (
    <Alert className="mb-3 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <EyeOff className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1.5 flex-1 min-w-[260px]">
          <div className="text-sm">
            <strong>{result.hiddenItems.length}</strong> de{" "}
            <strong>{result.totalKpi}</strong> registro(s) do KPI{" "}
            <em>"{kpiLabel}"</em> estão sendo escondidos pelos filtros atuais.
          </div>
          {result.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.reasons.map((r) => (
                <Badge
                  key={r.reason}
                  variant="outline"
                  className="text-[10px] border-amber-500/40 bg-amber-100/50 dark:bg-amber-900/30"
                >
                  {r.reason}: {r.count}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {onShowHidden && (
            <Button size="sm" variant="outline" onClick={onShowHidden}>
              <EyeOff className="h-3.5 w-3.5 mr-1" />
              Ver ocultos
            </Button>
          )}
          {onClearFilters && (
            <Button size="sm" variant="outline" onClick={onClearFilters}>
              <Filter className="h-3.5 w-3.5 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

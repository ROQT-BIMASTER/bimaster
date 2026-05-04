import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useProjetoInvestimentoLovable } from "@/hooks/useProjetoInvestimentoLovable";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ProjetoInvestimentoLovableDialog } from "./ProjetoInvestimentoLovableDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  projetoId: string;
  className?: string;
  darkBg?: boolean;
}

export function ProjetoInvestimentoLovableKpi({ projetoId, className, darkBg }: Props) {
  const [open, setOpen] = useState(false);
  const { total } = useProjetoInvestimentoLovable(projetoId);

  const valor = total.data?.valor_total_brl ?? 0;
  const creditos = total.data?.creditos_total ?? 0;

  return (
    <>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm px-4 py-3 transition-all hover:border-border hover:shadow-sm text-left w-full",
                className
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[11px] font-medium uppercase tracking-wide truncate", darkBg ? "text-white/70" : "text-muted-foreground")}>
                    Investimento na plataforma
                  </p>
                  {total.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
                  ) : (
                    <>
                      <p className={cn("text-xl font-semibold leading-tight tabular-nums", darkBg ? "text-white" : "text-foreground")}>
                        {formatCurrency(valor)}
                      </p>
                      <p className={cn("text-[10px] tabular-nums", darkBg ? "text-white/60" : "text-muted-foreground")}>
                        {creditos.toLocaleString("pt-BR")} créditos
                      </p>
                    </>
                  )}
                </div>
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Calculado pela taxa R$/crédito vigente. Clique para detalhar.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ProjetoInvestimentoLovableDialog
        projetoId={projetoId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

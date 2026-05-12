import { CheckCheck, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * Legenda compacta explicando o destaque de "não lido" (título em negrito + fundo
 * card) e o indicador de leitura (dois checks azuis, padrão WhatsApp). Usado tanto
 * na Caixa de Entrada China quanto na tela de Vincular China-Brasil.
 */
export function ReadStatusLegend({ className }: Props) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/70 hover:bg-muted/40 hover:text-foreground transition-colors",
              className,
            )}
            aria-label="O que significam os destaques de leitura?"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-[260px] text-[11px] leading-relaxed">
          <p className="font-semibold text-foreground mb-1">Indicadores de leitura</p>
          <p className="mb-1.5">
            <span className="font-semibold text-foreground">Título em negrito</span> e fundo levemente
            destacado: mensagem ainda <span className="font-semibold">não lida</span>.
          </p>
          <p className="flex items-center gap-1.5">
            <CheckCheck className="h-3 w-3 text-sky-400 shrink-0" />
            Dois checks azuis: você já abriu / marcou esta mensagem como lida.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

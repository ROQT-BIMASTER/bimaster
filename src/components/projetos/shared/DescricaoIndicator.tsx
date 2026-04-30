import { FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DescricaoIndicatorProps {
  descricao: string | null | undefined;
  onClick?: () => void;
  className?: string;
}

/**
 * Indicador visual de que a tarefa possui descrição (notes do Asana / descricao local).
 * Mostra ícone discreto na linha da tarefa com preview do conteúdo no tooltip.
 * Clique abre o detalhe da tarefa para visualizar/editar a descrição completa.
 */
export function DescricaoIndicator({ descricao, onClick, className }: DescricaoIndicatorProps) {
  const text = descricao?.trim();
  if (!text) return null;

  // Preview: primeiras 240 chars sem markdown/html grosseiro
  const preview = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  const hasMore = text.length > 240;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            aria-label="Tarefa possui descrição (anotações)"
            className={cn(
              "inline-flex items-center justify-center h-5 w-5 rounded text-muted-foreground/70 hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0",
              className
            )}
          >
            <FileText className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-sm">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Anotações
            </p>
            <p className="text-xs whitespace-pre-wrap leading-relaxed">
              {preview}
              {hasMore && "…"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

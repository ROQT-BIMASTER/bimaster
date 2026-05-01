import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Rows3, Rows4 } from "lucide-react";
import { useTarefaDensity } from "@/hooks/useTarefaDensity";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * Toggle de densidade (compacto/confortável) para listas de tarefas.
 * Persiste a escolha em localStorage e propaga via custom event.
 */
export function ProjetoDensityToggle({ className }: Props) {
  const { isCompact, toggle } = useTarefaDensity();
  const Icon = isCompact ? Rows4 : Rows3;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn("h-8 w-8", className)}
          aria-label={isCompact ? "Ativar densidade confortável" : "Ativar densidade compacta"}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Densidade: <span className="font-semibold">{isCompact ? "compacta" : "confortável"}</span>
      </TooltipContent>
    </Tooltip>
  );
}

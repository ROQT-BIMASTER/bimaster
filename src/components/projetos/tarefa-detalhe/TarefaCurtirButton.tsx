import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurtidaTarefa } from "@/hooks/useCurtidaTarefa";

interface Props {
  tarefaId: string;
  className?: string;
  /** Compact = só ícone + contador (padrão para barras densas). */
  compact?: boolean;
}

/**
 * Botão de curtir tarefa — estilo Asana.
 * Otimista, isolado, sem invalidar cache global.
 */
export function TarefaCurtirButton({ tarefaId, className, compact = true }: Props) {
  const { liked, total, toggle, loading } = useCurtidaTarefa(tarefaId);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={loading}
      title={liked ? "Remover curtida" : "Curtir tarefa"}
      aria-pressed={liked}
      className={cn(
        "gap-1.5 text-xs rounded-full h-8 px-3 transition-colors",
        liked && "text-primary hover:text-primary",
        className,
      )}
    >
      <ThumbsUp
        className={cn("h-3.5 w-3.5", liked && "fill-current")}
      />
      {compact ? (total > 0 ? total : null) : (
        <>
          <span>Curtir</span>
          {total > 0 && <span className="text-muted-foreground">({total})</span>}
        </>
      )}
    </Button>
  );
}

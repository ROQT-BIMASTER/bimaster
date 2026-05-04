import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mini-trilha de bolinhas para mostrar progresso dentro de um card de aprovação.
 */
export function MiniTrilha({
  total,
  atual,
  isEncaminhamento,
}: {
  total: number;
  atual: number; // 1-based index of current step
  isEncaminhamento?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => {
        const passou = i + 1 < atual;
        const aqui = i + 1 === atual;
        return (
          <div key={i} className="flex items-center">
            {passou ? (
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
            ) : aqui ? (
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full border-2 border-primary",
                  isEncaminhamento ? "bg-primary/30" : "bg-primary",
                )}
              />
            ) : (
              <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
            )}
            {i < total - 1 && <div className="h-px w-1.5 bg-muted-foreground/30" />}
          </div>
        );
      })}
    </div>
  );
}

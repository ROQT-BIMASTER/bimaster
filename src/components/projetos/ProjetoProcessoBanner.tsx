import { Workflow, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useProcessoDoProjeto } from "@/hooks/useProcessoDoProjeto";
import { cn } from "@/lib/utils";

interface Props {
  projetoId: string;
}

/**
 * Faixa exibida acima do header do projeto quando ele espelha um
 * processo operacional. Permite ao coordenador (e demais membros)
 * abrir rapidamente o processo correspondente para ver o fluxo,
 * SLAs e execuções do dia.
 */
export function ProjetoProcessoBanner({ projetoId }: Props) {
  const navigate = useNavigate();
  const { data: proc } = useProcessoDoProjeto(projetoId);
  if (!proc) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5",
      )}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
        <Workflow className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Processo operacional vinculado
        </div>
        <div className="text-sm font-semibold text-foreground truncate">
          {proc.nome}
          {proc.is_coordenador && (
            <span className="ml-2 text-[10px] rounded-full bg-primary/15 text-primary px-2 py-0.5 font-medium">
              Coordenador
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
        onClick={() => navigate(`/dashboard/suporte/processos/${proc.processo_id}`)}
      >
        Abrir processo
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

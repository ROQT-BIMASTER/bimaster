import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { useTicketEtapa } from "@/hooks/suporte/useSuporteFluxo";

interface Props {
  projetoTarefaId?: string | null;
}

export function TicketEtapaBadge({ projetoTarefaId }: Props) {
  const { data } = useTicketEtapa(projetoTarefaId ?? null);
  if (!projetoTarefaId || !data?.etapa) return null;
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="secondary" className="text-[10px]">
        Etapa: {data.etapa}
      </Badge>
      <Link
        to={`/dashboard/projetos/${data.projeto_id}`}
        target="_blank"
        className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        aria-label="Ver no projeto"
      >
        ver no projeto <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

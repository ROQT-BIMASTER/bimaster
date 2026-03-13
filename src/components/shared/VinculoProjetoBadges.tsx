import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Link2, ExternalLink } from "lucide-react";
import { useVinculosDoRegistro, type ModuloType } from "@/hooks/useModuloVinculos";

interface Props {
  modulo: ModuloType;
  registroId: string | undefined;
  onVincular?: () => void;
}

export function VinculoProjetoBadges({ modulo, registroId, onVincular }: Props) {
  const navigate = useNavigate();
  const { data: vinculos = [] } = useVinculosDoRegistro(modulo, registroId);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {vinculos.map((v) => {
        const path = [v.projeto_nome, v.secao_nome, v.tarefa_titulo].filter(Boolean).join(" › ");
        return (
          <Badge
            key={v.id}
            variant="outline"
            className="cursor-pointer hover:bg-accent transition-colors gap-1 text-[11px] max-w-[250px]"
            onClick={() => navigate(`/dashboard/projetos/${v.projeto_id}`)}
          >
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{path}</span>
            <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
          </Badge>
        );
      })}
      {onVincular && (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={onVincular}>
          <Link2 className="h-3 w-3 mr-1" />
          {vinculos.length === 0 ? "Vincular ao Projeto" : "+"}
        </Button>
      )}
    </div>
  );
}

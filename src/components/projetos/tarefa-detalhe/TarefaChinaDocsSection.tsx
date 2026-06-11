import { useChinaDocsDaTarefa } from "@/hooks/useChinaDocsDaTarefa";
import { Badge } from "@/components/ui/badge";
import { Ship } from "lucide-react";
import { ChinaDocumentoBlock } from "./ChinaDocumentoBlock";

interface Props {
  tarefaId: string;
}

export function TarefaChinaDocsSection({ tarefaId }: Props) {
  const { data: docs = [], isLoading } = useChinaDocsDaTarefa(tarefaId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Ship className="h-4 w-4 text-primary" />
          Documentos da China
        </h3>
        <p className="text-xs text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Ship className="h-4 w-4 text-primary" />
          Documentos da China
        </h3>
        <p className="text-xs text-muted-foreground">
          Nenhum documento da China vinculado a esta tarefa ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Ship className="h-4 w-4 text-primary" />
        Documentos da China
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{docs.length}</Badge>
      </h3>

      <div className="space-y-2">
        {docs.map((d) => (
          <ChinaDocumentoBlock key={d.vinculo_id} doc={d} />
        ))}
      </div>
    </div>
  );
}

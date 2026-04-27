import { Workflow, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEspelhoAtivoDaTarefa } from "@/hooks/useEspelhoTarefaGuard";

interface Props {
  tarefaId: string;
  /** Mostra também aviso quando a tarefa já está concluída sem evidência. */
  status?: string;
}

/**
 * Badge exibido em ProjetoTarefaRow / Detalhe / Focus quando a tarefa tem
 * vínculo (espelho) ATIVO com uma etapa de processo.
 *
 * Função: avisar o usuário que concluir essa tarefa exigirá selecionar um
 * documento oficial — antes dele clicar e ser surpreendido pelo diálogo.
 */
export function TarefaEspelhoBadge({ tarefaId, status }: Props) {
  const { data: espelho } = useEspelhoAtivoDaTarefa(tarefaId);
  if (!espelho) return null;

  const exigeDoc = espelho.exige_documentos !== false;
  const jaConcluida = status === "concluida";

  if (jaConcluida) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-5 gap-1 flex-shrink-0 border-primary/40 text-primary"
        >
          {exigeDoc ? <FileWarning className="h-2.5 w-2.5" /> : <Workflow className="h-2.5 w-2.5" />}
          processo
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1 text-xs">
          <p className="font-medium flex items-center gap-1">
            <Workflow className="h-3 w-3" />
            Vinculada a uma etapa do processo
          </p>
          {exigeDoc ? (
            <p className="text-muted-foreground">
              Ao concluir esta tarefa, você precisará selecionar qual documento oficial
              da etapa serve como evidência.
            </p>
          ) : (
            <p className="text-muted-foreground">
              A conclusão será refletida automaticamente na etapa do processo.
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

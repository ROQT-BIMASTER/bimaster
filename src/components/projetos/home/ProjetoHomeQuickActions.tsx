import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Inbox, ListChecks, FolderKanban } from "lucide-react";

interface Props {
  onNovaTarefa?: () => void;
}

export function ProjetoHomeQuickActions({ onNovaTarefa }: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-2">
      {onNovaTarefa && (
        <Button size="sm" onClick={onNovaTarefa} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nova Tarefa
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/projetos/minhas-tarefas")} className="gap-1.5">
        <ListChecks className="h-3.5 w-3.5" />
        Minhas Tarefas
      </Button>
      <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/projetos/inbox")} className="gap-1.5">
        <Inbox className="h-3.5 w-3.5" />
        Caixa de Entrada
      </Button>
      <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/projetos")} className="gap-1.5">
        <FolderKanban className="h-3.5 w-3.5" />
        Todos os Projetos
      </Button>
    </div>
  );
}

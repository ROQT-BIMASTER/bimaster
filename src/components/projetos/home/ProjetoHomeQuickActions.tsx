import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, Inbox, ListChecks, FolderKanban, ChevronDown, Layers, ClipboardList } from "lucide-react";
import { NovaTarefaMinhasDialog } from "@/components/projetos/NovaTarefaMinhasDialog";
import { NovaSecaoDialog } from "@/components/projetos/home/NovaSecaoDialog";

export function ProjetoHomeQuickActions() {
  const navigate = useNavigate();
  const [novaTarefaOpen, setNovaTarefaOpen] = useState(false);
  const [novaSecaoOpen, setNovaSecaoOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Criar
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setNovaTarefaOpen(true)} className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Nova Tarefa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setNovaSecaoOpen(true)} className="gap-2">
              <Layers className="h-4 w-4" />
              Nova Seção em Projeto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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

      <NovaTarefaMinhasDialog open={novaTarefaOpen} onOpenChange={setNovaTarefaOpen} />
      <NovaSecaoDialog open={novaSecaoOpen} onOpenChange={setNovaSecaoOpen} />
    </>
  );
}

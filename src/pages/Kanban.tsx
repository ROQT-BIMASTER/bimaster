import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

const Kanban = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Kanban de Prospects</h2>
          <p className="text-muted-foreground">
            Arraste e solte os prospects entre as colunas para atualizar o status
          </p>
        </div>

        <KanbanBoard />
      </div>
    </DashboardLayout>
  );
};

export default Kanban;

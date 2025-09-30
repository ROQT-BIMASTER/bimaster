import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskBoard } from "@/components/tarefas/TaskBoard";
import { TaskDashboard } from "@/components/tarefas/TaskDashboard";
import { Button } from "@/components/ui/button";
import { Plus, LayoutDashboard, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { NovaAtividadeDialog } from "@/components/atividades/NovaAtividadeDialog";

const Tarefas = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTaskCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Tarefas</h2>
            <p className="text-muted-foreground">
              Gerencie suas atividades e acompanhe o progresso
            </p>
          </div>
          <NovaAtividadeDialog onSuccess={handleTaskCreated} />
        </div>

        <Tabs defaultValue="board" className="space-y-4">
          <TabsList>
            <TabsTrigger value="board" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Board
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="space-y-4">
            <TaskBoard key={refreshKey} />
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-4">
            <TaskDashboard key={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Tarefas;

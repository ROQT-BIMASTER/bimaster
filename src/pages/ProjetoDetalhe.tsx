import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Projeto } from "@/hooks/useProjetos";
import { ProjetoHeader } from "@/components/projetos/ProjetoHeader";
import { ProjetoListView } from "@/components/projetos/ProjetoListView";
import { ProjetoKanbanView } from "@/components/projetos/ProjetoKanbanView";
import { ProjetoCronogramaView } from "@/components/projetos/ProjetoCronogramaView";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjetoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("lista");

  const { data: projeto, isLoading } = useQuery({
    queryKey: ["projeto", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Projeto;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </main>
        </div>
      </SidebarProvider>
    );
  }

  if (!projeto) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <main className="flex-1 flex items-center justify-center text-muted-foreground">
            Projeto não encontrado
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Back button + sidebar trigger */}
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/projetos")} className="gap-1.5 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> Projetos
              </Button>
            </div>

            <ProjetoHeader projeto={projeto} activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Tab content */}
            {activeTab === "lista" && <ProjetoListView projetoId={projeto.id} />}
            {activeTab === "quadro" && <ProjetoKanbanView projetoId={projeto.id} />}
            {activeTab === "cronograma" && <ProjetoCronogramaView projetoId={projeto.id} />}
            {activeTab === "painel" && (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <p>Painel — Em breve</p>
              </div>
            )}
            {activeTab === "arquivos" && (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <p>Arquivos — Em breve</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

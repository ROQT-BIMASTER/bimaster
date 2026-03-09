import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Projeto } from "@/hooks/useProjetos";
import { useProjetoTarefas } from "@/hooks/useProjetoTarefas";
import { ProjetoHeader } from "@/components/projetos/ProjetoHeader";
import { ProjetoListView } from "@/components/projetos/ProjetoListView";
import { ProjetoKanbanView } from "@/components/projetos/ProjetoKanbanView";
import { ProjetoCronogramaView } from "@/components/projetos/ProjetoCronogramaView";
import { ProjetoCalendarioView } from "@/components/projetos/ProjetoCalendarioView";
import { ProjetoBriefingPanel } from "@/components/projetos/ProjetoBriefingPanel";
import { ProjetoEquipeDashboard } from "@/components/projetos/ProjetoEquipeDashboard";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function isDarkColor(hex: string | null): boolean {
  if (!hex) return false;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.4;
}

export default function ProjetoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("lista");
  const { tarefas } = useProjetoTarefas(id);

  const { data: projeto, isLoading } = useQuery({
    queryKey: ["projeto", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Projeto;
    },
    enabled: !!id,
  });

  const handleBgColorChange = async (cor: string | null) => {
    if (!id) return;
    const { error } = await supabase.from("projetos").update({ bg_cor: cor }).eq("id", id);
    if (error) {
      toast.error("Erro ao salvar cor de fundo");
      return;
    }
    queryClient.setQueryData(["projeto", id], (old: Projeto | undefined) =>
      old ? { ...old, bg_cor: cor } : old
    );
  };

  const customBg = !!projeto?.bg_cor;
  const darkBg = isDarkColor(projeto?.bg_cor ?? null);

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
        <main
          className="flex-1 overflow-auto transition-colors duration-300"
          style={customBg ? { backgroundColor: projeto.bg_cor! } : undefined}
        >
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Back button + sidebar trigger + color picker */}
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard/projetos")}
                className={`gap-1.5 ${darkBg ? "text-white hover:bg-white/10" : customBg ? "text-black hover:bg-black/10" : "text-muted-foreground"}`}
              >
                <ArrowLeft className="h-4 w-4" /> Projetos
              </Button>
              <ProjetoBgColorPicker value={projeto.bg_cor ?? null} onChange={handleBgColorChange} />
            </div>

            <ProjetoHeader projeto={projeto} activeTab={activeTab} onTabChange={setActiveTab} tarefas={tarefas} customBg={customBg} darkBg={darkBg} />

            {/* Tab content */}
            {activeTab === "lista" && <ProjetoListView projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "quadro" && <ProjetoKanbanView projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "cronograma" && <ProjetoCronogramaView projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "calendario" && <ProjetoCalendarioView projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "briefings" && <ProjetoBriefingPanel projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "painel" && <ProjetoBriefingPanel projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "equipe" && <ProjetoEquipeDashboard projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "arquivos" && (
              <div className={`flex items-center justify-center py-20 ${darkBg ? "text-white" : customBg ? "text-black" : "text-muted-foreground"}`}>
                <p>Arquivos — Em breve</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

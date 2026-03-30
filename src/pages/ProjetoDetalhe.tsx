import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Projeto } from "@/hooks/useProjetos";
import { useProjetoTarefas } from "@/hooks/useProjetoTarefas";
import { useProjetoChinaVinculo } from "@/hooks/useChinaProjeto";
import { ProjetoHeader } from "@/components/projetos/ProjetoHeader";
import { ProjetoListView } from "@/components/projetos/ProjetoListView";
import { ProjetoKanbanView } from "@/components/projetos/ProjetoKanbanView";
import { ProjetoCronogramaView } from "@/components/projetos/ProjetoCronogramaView";
import { ProjetoCalendarioView } from "@/components/projetos/ProjetoCalendarioView";
import { ProjetoBriefingPanel } from "@/components/projetos/ProjetoBriefingPanel";
import { ProjetoEquipeDashboard } from "@/components/projetos/ProjetoEquipeDashboard";
import { ProjetoArquivosView } from "@/components/projetos/ProjetoArquivosView";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { ProjetoFilters, ProjetoSort, EMPTY_FILTERS, DEFAULT_SORT } from "@/components/projetos/ProjetoFilterSort";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Package } from "lucide-react";
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
  const { tarefas, secoes, teamMembers, createTarefa, softDeleteTarefa, restaurarTarefa, tarefasExcluidas, tarefasExcluidasLoading } = useProjetoTarefas(id);
  const { data: chinaVinculo } = useProjetoChinaVinculo(id);
  const [filters, setFilters] = useState<ProjetoFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<ProjetoSort>(DEFAULT_SORT);

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

  const handleAddTarefa = (titulo: string, secaoId: string) => {
    createTarefa.mutate({ titulo, secao_id: secaoId });
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
              {chinaVinculo && (
                <Badge
                  variant="outline"
                  className={`cursor-pointer gap-1.5 ${darkBg ? "border-white/30 text-white hover:bg-white/10" : ""}`}
                  onClick={() => navigate(`/dashboard/fabrica-china/produto/${chinaVinculo.id}`)}
                >
                  <Package className="h-3.5 w-3.5" />
                  Produto China: {chinaVinculo.produto_codigo}
                </Badge>
              )}
              <ProjetoBgColorPicker value={projeto.bg_cor ?? null} onChange={handleBgColorChange} />
            </div>

            <ProjetoHeader
              projeto={projeto}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              tarefas={tarefas}
              customBg={customBg}
              darkBg={darkBg}
              filters={filters}
              onFiltersChange={setFilters}
              sort={sort}
              onSortChange={setSort}
              teamMembers={teamMembers}
              secoes={secoes.map(s => ({ id: s.id, nome: s.nome }))}
              onAddTarefa={handleAddTarefa}
              tarefasExcluidas={tarefasExcluidas as any}
              tarefasExcluidasLoading={tarefasExcluidasLoading}
              onRestaurarTarefa={(id) => restaurarTarefa.mutate(id)}
            />

            {/* Tab content */}
            {activeTab === "lista" && <ProjetoListView projetoId={projeto.id} darkBg={darkBg} filters={filters} sort={sort} />}
            {activeTab === "quadro" && <ProjetoKanbanView projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "cronograma" && <ProjetoCronogramaView projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "calendario" && <ProjetoCalendarioView projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "briefings" && <ProjetoBriefingPanel projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "painel" && <ProjetoBriefingPanel projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "equipe" && <ProjetoEquipeDashboard projetoId={projeto.id} darkBg={darkBg} />}
            {activeTab === "arquivos" && <ProjetoArquivosView projetoId={projeto.id} darkBg={darkBg} />}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

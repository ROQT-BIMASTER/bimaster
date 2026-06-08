import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
import { PrazosPanel } from "@/components/projetos/PrazosPanel";
import { ProjetoBriefingPanel } from "@/components/projetos/ProjetoBriefingPanel";
import { ProjetoEquipeDashboard } from "@/components/projetos/ProjetoEquipeDashboard";
import { ProjetoArquivosView } from "@/components/projetos/ProjetoArquivosView";
import { ProjetoMetasPanel } from "@/components/projetos/ProjetoMetasPanel";
// ProjetoBgColorPicker agora vive dentro de ProjetoSettingsMenu (acionado pela engrenagem do header)
import { ProjetoFilters, ProjetoSort, EMPTY_FILTERS, DEFAULT_SORT } from "@/components/projetos/ProjetoFilterSort";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Package, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TourButton, projetoDetalheTourSteps, PROJETO_DETALHE_TOUR_ID } from "@/components/tour";
import { logProjectAccessDenied } from "@/lib/auditProjectAccess";
import { ProjetoBackButton } from "@/components/projetos/ProjetoBackButton";
import { getBgPaletteVars } from "@/lib/colorUtils";
import { ProcessoModulosResumoBanner } from "@/components/processos/ProcessoModulosResumoBanner";
import { ProjetoChatTab } from "@/components/projetos/ProjetoChatTab";
import { ProjetoCopilotPanel } from "@/components/projetos/ProjetoCopilotPanel";
import { Sparkles, ExternalLink } from "lucide-react";
import { FloatingActionSlot } from "@/components/ui/floating-action-dock";


function isDarkColor(hex: string | null): boolean {
  if (!hex) return false;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.4;
}

interface ProjetoDetalheProps {
  shared?: boolean;
}

export default function ProjetoDetalhe({ shared = false }: ProjetoDetalheProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep-link de notificações de menção: ?tarefa=ID&comentario=ID ou ?tab=chat&mensagem=ID
  const deepTarefaId = searchParams.get("tarefa");
  const deepComentarioId = searchParams.get("comentario");
  const deepTab = searchParams.get("tab");
  const deepMensagemId = searchParams.get("mensagem");
  const [activeTab, setActiveTab] = useState(deepTab === "chat" ? "chat" : "lista");

  // Limpa os params da URL depois de consumi-los para que reload/share não dispare de novo.
  useEffect(() => {
    if (!deepTarefaId && !deepComentarioId && !deepTab && !deepMensagemId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("tarefa"); next.delete("comentario"); next.delete("tab"); next.delete("mensagem");
    // pequeno delay garante que os filhos consigam ler antes da limpeza
    const t = setTimeout(() => setSearchParams(next, { replace: true }), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [lixeiraOpen, setLixeiraOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const { tarefas, secoes, teamMembers, createTarefa, softDeleteTarefa, restaurarTarefa, tarefasExcluidas, tarefasExcluidasLoading, tarefasExcluidasCount } = useProjetoTarefas(id, { lixeiraOpen });
  const { data: chinaVinculo } = useProjetoChinaVinculo(id);
  const [filters, setFilters] = useState<ProjetoFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<ProjetoSort>(DEFAULT_SORT);

  const { data: projeto, isLoading } = useQuery({
    queryKey: ["projeto", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return (data ?? null) as Projeto | null;
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

  const Frame = ({ children }: { children: React.ReactNode }) => {
    if (shared) {
      return <div className="min-h-screen w-full bg-background">{children}</div>;
    }
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          {children}
        </div>
      </SidebarProvider>
    );
  };

  if (isLoading) {
    return (
      <Frame>
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </Frame>
    );
  }

  if (!projeto) {
    if (id) {
      logProjectAccessDenied(id);
    }
    return (
      <Frame>
        <main className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <p>Você não tem permissão para acessar este projeto.</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/projetos")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar aos Projetos
          </Button>
        </main>
      </Frame>
    );
  }

  return (
    <Frame>
      <main
        className="flex-1 overflow-auto transition-colors duration-300"
        style={
          customBg
            ? ({
                backgroundColor: projeto.bg_cor!,
                color: "hsl(var(--foreground))",
                ...getBgPaletteVars(projeto.bg_cor!),
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="p-4 sm:p-6 space-y-5">
          {/* Topo: navegação ou barra de shared */}
          <div className="flex items-center gap-2" data-tour="pd-header">
            {shared ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/dashboard/projetos/${projeto.id}`)}
                className="gap-1.5"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir no app
              </Button>
            ) : (
              <>
                <SidebarTrigger />
                <ProjetoBackButton
                  label="Projetos"
                  className={darkBg ? "text-white hover:bg-white/10" : customBg ? "text-black hover:bg-black/10" : "text-muted-foreground"}
                />
              </>
            )}
            {chinaVinculo && !shared && (
              <Badge
                variant="outline"
                className={`cursor-pointer gap-1.5 ${darkBg ? "border-white/30 text-white hover:bg-white/10" : ""}`}
                onClick={() => navigate(`/dashboard/fabrica-china/produto/${chinaVinculo.id}`)}
              >
                <Package className="h-3.5 w-3.5" />
                Produto China: {chinaVinculo.produto_codigo}
              </Badge>
            )}
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
            tarefasExcluidasCount={tarefasExcluidasCount}
            lixeiraOpen={lixeiraOpen}
            onLixeiraOpenChange={setLixeiraOpen}
            onRestaurarTarefa={(id) => restaurarTarefa.mutate(id)}
            bgCor={projeto.bg_cor ?? null}
            onBgCorChange={handleBgColorChange}
          />

          {!shared && <ProcessoModulosResumoBanner registroId={projeto.id} />}

          <div data-tour="pd-content" className={cn(
            "rounded-xl border shadow-sm animate-fade-in-up",
            darkBg ? "bg-white/5 border-white/10" : customBg ? "bg-white/60 border-black/10 backdrop-blur-sm" : "bg-card border-border"
          )}>
            <div className="p-4">
              {activeTab === "lista" && <ProjetoListView projetoId={projeto.id} darkBg={darkBg} filters={filters} sort={sort} initialTarefaId={deepTarefaId} highlightCommentId={deepComentarioId} />}
              {activeTab === "quadro" && <ProjetoKanbanView projetoId={projeto.id} darkBg={darkBg} filters={filters} sort={sort} />}
              {activeTab === "cronograma" && <ProjetoCronogramaView projetoId={projeto.id} darkBg={darkBg} filters={filters} sort={sort} />}
              {activeTab === "calendario" && <ProjetoCalendarioView projetoId={projeto.id} darkBg={darkBg} filters={filters} sort={sort} />}
              {activeTab === "prazos" && <PrazosPanel projetoId={projeto.id} darkBg={darkBg} />}
              {activeTab === "briefings" && <ProjetoBriefingPanel projetoId={projeto.id} darkBg={darkBg} />}
              {activeTab === "painel" && <ProjetoEquipeDashboard projetoId={projeto.id} darkBg={darkBg} />}
              {activeTab === "equipe" && <ProjetoEquipeDashboard projetoId={projeto.id} darkBg={darkBg} />}
              {activeTab === "metas" && <ProjetoMetasPanel projetoId={projeto.id} darkBg={darkBg} />}
              {activeTab === "chat" && <ProjetoChatTab projetoId={projeto.id} highlightMsgId={deepMensagemId} />}
              {activeTab === "arquivos" && <ProjetoArquivosView projetoId={projeto.id} darkBg={darkBg} />}
            </div>
          </div>
        </div>
      </main>
      {!shared && (
        <>
          <TourButton tourId={PROJETO_DETALHE_TOUR_ID} tourSteps={projetoDetalheTourSteps} title="Manual do Projeto" description="Aprenda a usar o detalhe do projeto passo a passo" />
          {projeto && (
            <>
              <FloatingActionSlot order={20}>
                <Button
                  onClick={() => setCopilotOpen(true)}
                  size="lg"
                  className="h-12 px-4 shadow-lg gap-2 rounded-full"
                >
                  <Sparkles className="size-4" />
                  Copiloto
                </Button>
              </FloatingActionSlot>
              <ProjetoCopilotPanel
                open={copilotOpen}
                onOpenChange={setCopilotOpen}
                projetoId={projeto.id}
                projetoNome={projeto.nome}
              />
            </>
          )}
        </>
      )}
    </Frame>
  );
}

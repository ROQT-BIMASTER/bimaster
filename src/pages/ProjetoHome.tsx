import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMinhasTarefas, groupTarefas, type MinaTarefa } from "@/hooks/useMinhasTarefas";
import { useMeusProjetosRecentes } from "@/hooks/useMeusProjetosRecentes";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CheckCircle2, AlertTriangle, FolderKanban,
  ChevronDown, ChevronRight, ArrowRight, Rocket
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ProjetoHomeKPIs } from "@/components/projetos/home/ProjetoHomeKPIs";
import { ProjetoHomeQuickActions } from "@/components/projetos/home/ProjetoHomeQuickActions";
import { ProjetoHomeAtividades } from "@/components/projetos/home/ProjetoHomeAtividades";
import { TourButton, projetoHomeTourSteps, PROJETO_HOME_TOUR_ID } from "@/components/tour";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Bom dia", emoji: "☀️" };
  if (hour < 18) return { text: "Boa tarde", emoji: "🌤️" };
  return { text: "Boa noite", emoji: "🌙" };
}

function RichTarefaCard({ tarefa, onToggle }: { tarefa: MinaTarefa; onToggle: (id: string, done: boolean) => void }) {
  const navigate = useNavigate();
  const isDone = tarefa.status === "concluida";
  const isOverdue = !isDone && tarefa.data_prazo && new Date(tarefa.data_prazo) < new Date();

  const prioridadeBadge: Record<string, { label: string; variant: "destructive" | "warning" | "secondary" }> = {
    alta: { label: "Alta", variant: "destructive" },
    media: { label: "Média", variant: "warning" },
    baixa: { label: "Baixa", variant: "secondary" },
  };
  const prio = tarefa.prioridade ? prioridadeBadge[tarefa.prioridade] : null;

  return (
    <div
      className="group relative flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 cursor-pointer animate-fade-in"
      onClick={() => navigate(`/dashboard/projetos/${tarefa.projeto_id}`)}
    >
      {/* Project color bar */}
      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ backgroundColor: tarefa.projeto_cor }} />

      <div className="pl-2">
        <Checkbox
          checked={isDone}
          onCheckedChange={(checked) => onToggle(tarefa.id, !!checked)}
          onClick={(e) => e.stopPropagation()}
          className="h-4.5 w-4.5 rounded-full"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {tarefa.titulo}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tarefa.projeto_cor }} />
          <span className="text-[11px] text-muted-foreground truncate">{tarefa.projeto_nome}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {prio && (
          <Badge variant={prio.variant} className="text-[10px] px-1.5 py-0 h-4">
            {prio.label}
          </Badge>
        )}
        {tarefa.data_prazo && (
          <span className={`text-[11px] font-medium ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
            {isOverdue && <AlertTriangle className="h-3 w-3 inline mr-0.5 -mt-0.5" />}
            {format(new Date(tarefa.data_prazo), "d MMM", { locale: ptBR })}
          </span>
        )}
      </div>
    </div>
  );
}

function TarefaSection({ group, onToggle }: { group: { label: string; key: string; items: MinaTarefa[] }; onToggle: (id: string, done: boolean) => void }) {
  const [collapsed, setCollapsed] = useState(group.key === "concluidas");

  const sectionStyles: Record<string, string> = {
    atrasadas: "text-destructive",
    hoje: "text-primary",
    semana: "text-foreground",
    mais_tarde: "text-muted-foreground",
    sem_data: "text-muted-foreground",
    concluidas: "text-success",
  };

  return (
    <div className="animate-fade-in">
      <button
        className="flex items-center gap-2 w-full px-1 py-2 hover:bg-muted/30 rounded-md transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span className={`text-xs font-semibold uppercase tracking-wider ${sectionStyles[group.key] || ""}`}>
          {group.label}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
          {group.items.length}
        </Badge>
      </button>
      {!collapsed && (
        <div className="space-y-2 mt-1 mb-3">
          {group.items.map(t => (
            <RichTarefaCard key={t.id} tarefa={t} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjetoHome() {
  const { user } = useAuth();
  const { data: tarefas = [], isLoading: loadingTarefas } = useMinhasTarefas();
  const { data: projetos = [], isLoading: loadingProjetos } = useMeusProjetosRecentes();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: profileData } = useQuery({
    queryKey: ["my-profile-name", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("nome").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const userName = profileData?.nome?.split(" ")[0] || user?.email?.split("@")[0] || "Usuário";
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const greeting = getGreeting();

  const groups = groupTarefas(tarefas);

  const handleToggleTarefa = async (tarefaId: string, done: boolean) => {
    const newStatus = done ? "concluida" : "pendente";
    const update: any = { status: newStatus };
    if (done) update.data_conclusao = new Date().toISOString();
    else update.data_conclusao = null;

    const { error } = await supabase
      .from("projeto_tarefas")
      .update(update)
      .eq("id", tarefaId);

    if (error) {
      toast.error("Erro ao atualizar tarefa");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["minhas-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["meus-projetos-recentes"] });
    toast.success(done ? "Tarefa concluída!" : "Tarefa reaberta");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <p className="text-xs text-muted-foreground capitalize">{today}</p>
                  <h1 className="text-2xl font-bold text-foreground">
                    {greeting.emoji} {greeting.text}, {userName}
                  </h1>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <ProjetoHomeKPIs tarefas={tarefas} loading={loadingTarefas} />

            {/* Quick Actions */}
            <ProjetoHomeQuickActions />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Column — Tasks */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Minhas Tarefas</h2>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/projetos/minhas-tarefas")} className="gap-1 text-xs">
                    Ver todas <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>

                {loadingTarefas ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                  </div>
                ) : groups.length === 0 ? (
                  <EmptyState
                    icon={Rocket}
                    title="Tudo em dia!"
                    description="Nenhuma tarefa atribuída a você no momento. Explore seus projetos ou crie uma nova tarefa."
                    actionLabel="Ir para Minhas Tarefas"
                    onAction={() => navigate("/dashboard/projetos/minhas-tarefas")}
                  />
                ) : (
                  <div className="space-y-1">
                    {groups.map(g => (
                      <TarefaSection key={g.key} group={g} onToggle={handleToggleTarefa} />
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Projects */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-primary" />
                      Meus Projetos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingProjetos ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                      </div>
                    ) : projetos.length === 0 ? (
                      <div className="py-6 text-center text-muted-foreground text-sm">
                        Nenhum projeto ativo
                      </div>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {projetos.map(p => {
                          const progress = p.total_tarefas > 0
                            ? Math.round((p.concluidas / p.total_tarefas) * 100)
                            : 0;
                          return (
                            <button
                              key={p.id}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left group"
                              onClick={() => navigate(`/dashboard/projetos/${p.id}`)}
                            >
                              <div
                                className="h-8 w-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                                style={{ backgroundColor: p.cor }}
                              >
                                {p.nome.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{p.nome}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress value={progress} className="h-1.5 flex-1" />
                                  <span className="text-[10px] text-muted-foreground shrink-0">{progress}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {p.atrasadas > 0 && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                                    {p.atrasadas}
                                  </Badge>
                                )}
                                {p.minhas_pendentes > 0 && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    {p.minhas_pendentes}
                                  </Badge>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <ProjetoHomeAtividades />
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

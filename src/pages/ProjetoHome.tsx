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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  CheckCircle2, Clock, AlertTriangle, Calendar, FolderKanban,
  ChevronDown, ChevronRight, Loader2, Circle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function TarefaRow({ tarefa, onToggle }: { tarefa: MinaTarefa; onToggle: (id: string, done: boolean) => void }) {
  const navigate = useNavigate();
  const isDone = tarefa.status === "concluida";
  const isOverdue = !isDone && tarefa.data_prazo && new Date(tarefa.data_prazo) < new Date();

  return (
    <div 
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group cursor-pointer border-b border-border/20 last:border-b-0"
      onClick={() => navigate(`/dashboard/projetos/${tarefa.projeto_id}`)}
    >
      <Checkbox
        checked={isDone}
        onCheckedChange={(checked) => {
          onToggle(tarefa.id, !!checked);
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-4.5 w-4.5 rounded-full"
      />
      <span className={`flex-1 text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
        {tarefa.titulo}
      </span>
      {tarefa.data_prazo && (
        <span className={`text-xs ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {format(new Date(tarefa.data_prazo), "d MMM", { locale: ptBR })}
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tarefa.projeto_cor }} />
        <span className="text-xs text-muted-foreground hidden sm:inline max-w-[120px] truncate">
          {tarefa.projeto_nome}
        </span>
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
    <div>
      <button 
        className="flex items-center gap-2 w-full px-4 py-2 bg-muted/30 border-b border-border/30 hover:bg-muted/50 transition-colors"
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
      {!collapsed && group.items.map(t => (
        <TarefaRow key={t.id} tarefa={t} onToggle={onToggle} />
      ))}
    </div>
  );
}

export default function ProjetoHome() {
  const { user } = useAuth();
  const { data: tarefas = [], isLoading: loadingTarefas } = useMinhasTarefas();
  const { data: projetos = [], isLoading: loadingProjetos } = useMeusProjetosRecentes();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch profile name
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

  const pendentes = tarefas.filter(t => t.status !== "concluida");
  const atrasadas = pendentes.filter(t => t.data_prazo && new Date(t.data_prazo) < new Date());
  const concluidasHoje = tarefas.filter(t => t.status === "concluida" && t.data_conclusao && 
    new Date(t.data_conclusao).toDateString() === new Date().toDateString());

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
          <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header — Greeting */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <p className="text-xs text-muted-foreground capitalize">{today}</p>
                  <h1 className="text-2xl font-bold text-foreground">
                    {getGreeting()}, {userName}
                  </h1>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="hidden md:flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>{concluidasHoje.length} concluídas hoje</span>
                </div>
                {atrasadas.length > 0 && (
                  <div className="flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{atrasadas.length} atrasadas</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column — Minhas Tarefas (2/3 width) */}
              <div className="lg:col-span-2">
                <Card className="overflow-hidden">
                  <CardHeader className="pb-0 border-b border-border/30">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Avatar className="h-7 w-7 bg-primary/10">
                          <AvatarFallback className="text-xs font-medium text-primary bg-primary/10">
                            {userName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        Minhas Tarefas
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {pendentes.length} pendentes
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingTarefas ? (
                      <div className="p-6 space-y-3">
                        {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    ) : groups.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <CheckCircle2 className="h-10 w-10 mb-3 opacity-40" />
                        <p className="font-medium">Nenhuma tarefa atribuída</p>
                        <p className="text-sm">Tarefas atribuídas a você aparecerão aqui</p>
                      </div>
                    ) : (
                      <div>
                        {groups.map(g => (
                          <TarefaSection key={g.key} group={g} onToggle={handleToggleTarefa} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column — Projetos Recentes (1/3 width) */}
              <div className="space-y-6">
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
                        {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                      </div>
                    ) : projetos.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground text-sm">
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
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
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
                              {p.minhas_pendentes > 0 && (
                                <Badge variant="secondary" className="text-[10px] shrink-0">
                                  {p.minhas_pendentes}
                                </Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Summary Card */}
                <Card>
                  <CardContent className="pt-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-foreground">{pendentes.length}</div>
                        <div className="text-[11px] text-muted-foreground">Pendentes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-success">{concluidasHoje.length}</div>
                        <div className="text-[11px] text-muted-foreground">Concluídas hoje</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-destructive">{atrasadas.length}</div>
                        <div className="text-[11px] text-muted-foreground">Atrasadas</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">{projetos.length}</div>
                        <div className="text-[11px] text-muted-foreground">Projetos ativos</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

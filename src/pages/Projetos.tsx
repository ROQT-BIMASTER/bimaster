import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProjetos, Projeto } from "@/hooks/useProjetos";
import { NovoProjetoDialog } from "@/components/projetos/NovoProjetoDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, FolderOpen, Loader2, MoreHorizontal, Trash2, CheckCircle2, Calendar, LayoutGrid, List } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useResolvedAvatarUrl } from "@/hooks/useResolvedAvatarUrl";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function MemberAvatar({ avatarUrl, nome }: { avatarUrl: string | null; nome: string | null }) {
  const resolved = useResolvedAvatarUrl(avatarUrl);
  return (
    <Avatar className="h-7 w-7 border-2 border-background">
      <AvatarImage src={resolved} className="object-cover" />
      <AvatarFallback className="text-[10px] font-medium bg-muted">
        {(nome || "?").charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function getProjetoStatus(projetoStatus: string, metrics: { total: number; concluidas: number; atrasadas: number }) {
  if (projetoStatus === "finalizado" || (metrics.total > 0 && metrics.concluidas === metrics.total)) {
    return { label: "Concluído", variant: "success" as const, color: "text-green-600" };
  }
  if (metrics.atrasadas > 0) {
    return { label: "Atrasado", variant: "destructive" as const, color: "text-red-600" };
  }
  if (metrics.concluidas > 0) {
    return { label: "Em Andamento", variant: "secondary" as const, color: "text-blue-600" };
  }
  return { label: "No Prazo", variant: "outline" as const, color: "text-green-600" };
}

function ProjectDropdown({ projeto, isFinalizado, onFinalize, onDelete }: { projeto: Projeto; isFinalizado: boolean; onFinalize: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        {!isFinalizado && (
          <>
            <DropdownMenuItem onClick={onFinalize}>
              <CheckCircle2 className="h-4 w-4 mr-2 text-success" /> Finalizar Projeto
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


  const { projetos, isLoading, deleteProjeto, finalizarProjeto, projetoMetrics, projetoMembros } = useProjetos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const navigate = useNavigate();

  const metricsMap = useMemo(() => {
    const map = new Map<string, { total: number; concluidas: number; atrasadas: number }>();
    for (const m of projetoMetrics) {
      map.set(m.projeto_id, { total: m.total_tarefas, concluidas: m.concluidas, atrasadas: m.atrasadas });
    }
    return map;
  }, [projetoMetrics]);

  const membrosMap = useMemo(() => {
    const map = new Map<string, Array<{ user_id: string; nome: string | null; avatar_url: string | null }>>();
    for (const m of projetoMembros) {
      if (!map.has(m.projeto_id)) map.set(m.projeto_id, []);
      map.get(m.projeto_id)!.push({
        user_id: m.user_id,
        nome: m.profiles?.nome || null,
        avatar_url: m.profiles?.avatar_url || null,
      });
    }
    return map;
  }, [projetoMembros]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
                  <p className="text-sm text-muted-foreground">Gerencie seus projetos e equipes</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-none"
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-none"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Novo Projeto
                </Button>
              </div>
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty state */}
            {!isLoading && projetos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FolderOpen className="h-16 w-16 mb-4 opacity-30" />
                <p className="font-medium text-lg">Nenhum projeto ainda</p>
                <p className="text-sm mb-4">Crie seu primeiro projeto para começar</p>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Criar Projeto
                </Button>
              </div>
            )}

            {!isLoading && projetos.length > 0 && viewMode === "grid" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projetos.map(projeto => {
                  const metrics = metricsMap.get(projeto.id) || { total: 0, concluidas: 0, atrasadas: 0 };
                  const membros = membrosMap.get(projeto.id) || [];
                  const isFinalizado = projeto.status === "finalizado" || (metrics.total > 0 && metrics.concluidas === metrics.total);
                  const progressPercent = metrics.total > 0 ? Math.round((metrics.concluidas / metrics.total) * 100) : 0;
                  const displayPercent = isFinalizado ? 100 : progressPercent;
                  const status = getProjetoStatus(projeto.status, metrics);
                  const displayMembros = membros.slice(0, 3);
                  const extraMembros = membros.length - 3;

                  return (
                    <Card
                      key={projeto.id}
                      className="cursor-pointer hover:shadow-lg transition-all group relative overflow-hidden"
                      onClick={() => navigate(`/dashboard/projetos/${projeto.id}`)}
                    >
                      <div className="h-1.5" style={{ backgroundColor: projeto.cor }} />
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: projeto.cor }}>
                              <span className="text-white font-bold text-sm">{projeto.nome.charAt(0)}</span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold text-foreground truncate">{projeto.nome}</h3>
                              {projeto.descricao && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{projeto.descricao}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant={status.variant} className="text-[10px] px-2 py-0.5 whitespace-nowrap">
                              {status.label}
                            </Badge>
                            <ProjectDropdown
                              projeto={projeto}
                              isFinalizado={isFinalizado}
                              onFinalize={() => finalizarProjeto.mutate(projeto.id)}
                              onDelete={() => deleteProjeto.mutate(projeto.id)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              <span className="font-semibold text-foreground">{isFinalizado ? metrics.total : metrics.concluidas}</span>
                              {" / "}{metrics.total} tarefas
                            </span>
                            <span className={`font-bold ${displayPercent === 100 ? "text-success" : "text-foreground"}`}>
                              {displayPercent}%
                            </span>
                          </div>
                          <Progress value={displayPercent} className="h-2" gradient={displayPercent === 100} />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center -space-x-1.5">
                            {displayMembros.map(m => (
                              <MemberAvatar key={m.user_id} avatarUrl={m.avatar_url} nome={m.nome} />
                            ))}
                            {extraMembros > 0 && (
                              <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                <span className="text-[10px] font-medium text-muted-foreground">+{extraMembros}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(projeto.created_at), "dd MMM yyyy", { locale: ptBR })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* List view */}
            {!isLoading && projetos.length > 0 && viewMode === "list" && (
              <div className="border rounded-xl overflow-hidden bg-card">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_120px_180px_140px_100px_40px] gap-4 px-5 py-3 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                  <span>Projeto</span>
                  <span>Status</span>
                  <span>Progresso</span>
                  <span>Membros</span>
                  <span>Criado em</span>
                  <span />
                </div>
                {projetos.map(projeto => {
                  const metrics = metricsMap.get(projeto.id) || { total: 0, concluidas: 0, atrasadas: 0 };
                  const membros = membrosMap.get(projeto.id) || [];
                  const isFinalizado = projeto.status === "finalizado" || (metrics.total > 0 && metrics.concluidas === metrics.total);
                  const progressPercent = metrics.total > 0 ? Math.round((metrics.concluidas / metrics.total) * 100) : 0;
                  const displayPercent = isFinalizado ? 100 : progressPercent;
                  const status = getProjetoStatus(projeto.status, metrics);
                  const displayMembros = membros.slice(0, 4);
                  const extraMembros = membros.length - 4;

                  return (
                    <div
                      key={projeto.id}
                      className="grid grid-cols-[1fr_120px_180px_140px_100px_40px] gap-4 px-5 py-3 items-center border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/dashboard/projetos/${projeto.id}`)}
                    >
                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: projeto.cor }}>
                          <span className="text-white font-bold text-xs">{projeto.nome.charAt(0)}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{projeto.nome}</p>
                          {projeto.descricao && (
                            <p className="text-[11px] text-muted-foreground truncate">{projeto.descricao}</p>
                          )}
                        </div>
                      </div>
                      {/* Status */}
                      <div>
                        <Badge variant={status.variant} className="text-[10px] px-2 py-0.5">{status.label}</Badge>
                      </div>
                      {/* Progress */}
                      <div className="flex items-center gap-3">
                        <Progress value={displayPercent} className="h-1.5 flex-1" gradient={displayPercent === 100} />
                        <span className={`text-xs font-semibold min-w-[32px] text-right ${displayPercent === 100 ? "text-success" : "text-foreground"}`}>
                          {displayPercent}%
                        </span>
                      </div>
                      {/* Members */}
                      <div className="flex items-center -space-x-1.5">
                        {displayMembros.map(m => (
                          <MemberAvatar key={m.user_id} avatarUrl={m.avatar_url} nome={m.nome} />
                        ))}
                        {extraMembros > 0 && (
                          <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                            <span className="text-[10px] font-medium text-muted-foreground">+{extraMembros}</span>
                          </div>
                        )}
                      </div>
                      {/* Date */}
                      <div className="text-[11px] text-muted-foreground">
                        {format(new Date(projeto.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </div>
                      {/* Menu */}
                      <ProjectDropdown
                        projeto={projeto}
                        isFinalizado={isFinalizado}
                        onFinalize={() => finalizarProjeto.mutate(projeto.id)}
                        onDelete={() => deleteProjeto.mutate(projeto.id)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <NovoProjetoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </SidebarProvider>
  );
}

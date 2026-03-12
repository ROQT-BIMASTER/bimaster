import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, ChevronRight, FolderKanban, CheckCircle2, AlertTriangle, ClipboardList, Trophy, ArrowLeft, Camera, Loader2, Target, TrendingUp, Mail, X, BarChart3, Award, Minimize2, Calendar, Flag } from "lucide-react";
import { useProjetosTeamData, ProjetoTeamMember } from "@/hooks/useProjetosTeamData";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TarefaRiskBadge } from "@/components/projetos/TarefaRiskBadge";
import { format, parseISO, startOfMonth, endOfMonth, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useUserRole } from "@/hooks/useUserRole";
import { useResolvedAvatarUrl } from "@/hooks/useResolvedAvatarUrl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const ROLE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  admin: {
    label: "Admin",
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-300 dark:border-red-700",
  },
  gerente: {
    label: "Gerente",
    bg: "bg-purple-100 dark:bg-purple-900/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-700",
  },
  supervisor: {
    label: "Supervisor",
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
  },
  vendedor: {
    label: "Vendedor",
    bg: "bg-green-100 dark:bg-green-900/40",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
  },
  promotor: {
    label: "Promotor",
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-700",
  },
};

const getRoleStyle = (role: string) => {
  const config = ROLE_CONFIG[role];
  if (!config) return { label: role, className: "bg-muted text-muted-foreground border-border" };
  return { label: config.label, className: `${config.bg} ${config.text} ${config.border}` };
};

// --- Inline Avatar with Upload ---
function AvatarWithUpload({
  member,
  size = "md",
  canUpload,
}: {
  member: ProjetoTeamMember;
  size?: "sm" | "md" | "lg";
  canUpload: boolean;
}) {
  const resolved = useResolvedAvatarUrl(member.avatar_url);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const sizeClass = size === "lg" ? "h-28 w-28" : size === "sm" ? "h-11 w-11" : "h-14 w-14";
  const iconSize = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const textSize = size === "lg" ? "text-2xl" : "text-xs";
  const avatarSrc = localUrl || resolved;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB"); return; }

    try {
      setUploading(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${member.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) throw signErr || new Error("Erro ao gerar URL");

      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: signed.signedUrl }).eq("id", member.id);
      if (updErr) throw updErr;

      setLocalUrl(signed.signedUrl);
      toast.success("Foto atualizada!");
      queryClient.invalidateQueries({ queryKey: ["projetos-team"] });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar foto: " + (err.message || "Tente novamente"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="relative inline-block group">
      <Avatar className={`${sizeClass} ${size === "lg" ? "ring-4 ring-primary/20" : ""}`}>
        <AvatarImage src={avatarSrc} className="object-cover" />
        <AvatarFallback className={`bg-primary/10 text-primary ${textSize} font-semibold`}>
          {member.nome?.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      {canUpload && (
        <>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          <button
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            {uploading ? (
              <Loader2 className={`${iconSize} text-white animate-spin`} />
            ) : (
              <Camera className={`${iconSize} text-white`} />
            )}
          </button>
        </>
      )}
    </div>
  );
}

// --- Status helpers ---
const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  em_andamento: { label: "Em andamento", className: "bg-blue-500/20 text-blue-400" },
  concluida: { label: "Concluída", className: "bg-green-500/20 text-green-400" },
  bloqueada: { label: "Bloqueada", className: "bg-red-500/20 text-red-400" },
};

const PRIORITY_LABELS: Record<string, { label: string; className: string }> = {
  alta: { label: "Alta", className: "text-red-500" },
  media: { label: "Média", className: "text-amber-500" },
  baixa: { label: "Baixa", className: "text-green-500" },
};

// --- Member Detail Modal (Focus Mode style) ---
function MemberDetailModal({
  member,
  open,
  onClose,
  canUpload,
  allMembers = [],
}: {
  member: ProjetoTeamMember | null;
  open: boolean;
  onClose: () => void;
  canUpload: boolean;
  allMembers?: ProjetoTeamMember[];
}) {
  const [statusFilter, setStatusFilter] = useState("todas");

  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["member-tarefas", member?.id],
    queryFn: async () => {
      if (!member) return [];
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, codigo, status, prioridade, data_prazo, projetos:projeto_id(nome)")
        .eq("responsavel_id", member.id)
        .order("data_prazo", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!member && open,
  });

  if (!member) return null;

  const roleStyle = getRoleStyle(member.role);
  const completionColor = member.taxa_conclusao >= 80
    ? "text-green-600 dark:text-green-400"
    : member.taxa_conclusao >= 50
    ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  const sortedMembers = [...allMembers].sort((a, b) => b.score - a.score);
  const rankPosition = sortedMembers.findIndex(m => m.id === member.id) + 1;
  const totalMembers = allMembers.length;
  const pendentes = member.tarefas_atribuidas - member.tarefas_concluidas;

  const today = new Date().toISOString().split("T")[0];
  const filteredTarefas = tarefas.filter((t: any) => {
    if (statusFilter === "todas") return true;
    if (statusFilter === "pendentes") return t.status !== "concluida";
    if (statusFilter === "concluidas") return t.status === "concluida";
    if (statusFilter === "atrasadas") return t.status !== "concluida" && t.data_prazo && t.data_prazo < today;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0 gap-0 flex flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Performance de {member.nome}</DialogTitle>
        </DialogHeader>

        {/* Header compacto */}
        <div className="flex items-center gap-4 px-6 py-4 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shrink-0">
          <AvatarWithUpload member={member} size="md" canUpload={canUpload} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground truncate">{member.nome}</h2>
              <Badge variant="outline" className={`text-xs font-semibold ${roleStyle.className}`}>
                {roleStyle.label}
              </Badge>
              {rankPosition > 0 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Trophy className="h-3 w-3" />
                  {rankPosition}º lugar
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{member.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 text-center">
              <p className="text-xs text-muted-foreground font-medium">Score</p>
              <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">{member.score}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
              <Minimize2 className="h-4 w-4" />
              Sair do Foco
            </Button>
          </div>
        </div>

        {/* Two column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left column - Analytics */}
          <ScrollArea className="w-[38%] border-r">
            <div className="p-6 space-y-5">
              {/* KPIs 2x2 */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-l-4 border-l-indigo-500">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <FolderKanban className="h-4 w-4 text-indigo-500" />
                      <span className="text-xs text-muted-foreground">Projetos</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{member.projetos_ativos}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <ClipboardList className="h-4 w-4 text-blue-500" />
                      <span className="text-xs text-muted-foreground">Tarefas</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{member.tarefas_atribuidas}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-xs text-muted-foreground">Concluídas</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{member.tarefas_concluidas}</p>
                  </CardContent>
                </Card>
                <Card className={`border-l-4 ${member.tarefas_atrasadas > 0 ? "border-l-destructive" : "border-l-border"}`}>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className={`h-4 w-4 ${member.tarefas_atrasadas > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                      <span className="text-xs text-muted-foreground">Atrasadas</span>
                    </div>
                    <p className={`text-2xl font-bold ${member.tarefas_atrasadas > 0 ? "text-destructive" : "text-foreground"}`}>
                      {member.tarefas_atrasadas}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Taxa de Conclusão */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Taxa de Conclusão
                    </span>
                    <span className={`text-lg font-bold ${completionColor}`}>{member.taxa_conclusao}%</span>
                  </div>
                  <Progress value={member.taxa_conclusao} gradient className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{member.tarefas_concluidas} concluídas</span>
                    <span>{pendentes} pendentes</span>
                  </div>
                </CardContent>
              </Card>

              {/* Score Card */}
              <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/40">
                      <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Produtividade</p>
                      <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">{member.score} pts</p>
                      <p className="text-[10px] text-muted-foreground">concluídas×3 + projetos×2</p>
                    </div>
                  </div>
                  <TrendingUp className="h-8 w-8 text-amber-300 dark:text-amber-700" />
                </CardContent>
              </Card>

              {/* Ranking */}
              {totalMembers > 0 && rankPosition > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      Ranking na Equipe
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                        <span className="text-lg font-extrabold">
                          {rankPosition === 1 ? "🥇" : rankPosition === 2 ? "🥈" : rankPosition === 3 ? "🥉" : `${rankPosition}º`}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{rankPosition}º de {totalMembers}</p>
                        <p className="text-xs text-muted-foreground">
                          {rankPosition === 1 ? "🔥 Líder!" : `${sortedMembers[0]?.score - member.score} pts do 1º`}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      {sortedMembers.slice(0, 5).map((m, i) => (
                        <div key={m.id} className={`flex items-center gap-2 py-1 px-2 rounded text-xs ${m.id === member.id ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}>
                          <span className="w-5 text-center font-bold text-muted-foreground">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                          </span>
                          <span className={`flex-1 truncate ${m.id === member.id ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{m.nome}</span>
                          <span className="text-muted-foreground">{m.score}pts</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>

          {/* Right column - Tasks */}
          <div className="flex-1 flex flex-col overflow-hidden bg-muted/5">
            <div className="px-6 pt-5 pb-3 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Tarefas Atribuídas
                  <Badge variant="secondary" className="text-xs ml-1">{tarefas.length}</Badge>
                </h3>
              </div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList className="h-8">
                  <TabsTrigger value="todas" className="text-xs px-3 h-7">Todas</TabsTrigger>
                  <TabsTrigger value="pendentes" className="text-xs px-3 h-7">Pendentes</TabsTrigger>
                  <TabsTrigger value="concluidas" className="text-xs px-3 h-7">Concluídas</TabsTrigger>
                  <TabsTrigger value="atrasadas" className="text-xs px-3 h-7">Atrasadas</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1 px-6 pb-6">
              {loadingTarefas ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Carregando tarefas...
                </div>
              ) : filteredTarefas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhuma tarefa encontrada neste filtro
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTarefas.map((tarefa: any) => {
                    const statusInfo = STATUS_LABELS[tarefa.status] || STATUS_LABELS.pendente;
                    const prioridadeInfo = PRIORITY_LABELS[tarefa.prioridade] || null;
                    const projetoNome = tarefa.projetos?.nome || "—";

                    return (
                      <Card key={tarefa.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm text-foreground truncate">{tarefa.titulo}</span>
                                {tarefa.codigo && (
                                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{tarefa.codigo}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <FolderKanban className="h-3 w-3" />
                                  {projetoNome}
                                </span>
                                {tarefa.data_prazo && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(parseISO(tarefa.data_prazo), "dd MMM yyyy", { locale: ptBR })}
                                  </span>
                                )}
                                {prioridadeInfo && (
                                  <span className={`flex items-center gap-1 ${prioridadeInfo.className}`}>
                                    <Flag className="h-3 w-3" />
                                    {prioridadeInfo.label}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <TarefaRiskBadge status={tarefa.status} dataPrazo={tarefa.data_prazo} />
                              <Badge className={`text-[10px] px-2 py-0.5 border-0 ${statusInfo.className}`}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Page ---
export default function ProjetosMinhaEquipe() {
  const { data: team = [], isLoading } = useProjetosTeamData();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<ProjetoTeamMember | null>(null);
  const navigate = useNavigate();
  const { isAdmin, isGerente, isSupervisor } = useUserRole();
  const canManage = isAdmin || isGerente || isSupervisor;

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const flattenMembers = (members: ProjetoTeamMember[]): ProjetoTeamMember[] => {
    const result: ProjetoTeamMember[] = [];
    const traverse = (list: ProjetoTeamMember[]) => {
      list.forEach((m) => {
        result.push(m);
        if (m.subordinados) traverse(m.subordinados);
      });
    };
    traverse(members);
    return result;
  };

  const allMembers = flattenMembers(team);
  const topPerformers = [...allMembers].sort((a, b) => b.score - a.score).slice(0, 5);
  const totalTarefas = allMembers.reduce((s, m) => s + m.tarefas_atribuidas, 0);
  const totalConcluidas = allMembers.reduce((s, m) => s + m.tarefas_concluidas, 0);
  const totalAtrasadas = allMembers.reduce((s, m) => s + m.tarefas_atrasadas, 0);

  const handleMemberClick = (member: ProjetoTeamMember) => {
    if (canManage) {
      setSelectedMember(member);
    }
  };

  const renderMember = (member: ProjetoTeamMember, level = 0) => {
    const hasSubs = member.subordinados && member.subordinados.length > 0;
    const isExpanded = expandedNodes.has(member.id);
    const roleStyle = getRoleStyle(member.role);

    return (
      <div key={member.id}>
        <div
          className={`flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors border border-transparent hover:border-border ${canManage ? "cursor-pointer" : ""}`}
          style={{ marginLeft: `${level * 1.5}rem` }}
          onClick={() => handleMemberClick(member)}
        >
          {hasSubs ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => { e.stopPropagation(); toggleNode(member.id); }}
            >
              <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </Button>
          ) : (
            <div className="w-6" />
          )}

          <AvatarWithUpload member={member} size="md" canUpload={canManage} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{member.nome}</span>
              <Badge variant="outline" className={`text-xs font-semibold ${roleStyle.className}`}>
                {roleStyle.label}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground truncate block">{member.email}</span>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" />
              <span>{member.projetos_ativos}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span>{member.tarefas_concluidas}/{member.tarefas_atribuidas}</span>
            </div>
            {member.tarefas_atrasadas > 0 && (
              <div className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{member.tarefas_atrasadas}</span>
              </div>
            )}
            <div className="w-16">
              <Progress value={member.taxa_conclusao} className="h-1.5" />
            </div>
            <span className="text-muted-foreground w-8 text-right">{member.taxa_conclusao}%</span>
          </div>
        </div>

        {hasSubs && isExpanded && member.subordinados!.map((sub) => renderMember(sub, level + 1))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Minha Equipe — Projetos</h1>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Carregando equipe...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/projetos")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
          <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Minha Equipe — Projetos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe a produtividade da equipe em projetos e tarefas</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-500" />
            <div>
              <p className="text-2xl font-bold">{allMembers.length}</p>
              <p className="text-xs text-muted-foreground">Membros</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{totalTarefas}</p>
              <p className="text-xs text-muted-foreground">Tarefas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{totalConcluidas}</p>
              <p className="text-xs text-muted-foreground">Concluídas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{totalAtrasadas}</p>
              <p className="text-xs text-muted-foreground">Atrasadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Hierarchy */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Hierarquia da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
            {team.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum membro encontrado</p>
            ) : (
              team.map((m) => renderMember(m))
            )}
          </CardContent>
        </Card>

        {/* Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Ranking de Produtividade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPerformers.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${canManage ? "cursor-pointer hover:bg-accent/50" : ""}`}
                onClick={() => handleMemberClick(m)}
              >
                <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                </span>
                <AvatarWithUpload member={m} size="sm" canUpload={canManage} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{m.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.tarefas_concluidas} concluídas · {m.projetos_ativos} projetos
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">{m.score} pts</Badge>
              </div>
            ))}
            {topPerformers.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-4">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Member Detail Modal */}
      <MemberDetailModal
        member={selectedMember}
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        canUpload={canManage}
        allMembers={allMembers}
      />
    </div>
  );
}

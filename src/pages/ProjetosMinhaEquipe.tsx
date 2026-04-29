import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Users, ChevronRight, FolderKanban, CheckCircle2, AlertTriangle, ClipboardList, Trophy, ArrowLeft, Camera, Loader2, Target, TrendingUp, Mail, X, BarChart3, Award, Minimize2, Calendar, Flag, Search, FileText } from "lucide-react";
import { useProjetosTeamData, ProjetoTeamMember } from "@/hooks/useProjetosTeamData";
import { useNavigate } from "react-router-dom";
import { ProjetoBackButton } from "@/components/projetos/ProjetoBackButton";
import { useQuery } from "@tanstack/react-query";
import { TarefaRiskBadge } from "@/components/projetos/TarefaRiskBadge";
import { format, parseISO, startOfMonth, endOfMonth, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useUserRole } from "@/hooks/useUserRole";
import { useResolvedAvatarUrl } from "@/hooks/useResolvedAvatarUrl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useQueryClient } from "@tanstack/react-query";
import { TourButton, projetosEquipeTourSteps, PROJETOS_EQUIPE_TOUR_ID } from "@/components/tour";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { getBgPaletteVars } from "@/lib/colorUtils";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { ImpersonationSelector } from "@/components/admin/ImpersonationSelector";
import { useIsGerenteGeralProjetos } from "@/hooks/useIsGerenteGeralProjetos";
import { useAuth } from "@/contexts/AuthContext";

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

const DEPT_PROJETOS_ID = "9937b2ff-bb1d-4f92-9d8b-4b3c0c7ad130";
const DEPT_COMPRAS_ID = "c2bafe92-2e57-4146-86bb-aca33d8fc02e";

const getDepartamentoBadge = (
  member: { role: string; supervisor_id: string | null; departamento_id: string | null }
): { label: string; className: string } | null => {
  if (member.departamento_id === DEPT_COMPRAS_ID) {
    const isCoordenador = member.supervisor_id == null;
    return {
      label: isCoordenador ? "Coordenador de Compras" : "Compras",
      className:
        "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
    };
  }
  if (member.departamento_id === DEPT_PROJETOS_ID) {
    return {
      label: "Projetos",
      className:
        "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
    };
  }
  return null;
};

const STATUS_PROGRESS: Record<string, number> = {
  pendente: 0,
  em_andamento: 50,
  em_revisao: 75,
  concluida: 100,
  bloqueada: 0,
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
      logger.error("ProjetosMinhaEquipe: erro ao enviar foto", err as Error);
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

// --- Project Filter Select ---
function ProjetoFilterSelect({
  projetos,
  value,
  onChange,
  className = "",
}: {
  projetos: { id: string; nome: string }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 text-xs w-[220px] ${className}`}>
        <FolderKanban className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Todos os projetos" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos os projetos</SelectItem>
        {projetos.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// --- Member Detail Modal (Focus Mode style) ---
function MemberDetailModal({
  member,
  open,
  onClose,
  canUpload,
  allMembers = [],
  projetos = [],
}: {
  member: ProjetoTeamMember | null;
  open: boolean;
  onClose: () => void;
  canUpload: boolean;
  allMembers?: ProjetoTeamMember[];
  projetos?: { id: string; nome: string }[];
}) {
  const [statusFilter, setStatusFilter] = useState("todas");
  const [projetoFilter, setProjetoFilter] = useState("todos");
  const [search, setSearch] = useState("");

  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["member-tarefas", member?.id],
    queryFn: async () => {
      if (!member) return [];
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, codigo, status, prioridade, data_prazo, data_conclusao, created_at, projeto_id, produto_id, projetos:projeto_id(nome)")
        .eq("responsavel_id", member.id)
        .order("data_prazo", { ascending: true, nullsFirst: false });
      if (error) throw error;
      const rows = data || [];

      // Batch-fetch numero_processo for tarefas with produto_id
      const produtoIds = [...new Set(rows.map((t: any) => t.produto_id).filter(Boolean))];
      const processoMap: Record<string, string> = {};
      if (produtoIds.length > 0) {
        const { data: processos } = await (supabase
          .from("product_process" as any)
          .select("produto_ref_id, numero_processo, created_at")
          .in("produto_ref_id", produtoIds)
          .order("created_at", { ascending: false }) as any);
        if (processos) {
          for (const p of processos as any[]) {
            if (!processoMap[p.produto_ref_id] && p.numero_processo) {
              processoMap[p.produto_ref_id] = p.numero_processo;
            }
          }
        }
      }

      return rows.map((t: any) => ({
        ...t,
        numero_processo: t.produto_id ? (processoMap[t.produto_id] || null) : null,
      }));
    },
    enabled: !!member && open,
  });

  // Filter tasks by project
  const tarefasByProjeto = useMemo(() => {
    if (projetoFilter === "todos") return tarefas;
    return tarefas.filter((t: any) => t.projeto_id === projetoFilter);
  }, [tarefas, projetoFilter]);

  // Build weekly chart data for current month (filtered by project)
  const chartData = useMemo(() => {
    if (!tarefasByProjeto.length) return [];
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });

    return weeks.map((weekStart, i) => {
      const wStart = i === 0 ? monthStart : weekStart;
      const wEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const clampedEnd = wEnd > monthEnd ? monthEnd : wEnd;
      const interval = { start: wStart, end: clampedEnd };

      let concluidas = 0;
      let criadas = 0;
      let vencendo = 0;

      tarefasByProjeto.forEach((t: any) => {
        if (t.data_conclusao && isWithinInterval(parseISO(t.data_conclusao), interval)) concluidas++;
        if (t.created_at && isWithinInterval(parseISO(t.created_at), interval)) criadas++;
        if (t.data_prazo && isWithinInterval(parseISO(t.data_prazo), interval)) vencendo++;
      });

      return {
        semana: `Sem ${i + 1}`,
        periodo: `${format(wStart, "dd/MM")} - ${format(clampedEnd, "dd/MM")}`,
        Concluídas: concluidas,
        Criadas: criadas,
        Vencimento: vencendo,
      };
    });
  }, [tarefasByProjeto]);

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
  const normalizedSearch = search.trim().toLowerCase();
  const filteredTarefas = tarefasByProjeto.filter((t: any) => {
    if (statusFilter === "pendentes" && t.status === "concluida") return false;
    if (statusFilter === "concluidas" && t.status !== "concluida") return false;
    if (statusFilter === "atrasadas" && !(t.status !== "concluida" && t.data_prazo && t.data_prazo < today)) return false;
    if (normalizedSearch) {
      const haystack = [t.titulo, t.codigo, t.numero_processo]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(normalizedSearch)) return false;
    }
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
              {(() => {
                const dept = getDepartamentoBadge(member);
                return dept ? (
                  <Badge variant="outline" className={`text-xs font-semibold ${dept.className}`}>
                    {dept.label}
                  </Badge>
                ) : null;
              })()}
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

              {/* Evolução Mensal - Bar Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Evolução no Mês — {format(new Date(), "MMMM yyyy", { locale: ptBR })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartData} barSize={14} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="semana" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={28} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          labelFormatter={(label, payload) => {
                            const item = payload?.[0]?.payload;
                            return item?.periodo || label;
                          }}
                        />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: "11px" }} />
                        <Bar dataKey="Criadas" fill="hsl(217, 91%, 60%)" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Concluídas" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Vencimento" fill="hsl(38, 92%, 50%)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

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
                  <Badge variant="secondary" className="text-xs ml-1">{filteredTarefas.length}</Badge>
                </h3>
                <ProjetoFilterSelect
                  projetos={projetos}
                  value={projetoFilter}
                  onChange={setProjetoFilter}
                />
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por número do processo, código ou título..."
                  className="h-8 pl-8 pr-8 text-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
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
                  {normalizedSearch
                    ? `Nenhuma tarefa encontrada para "${search.trim()}"`
                    : "Nenhuma tarefa encontrada neste filtro"}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTarefas.map((tarefa: any) => {
                    const statusInfo = STATUS_LABELS[tarefa.status] || STATUS_LABELS.pendente;
                    const prioridadeInfo = PRIORITY_LABELS[tarefa.prioridade] || null;
                    const projetoNome = tarefa.projetos?.nome || "—";
                    const progressValue = STATUS_PROGRESS[tarefa.status] ?? 0;

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
                                {tarefa.numero_processo && (
                                  <span className="text-[10px] font-mono inline-flex items-center gap-1 text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded" title="Número do processo">
                                    <FileText className="h-2.5 w-2.5" />
                                    {tarefa.numero_processo}
                                  </span>
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
                          {/* Progress bar */}
                          <div className="flex items-center gap-2 mt-2.5">
                            <Progress
                              value={progressValue}
                              className={`h-1.5 flex-1 ${progressValue === 100 ? "[&>div]:bg-green-500" : ""}`}
                            />
                            <span className={`text-[10px] font-medium w-7 text-right ${progressValue === 100 ? "text-green-500" : "text-muted-foreground"}`}>
                              {progressValue}%
                            </span>
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
  const [projetoFilter, setProjetoFilter] = useState("todos");
  const [equipeFilter, setEquipeFilter] = useState<string>("todas"); // id do gerente ou "todas"
  const navigate = useNavigate();
  const { isAdmin, isGerente, isSupervisor } = useUserRole();
  const { hasFullView } = useIsGerenteGeralProjetos();
  const { user } = useAuth();
  const canManage = isAdmin || isGerente || isSupervisor;
  const canOpenMember = (m: ProjetoTeamMember) => canManage || m.id === user?.id;
  const canUploadFor = (m: ProjetoTeamMember) => canManage || m.id === user?.id;
  const { bgColor, setBgColor } = usePageBgColor("projetos_equipe");

  // Fetch projetos list
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos-list-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch projeto_membros for filtering
  const { data: projetoMembros = [] } = useQuery({
    queryKey: ["projeto-membros-filter", projetoFilter],
    queryFn: async () => {
      if (projetoFilter === "todos") return [];
      const { data, error } = await supabase
        .from("projeto_membros")
        .select("user_id")
        .eq("projeto_id", projetoFilter);
      if (error) throw error;
      return data?.map((d) => d.user_id) || [];
    },
    enabled: projetoFilter !== "todos",
  });

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

  const allMembersRaw = flattenMembers(team);

  // Filter members by project participation
  const allMembers = useMemo(() => {
    if (projetoFilter === "todos") return allMembersRaw;
    return allMembersRaw.filter((m) => projetoMembros.includes(m.id));
  }, [allMembersRaw, projetoFilter, projetoMembros]);

  // Filter hierarchy tree for display (projeto)
  const projetoFilteredTeam = useMemo(() => {
    if (projetoFilter === "todos") return team;
    const memberIds = new Set(projetoMembros);
    const filterTree = (members: ProjetoTeamMember[]): ProjetoTeamMember[] => {
      return members.reduce<ProjetoTeamMember[]>((acc, m) => {
        const filteredSubs = m.subordinados ? filterTree(m.subordinados) : [];
        if (memberIds.has(m.id) || filteredSubs.length > 0) {
          acc.push({ ...m, subordinados: filteredSubs });
        }
        return acc;
      }, []);
    };
    return filterTree(team);
  }, [team, projetoFilter, projetoMembros]);

  // Lista de gerentes disponíveis para o seletor (admin/gerente geral)
  const gerentesDisponiveis = useMemo(() => {
    return allMembersRaw
      .filter((m) => m.role === "gerente" || m.role === "supervisor")
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allMembersRaw]);

  // Filtra a árvore para a sub-hierarquia do gerente escolhido
  const filteredTeam = useMemo(() => {
    if (!hasFullView || equipeFilter === "todas") return projetoFilteredTeam;
    const findNode = (members: ProjetoTeamMember[]): ProjetoTeamMember | null => {
      for (const m of members) {
        if (m.id === equipeFilter) return m;
        if (m.subordinados) {
          const found = findNode(m.subordinados);
          if (found) return found;
        }
      }
      return null;
    };
    const node = findNode(projetoFilteredTeam);
    return node ? [node] : [];
  }, [projetoFilteredTeam, equipeFilter, hasFullView]);

  // Membros visíveis no escopo atual (para KPIs e ranking)
  const visibleMembers = useMemo(() => flattenMembers(filteredTeam), [filteredTeam]);

  const topPerformers = [...visibleMembers].sort((a, b) => b.score - a.score).slice(0, 5);
  const totalTarefas = visibleMembers.reduce((s, m) => s + m.tarefas_atribuidas, 0);
  const totalConcluidas = visibleMembers.reduce((s, m) => s + m.tarefas_concluidas, 0);
  const totalAtrasadas = visibleMembers.reduce((s, m) => s + m.tarefas_atrasadas, 0);

  // Subtítulo contextual
  const escopoLabel = useMemo(() => {
    if (hasFullView && equipeFilter !== "todas") {
      const g = gerentesDisponiveis.find((m) => m.id === equipeFilter);
      return g ? `Equipe de ${g.nome}` : "Equipe selecionada";
    }
    if (hasFullView) return "Visão completa — Departamento de Projetos";
    return "Sua equipe";
  }, [hasFullView, equipeFilter, gerentesDisponiveis]);

  const handleMemberClick = (member: ProjetoTeamMember) => {
    if (canOpenMember(member)) {
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
          className={`flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors border border-transparent hover:border-border ${canOpenMember(member) ? "cursor-pointer" : ""}`}
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

          <AvatarWithUpload member={member} size="md" canUpload={canUploadFor(member)} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{member.nome}</span>
              <Badge variant="outline" className={`text-xs font-semibold ${roleStyle.className}`}>
                {roleStyle.label}
              </Badge>
              {(() => {
                const dept = getDepartamentoBadge(member);
                return dept ? (
                  <Badge variant="outline" className={`text-xs font-semibold ${dept.className}`}>
                    {dept.label}
                  </Badge>
                ) : null;
              })()}
              {member.equipes?.map((eq) => (
                <Badge key={eq.id} className="text-xs" style={{ backgroundColor: eq.cor, color: '#fff' }}>
                  {eq.nome}
                </Badge>
              ))}
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
    <div
      className="p-4 md:p-6 space-y-6 w-full"
      style={
        bgColor
          ? ({
              backgroundColor: bgColor,
              minHeight: "100vh",
              color: "hsl(var(--foreground))",
              ...getBgPaletteVars(bgColor),
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProjetoBackButton label="Voltar" className="shrink-0" />
          <ProjetoBgColorPicker value={bgColor} onChange={setBgColor} />
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Minha Equipe — Projetos</h1>
            <p className="text-sm text-muted-foreground">{escopoLabel}</p>
          </div>
        </div>
        <ImpersonationSelector />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-500" />
            <div>
              <p className="text-2xl font-bold">{visibleMembers.length}</p>
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

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap" data-tour="equipe-filters">
        {hasFullView && gerentesDisponiveis.length > 0 && (
          <Select value={equipeFilter} onValueChange={setEquipeFilter}>
            <SelectTrigger className="h-8 text-xs w-[260px]">
              <Users className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Equipe completa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Equipe completa (todas)</SelectItem>
              {gerentesDisponiveis.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  Equipe de {g.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <ProjetoFilterSelect
          projetos={projetos}
          value={projetoFilter}
          onChange={setProjetoFilter}
        />
        {projetoFilter !== "todos" && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => setProjetoFilter("todos")}>
            <X className="h-3.5 w-3.5" />
            Limpar projeto
          </Button>
        )}
        {hasFullView && equipeFilter !== "todas" && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => setEquipeFilter("todas")}>
            <X className="h-3.5 w-3.5" />
            Limpar equipe
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6" data-tour="equipe-cards">
        {/* Hierarchy */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Hierarquia da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
            {filteredTeam.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum membro encontrado</p>
            ) : (
              filteredTeam.map((m) => renderMember(m))
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
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${canOpenMember(m) ? "cursor-pointer hover:bg-accent/50" : ""}`}
                onClick={() => handleMemberClick(m)}
              >
                <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                </span>
                <AvatarWithUpload member={m} size="sm" canUpload={canUploadFor(m)} />
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
        canUpload={selectedMember ? canUploadFor(selectedMember) : false}
        allMembers={visibleMembers}
        projetos={projetos}
      />
      <TourButton tourId={PROJETOS_EQUIPE_TOUR_ID} tourSteps={projetosEquipeTourSteps} title="Manual da Equipe" description="Aprenda a acompanhar sua equipe passo a passo" />
    </div>
  );
}

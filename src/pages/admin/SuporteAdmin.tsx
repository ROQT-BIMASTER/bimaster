import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LifeBuoy, Search, AlertTriangle, Clock, CheckCircle2, MessageSquare, User, Wrench, FileText, Lightbulb, Flag, Send, TimerReset, ArrowLeft, BarChart3, Tag, Hash, Eye, Timer } from "lucide-react";
import { formatDistanceToNow, format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AnexoView } from "@/components/chat/v2/AnexoView";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";

type Status = "novo" | "em_triagem" | "em_atendimento" | "aguardando_usuario" | "escalado" | "resolvido";

interface Ticket {
  id: string;
  owner_id: string;
  conversa_id: string;
  status: Status;
  prioridade: string | null;
  categoria: string | null;
  titulo: string | null;
  resumo: string | null;
  projeto_tarefa_id: string | null;
  ultima_interacao_em: string | null;
  escalado_em: string | null;
  resolved_at: string | null;
  created_at: string;
  sla_horas: number | null;
  prazo_resposta_em: string | null;
  owner?: { nome: string | null; avatar_url: string | null } | null;
}

const CATEGORIA_LABEL: Record<string, string> = {
  bug: "Bug",
  duvida_uso: "Dúvida de uso",
  solicitacao_acesso: "Acesso",
  solicitacao_funcionalidade: "Nova feature",
  integracao: "Integração",
  financeiro: "Financeiro",
  performance: "Performance",
  dados_inconsistentes: "Dados",
  outro: "Outro",
};

const CHART_COLORS = ["hsl(var(--primary))", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#64748b"];


function slaInfo(t: { prazo_resposta_em: string | null; status: string }) {
  if (!t.prazo_resposta_em || t.status === "resolvido") return null;
  const prazo = new Date(t.prazo_resposta_em).getTime();
  const now = Date.now();
  const diffH = (prazo - now) / 3_600_000;
  if (diffH < 0) return { label: `Atrasado ${Math.ceil(-diffH)}h`, tone: "destructive" as const };
  if (diffH < 4) return { label: `${Math.ceil(diffH)}h restantes`, tone: "warning" as const };
  return { label: `${Math.ceil(diffH)}h restantes`, tone: "muted" as const };
}

const STATUS_LABEL: Record<Status, string> = {
  novo: "Novo",
  em_triagem: "Em triagem",
  em_atendimento: "Em atendimento",
  aguardando_usuario: "Aguardando usuário",
  escalado: "Escalado",
  resolvido: "Resolvido",
};

const STATUS_COLOR: Record<Status, string> = {
  novo: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  em_triagem: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  em_atendimento: "bg-primary/10 text-primary border-primary/30",
  aguardando_usuario: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  escalado: "bg-destructive/10 text-destructive border-destructive/30",
  resolvido: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

const PRIO_COLOR: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-blue-500/10 text-blue-700",
  alta: "bg-amber-500/10 text-amber-700",
  critica: "bg-destructive/10 text-destructive",
};

export default function SuporteAdmin() {
  const navigate = useNavigate();
  const { bgColor, setBgColor, darkBg } = usePageBgColor("suporte-admin");
  const [filtroStatus, setFiltroStatus] = useState<Status | "todos">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState<"7" | "14" | "30" | "90" | "todos">("30");
  const [busca, setBusca] = useState("");
  const [ticketSel, setTicketSel] = useState<Ticket | null>(null);
  const [aba, setAba] = useState<"tickets" | "graficos">("tickets");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["suporte-admin-tickets", filtroStatus],
    queryFn: async () => {
      let q = supabase
        .from("suporte_tickets" as any)
        .select("*")
        .order("ultima_interacao_em", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (filtroStatus !== "todos") q = q.eq("status", filtroStatus);
      const { data, error } = await q;
      if (error) throw error;

      const ownerIds = Array.from(new Set(((data ?? []) as any[]).map((t) => t.owner_id))).filter(Boolean);
      let ownersMap = new Map<string, { nome: string | null; avatar_url: string | null }>();
      if (ownerIds.length) {
        const { data: dir } = await supabase
          .from("chat_directory" as any)
          .select("id, nome, avatar_url")
          .in("id", ownerIds);
        ownersMap = new Map(((dir ?? []) as any[]).map((d) => [d.id, { nome: d.nome, avatar_url: d.avatar_url }]));
      }
      return ((data ?? []) as any[]).map((t) => ({ ...t, owner: ownersMap.get(t.owner_id) ?? null })) as Ticket[];
    },
    refetchInterval: 30_000,
  });

  const ticketsPeriodo = useMemo(() => {
    if (filtroPeriodo === "todos") return tickets;
    const dias = parseInt(filtroPeriodo, 10);
    const limite = subDays(new Date(), dias).getTime();
    return tickets.filter((t) => new Date(t.created_at).getTime() >= limite);
  }, [tickets, filtroPeriodo]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ticketsPeriodo.filter((t) => {
      if (filtroCategoria !== "todas" && (t.categoria ?? "outro") !== filtroCategoria) return false;
      if (!q) return true;
      return (
        (t.titulo ?? "").toLowerCase().includes(q) ||
        (t.resumo ?? "").toLowerCase().includes(q) ||
        (t.owner?.nome ?? "").toLowerCase().includes(q)
      );
    });
  }, [ticketsPeriodo, busca, filtroCategoria]);

  const kpis = useMemo(() => {
    const abertos = ticketsPeriodo.filter((t) => t.status !== "resolvido").length;
    const escalados = ticketsPeriodo.filter((t) => t.status === "escalado").length;
    const resolvidos = ticketsPeriodo.filter((t) => t.status === "resolvido").length;
    const criticos = ticketsPeriodo.filter((t) => t.prioridade === "critica" && t.status !== "resolvido").length;
    const atrasados = ticketsPeriodo.filter((t) => {
      const i = slaInfo(t as any);
      return i?.tone === "destructive";
    }).length;
    return { abertos, escalados, resolvidos, criticos, atrasados };
  }, [ticketsPeriodo]);

  const charts = useMemo(() => {
    const porCategoria = new Map<string, number>();
    const porStatus = new Map<string, number>();
    const porPrioridade = new Map<string, number>();
    ticketsPeriodo.forEach((t) => {
      const cat = t.categoria ?? "outro";
      porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + 1);
      porStatus.set(t.status, (porStatus.get(t.status) ?? 0) + 1);
      const p = t.prioridade ?? "media";
      porPrioridade.set(p, (porPrioridade.get(p) ?? 0) + 1);
    });

    const evolucao: { dia: string; abertos: number; resolvidos: number }[] = [];
    const hoje = startOfDay(new Date());
    const dias = filtroPeriodo === "todos" ? 30 : Math.min(parseInt(filtroPeriodo, 10), 60);
    for (let i = dias - 1; i >= 0; i--) {
      const d = subDays(hoje, i);
      const key = format(d, "dd/MM");
      const abertos = ticketsPeriodo.filter((t) => format(startOfDay(new Date(t.created_at)), "dd/MM") === key).length;
      const resolvidos = ticketsPeriodo.filter((t) => t.resolved_at && format(startOfDay(new Date(t.resolved_at)), "dd/MM") === key).length;
      evolucao.push({ dia: key, abertos, resolvidos });
    }

    return {
      categoria: Array.from(porCategoria.entries()).map(([k, v]) => ({ nome: CATEGORIA_LABEL[k] ?? k, value: v })),
      status: Array.from(porStatus.entries()).map(([k, v]) => ({ nome: STATUS_LABEL[k as Status] ?? k, value: v })),
      prioridade: Array.from(porPrioridade.entries()).map(([k, v]) => ({ nome: k, value: v })),
      evolucao,
    };
  }, [ticketsPeriodo, filtroPeriodo]);

  return (
    <div
      className="min-h-screen w-full p-4 md:p-6 transition-colors"
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className={cn("gap-1.5", darkBg && "text-white hover:bg-white/10")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="p-2 rounded-xl bg-primary/10">
          <LifeBuoy className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className={cn("text-2xl font-semibold", darkBg && "text-white")}>Central de Suporte</h1>
          <p className={cn("text-sm", darkBg ? "text-white/70" : "text-muted-foreground")}>
            Tickets do canal interno com monitoramento de SLA, tabulação automática e parecer da equipe de TI.
          </p>
        </div>
        <ProjetoBgColorPicker value={bgColor} onChange={setBgColor} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard icon={<MessageSquare className="h-4 w-4" />} label="Abertos" value={kpis.abertos} tone="primary" />
        <KpiCard icon={<TimerReset className="h-4 w-4" />} label="Atrasados (SLA)" value={kpis.atrasados} tone="destructive" />
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Críticos" value={kpis.criticos} tone="destructive" />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Escalados" value={kpis.escalados} tone="warning" />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Resolvidos" value={kpis.resolvidos} tone="success" />
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as any)}>
        <TabsList>
          <TabsTrigger value="tickets" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Tickets</TabsTrigger>
          <TabsTrigger value="graficos" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Gráficos</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base">Tickets ({filtrados.length})</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar título, resumo, usuário…"
                    className="pl-8 w-64 h-9"
                  />
                </div>
                <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
                  <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                  <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas categorias</SelectItem>
                    {Object.entries(CATEGORIA_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroPeriodo} onValueChange={(v) => setFiltroPeriodo(v as any)}>
                  <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7d</SelectItem>
                    <SelectItem value="14">Últimos 14d</SelectItem>
                    <SelectItem value="30">Últimos 30d</SelectItem>
                    <SelectItem value="90">Últimos 90d</SelectItem>
                    <SelectItem value="todos">Tudo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : filtrados.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Nenhum ticket no filtro atual.</div>
              ) : (
                <div className="divide-y divide-border">
                  {filtrados.map((t) => {
                    const sla = slaInfo(t);
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTicketSel(t)}
                        className="w-full flex items-center gap-3 py-3 px-2 hover:bg-muted/50 rounded-md text-left transition"
                      >
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-medium text-sm truncate">
                              {t.titulo ?? "Ticket sem título definido"}
                            </span>
                            <Badge variant="outline" className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                            {t.categoria && (
                              <Badge variant="outline" className="gap-1 bg-card">
                                <Tag className="h-3 w-3" /> {CATEGORIA_LABEL[t.categoria] ?? t.categoria}
                              </Badge>
                            )}
                            {t.prioridade && (
                              <Badge variant="secondary" className={PRIO_COLOR[t.prioridade] ?? ""}>{t.prioridade}</Badge>
                            )}
                            {sla && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1",
                                  sla.tone === "destructive" && "bg-destructive/10 text-destructive border-destructive/30",
                                  sla.tone === "warning" && "bg-amber-500/10 text-amber-700 border-amber-500/30",
                                  sla.tone === "muted" && "bg-muted text-muted-foreground",
                                )}
                              >
                                <TimerReset className="h-3 w-3" /> {sla.label}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {t.owner?.nome ?? "Usuário"} · {t.resumo ?? "Sem resumo"}
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(t.ultima_interacao_em ?? t.created_at), { addSuffix: true, locale: ptBR })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graficos" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Tickets por categoria</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={charts.categoria} dataKey="value" nameKey="nome" outerRadius={80} label>
                      {charts.categoria.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <RTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Tickets por status</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.status}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="nome" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <RTooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Por prioridade</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.prioridade}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="nome" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <RTooltip />
                    <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Evolução ({filtroPeriodo === "todos" ? "30 dias" : `${filtroPeriodo} dias`})</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={charts.evolucao}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="dia" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <RTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="abertos" stroke="hsl(var(--primary))" strokeWidth={2} name="Abertos" />
                    <Line type="monotone" dataKey="resolvidos" stroke="#10b981" strokeWidth={2} name="Resolvidos" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <TicketDrawer ticket={ticketSel} onClose={() => setTicketSel(null)} />
    </div>
  );
}


function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "primary" | "destructive" | "warning" | "success" }) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-amber-500/10 text-amber-700",
    success: "bg-emerald-500/10 text-emerald-700",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${toneClass}`}>{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TicketDrawer({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const { data: mensagens = [], isLoading } = useQuery({
    queryKey: ["suporte-ticket-msgs", ticket?.id],
    enabled: !!ticket,
    queryFn: async () => {
      if (!ticket) return [];
      const { data, error } = await supabase
        .from("mensagens")
        .select("id, conteudo, remetente_id, created_at, visibilidade")
        .eq("conversa_id", ticket.conversa_id)
        .or(`ticket_id.eq.${ticket.id},ticket_owner_id.eq.${ticket.owner_id}`)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      const msgs = data ?? [];
      const ids = msgs.map((m: any) => m.id);
      let anexosMap = new Map<string, any[]>();
      if (ids.length) {
        const { data: anexos } = await supabase
          .from("mensagens_anexos" as any)
          .select("*")
          .in("mensagem_id", ids);
        for (const a of (anexos ?? []) as any[]) {
          const arr = anexosMap.get(a.mensagem_id) ?? [];
          arr.push(a);
          anexosMap.set(a.mensagem_id, arr);
        }
      }
      return msgs.map((m: any) => ({ ...m, anexos: anexosMap.get(m.id) ?? [] }));
    },
  });

  const sla = ticket ? slaInfo(ticket) : null;

  return (
    <Sheet open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-primary" />
            {ticket?.titulo ?? "Ticket"}
          </SheetTitle>
        </SheetHeader>
        {ticket && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={STATUS_COLOR[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
              {ticket.prioridade && <Badge className={PRIO_COLOR[ticket.prioridade]}>{ticket.prioridade}</Badge>}
              <Badge variant="outline">Usuário: {ticket.owner?.nome ?? "—"}</Badge>
              {sla && (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1",
                    sla.tone === "destructive" && "bg-destructive/10 text-destructive border-destructive/30",
                    sla.tone === "warning" && "bg-amber-500/10 text-amber-700 border-amber-500/30",
                    sla.tone === "muted" && "bg-muted text-muted-foreground",
                  )}
                >
                  <TimerReset className="h-3 w-3" /> SLA: {sla.label}
                </Badge>
              )}
            </div>

            <UserProtocolPreview ticket={ticket} />

            {ticket.resumo && (
              <div className="text-sm bg-muted/40 rounded-md p-3 leading-relaxed">{ticket.resumo}</div>
            )}

            <Tabs defaultValue="conversa">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="conversa" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Conversa
                </TabsTrigger>
                <TabsTrigger value="ti" className="gap-1.5">
                  <Wrench className="h-3.5 w-3.5" /> Adm. TI
                </TabsTrigger>
              </TabsList>

              <TabsContent value="conversa" className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                    {mensagens.map((m: any) => {
                      const mine = m.remetente_id !== ticket.owner_id;
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "text-sm rounded-lg px-3 py-2",
                            mine ? "bg-primary/10 border border-primary/20" : "bg-muted/60",
                          )}
                        >
                          <div className="text-[10px] text-muted-foreground mb-1">
                            {mine ? "Equipe Ruby Rose" : "Usuário"} ·{" "}
                            {new Date(m.created_at).toLocaleString("pt-BR")}
                          </div>
                          {m.conteudo && <div className="whitespace-pre-wrap">{m.conteudo}</div>}
                          {m.anexos && m.anexos.length > 0 && (
                            <div className="mt-2 flex flex-col gap-2">
                              {m.anexos.map((a: any) => (
                                <AnexoView key={a.id} anexo={a} mine={mine} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {mensagens.length === 0 && (
                      <div className="text-xs text-muted-foreground py-4 text-center">Nenhuma mensagem ainda.</div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="ti" className="mt-3">
                <AdmTiPanel ticket={ticket} />
              </TabsContent>
            </Tabs>

            {ticket.projeto_tarefa_id && (
              <Button asChild variant="outline" className="w-full">
                <a href={`/dashboard/projetos/tarefa/${ticket.projeto_tarefa_id}`}>Abrir tarefa vinculada</a>
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

type AcaoTi = "orientacao" | "aceitar_solucao" | "parecer_tecnico" | "finalizar";

const ACAO_META: Record<AcaoTi, { label: string; icon: typeof Lightbulb; desc: string; sendsMessage: boolean; cta: string }> = {
  orientacao: {
    label: "Orientar usuário",
    icon: Lightbulb,
    desc: "Envia uma orientação direta ao usuário no chat de suporte. Use para tirar dúvida ou repassar workaround.",
    sendsMessage: true,
    cta: "Enviar orientação",
  },
  aceitar_solucao: {
    label: "Aceitar e criar solução",
    icon: Flag,
    desc: "Aceita o problema reportado, registra o plano de correção e move o ticket para Em atendimento. Não envia mensagem ao usuário.",
    sendsMessage: false,
    cta: "Aceitar problema",
  },
  parecer_tecnico: {
    label: "Parecer técnico",
    icon: FileText,
    desc: "Registra um parecer técnico interno (não visível ao usuário). Útil para diagnóstico, causa raiz ou justificativa.",
    sendsMessage: false,
    cta: "Salvar parecer",
  },
  finalizar: {
    label: "Finalizar atendimento",
    icon: CheckCircle2,
    desc: "Encerra o ticket. A Equipe Ruby Rose gera automaticamente uma mensagem de conclusão para o usuário com base no parecer.",
    sendsMessage: true,
    cta: "Finalizar e notificar",
  },
};

function AdmTiPanel({ ticket }: { ticket: Ticket }) {
  const qc = useQueryClient();
  const [acaoAberta, setAcaoAberta] = useState<AcaoTi | null>(null);
  const [titulo, setTitulo] = useState("");
  const [parecer, setParecer] = useState("");
  const [plano, setPlano] = useState("");
  const [prazo, setPrazo] = useState("");

  const { data: pareceres = [], isLoading } = useQuery({
    queryKey: ["suporte-pareceres-ti", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suporte_pareceres_ti" as any)
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (vars: { tipo: AcaoTi; titulo?: string; parecer: string; plano_correcao?: string; prazo_estimado?: string }) => {
      const { data, error } = await supabase.functions.invoke("suporte-ti-acao", { body: { ticket_id: ticket.id, ...vars } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error(typeof (data as any).error === "string" ? (data as any).error : "Falha na ação");
      return data;
    },
    onSuccess: () => {
      toast.success("Ação registrada");
      qc.invalidateQueries({ queryKey: ["suporte-pareceres-ti", ticket.id] });
      qc.invalidateQueries({ queryKey: ["suporte-ticket-msgs", ticket.id] });
      qc.invalidateQueries({ queryKey: ["suporte-admin-tickets"] });
      setAcaoAberta(null);
      setTitulo(""); setParecer(""); setPlano(""); setPrazo("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar ação"),
  });

  const submitar = () => {
    if (!acaoAberta) return;
    if (!parecer.trim() || parecer.trim().length < 3) {
      toast.error("Descreva o parecer (mínimo 3 caracteres).");
      return;
    }
    mutation.mutate({
      tipo: acaoAberta,
      titulo: titulo.trim() || undefined,
      parecer: parecer.trim(),
      plano_correcao: plano.trim() || undefined,
      prazo_estimado: prazo ? new Date(prazo).toISOString() : undefined,
    });
  };

  const acaoMeta = acaoAberta ? ACAO_META[acaoAberta] : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(ACAO_META) as AcaoTi[]).map((a) => {
          const meta = ACAO_META[a];
          const Icon = meta.icon;
          return (
            <Button
              key={a}
              variant="outline"
              className="h-auto py-3 flex flex-col items-start gap-1 text-left"
              onClick={() => { setAcaoAberta(a); setTitulo(""); setParecer(""); setPlano(""); setPrazo(""); }}
              disabled={ticket.status === "resolvido"}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-primary" /> {meta.label}
              </div>
              <span className="text-[11px] text-muted-foreground font-normal leading-snug whitespace-normal">
                {meta.desc}
              </span>
            </Button>
          );
        })}
      </div>

      <div>
        <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Histórico de pareceres</div>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : pareceres.length === 0 ? (
          <div className="text-xs text-muted-foreground py-3 text-center border rounded-md">
            Nenhum parecer registrado pela equipe de TI.
          </div>
        ) : (
          <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
            {(pareceres as any[]).map((p) => {
              const meta = ACAO_META[p.tipo as AcaoTi];
              const Icon = meta?.icon ?? FileText;
              return (
                <div key={p.id} className="text-sm border rounded-md p-3 bg-card">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">{meta?.label ?? p.tipo}</span>
                    <span>·</span>
                    <span>{new Date(p.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  {p.titulo && <div className="font-medium text-sm mb-1">{p.titulo}</div>}
                  <div className="text-sm whitespace-pre-wrap">{p.parecer}</div>
                  {p.plano_correcao && (
                    <div className="mt-2 text-xs">
                      <span className="font-medium text-muted-foreground">Plano de correção: </span>
                      <span className="whitespace-pre-wrap">{p.plano_correcao}</span>
                    </div>
                  )}
                  {p.prazo_estimado && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Prazo estimado: {new Date(p.prazo_estimado).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!acaoAberta} onOpenChange={(o) => !o && setAcaoAberta(null)}>
        <DialogContent className="max-w-lg">
          {acaoMeta && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <acaoMeta.icon className="h-4 w-4 text-primary" /> {acaoMeta.label}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{acaoMeta.desc}</p>
                <div>
                  <label className="text-xs font-medium">Título (opcional)</label>
                  <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Falha no botão Salvar" />
                </div>
                <div>
                  <label className="text-xs font-medium">
                    {acaoAberta === "orientacao" ? "Mensagem para o usuário" : "Parecer / Diagnóstico"}
                  </label>
                  <Textarea
                    value={parecer}
                    onChange={(e) => setParecer(e.target.value)}
                    rows={5}
                    placeholder={acaoAberta === "orientacao"
                      ? "Texto que será enviado ao usuário no chat de suporte."
                      : "Descreva a análise técnica, causa raiz, evidências…"}
                  />
                </div>
                {acaoAberta !== "orientacao" && (
                  <div>
                    <label className="text-xs font-medium">Plano de correção</label>
                    <Textarea
                      value={plano}
                      onChange={(e) => setPlano(e.target.value)}
                      rows={3}
                      placeholder="Passos previstos para resolver."
                    />
                  </div>
                )}
                {(acaoAberta === "aceitar_solucao" || acaoAberta === "parecer_tecnico") && (
                  <div>
                    <label className="text-xs font-medium">Prazo estimado de conclusão</label>
                    <Input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
                  </div>
                )}
                {acaoMeta.sendsMessage && (
                  <div className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                    {acaoAberta === "finalizar"
                      ? "Ao finalizar, a Equipe Ruby Rose enviará automaticamente uma mensagem de conclusão ao usuário."
                      : "Esta ação enviará a mensagem ao usuário no chat de suporte."}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setAcaoAberta(null)}>Cancelar</Button>
                <Button onClick={submitar} disabled={mutation.isPending} className="gap-2">
                  <Send className="h-4 w-4" /> {mutation.isPending ? "Salvando…" : acaoMeta.cta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatProto(ticketId: string, createdAt: string) {
  const d = new Date(createdAt);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `RR-${ymd}-${ticketId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function formatDur(ms: number) {
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor((abs % 86_400_000) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

function UserProtocolPreview({ ticket }: { ticket: Ticket }) {
  const protocolo = formatProto(ticket.id, ticket.created_at);
  const resolved = !!ticket.resolved_at || ticket.status === "resolvido";
  const target = ticket.prazo_resposta_em ? new Date(ticket.prazo_resposta_em) : null;
  const now = Date.now();
  const diffMs = target ? target.getTime() - now : 0;
  const atrasado = !resolved && target && diffMs < 0;
  const absH = Math.floor(Math.abs(diffMs) / 3_600_000);
  const absM = Math.floor((Math.abs(diffMs) % 3_600_000) / 60_000);
  const resolutionMs = resolved && ticket.resolved_at
    ? new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()
    : null;

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        <Eye className="h-3.5 w-3.5" />
        Visão do usuário — barra "Meus protocolos"
      </div>
      <div className="rounded-md border border-border bg-background px-2 py-1.5 text-[11px] flex items-center gap-2">
        <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="font-mono font-medium tracking-tight shrink-0">{protocolo}</span>
        <span className="truncate text-muted-foreground flex-1">
          {ticket.titulo ?? ticket.resumo ?? "—"}
        </span>
        {resolved ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="h-3 w-3" /> Resolvido
            {resolutionMs !== null && (
              <span className="inline-flex items-center gap-1 ml-1 opacity-80">
                <Timer className="h-3 w-3" /> em {formatDur(resolutionMs)}
              </span>
            )}
          </span>
        ) : target ? (
          <span className={cn(
            "inline-flex items-center gap-1 shrink-0 tabular-nums",
            atrasado ? "text-red-600 dark:text-red-400" : "text-foreground",
          )}>
            {atrasado ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {atrasado
              ? `Atrasado ${absH}h${String(absM).padStart(2, "0")}`
              : `${absH}h${String(absM).padStart(2, "0")}`}
          </span>
        ) : (
          <span className="text-muted-foreground shrink-0">Sem prazo</span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground">
        Exatamente como aparece em <span className="font-mono">/dashboard/chat</span> na barra acima do chat do usuário.
      </div>
    </div>
  );
}


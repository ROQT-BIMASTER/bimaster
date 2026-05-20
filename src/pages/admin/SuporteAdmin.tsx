import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { LifeBuoy, Search, AlertTriangle, Clock, CheckCircle2, MessageSquare, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Status = "novo" | "em_triagem" | "em_atendimento" | "aguardando_usuario" | "escalado" | "resolvido";

interface Ticket {
  id: string;
  owner_id: string;
  conversa_id: string;
  status: Status;
  prioridade: string | null;
  titulo: string | null;
  resumo: string | null;
  projeto_tarefa_id: string | null;
  ultima_interacao_em: string | null;
  escalado_em: string | null;
  resolved_at: string | null;
  created_at: string;
  owner?: { nome: string | null; avatar_url: string | null } | null;
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
  const [filtroStatus, setFiltroStatus] = useState<Status | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [ticketSel, setTicketSel] = useState<Ticket | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["suporte-admin-tickets", filtroStatus],
    queryFn: async () => {
      let q = supabase
        .from("suporte_tickets" as any)
        .select("*")
        .order("ultima_interacao_em", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);
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

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        (t.titulo ?? "").toLowerCase().includes(q) ||
        (t.resumo ?? "").toLowerCase().includes(q) ||
        (t.owner?.nome ?? "").toLowerCase().includes(q),
    );
  }, [tickets, busca]);

  const kpis = useMemo(() => {
    const abertos = tickets.filter((t) => t.status !== "resolvido").length;
    const escalados = tickets.filter((t) => t.status === "escalado").length;
    const resolvidos = tickets.filter((t) => t.status === "resolvido").length;
    const criticos = tickets.filter((t) => t.prioridade === "critica" && t.status !== "resolvido").length;
    return { abertos, escalados, resolvidos, criticos };
  }, [tickets]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-primary/10">
          <LifeBuoy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Central de Suporte</h1>
          <p className="text-sm text-muted-foreground">Tickets gerados pela equipe Ruby Rose no canal interno.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={<MessageSquare className="h-4 w-4" />} label="Abertos" value={kpis.abertos} tone="primary" />
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Críticos" value={kpis.criticos} tone="destructive" />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Escalados" value={kpis.escalados} tone="warning" />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Resolvidos" value={kpis.resolvidos} tone="success" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-base">Tickets</CardTitle>
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
              {filtrados.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTicketSel(t)}
                  className="w-full flex items-center gap-3 py-3 px-2 hover:bg-muted/50 rounded-md text-left transition"
                >
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm truncate">
                        {t.titulo ?? "Ticket sem título definido"}
                      </span>
                      <Badge variant="outline" className={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                      {t.prioridade && (
                        <Badge variant="secondary" className={PRIO_COLOR[t.prioridade] ?? ""}>{t.prioridade}</Badge>
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
      return data ?? [];
    },
  });

  return (
    <Sheet open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
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
            </div>

            {ticket.resumo && (
              <div className="text-sm bg-muted/40 rounded-md p-3 leading-relaxed">{ticket.resumo}</div>
            )}

            <div>
              <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Conversa</div>
              {isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {mensagens.map((m: any) => (
                    <div
                      key={m.id}
                      className={`text-sm rounded-lg px-3 py-2 ${
                        m.remetente_id === ticket.owner_id
                          ? "bg-muted/60"
                          : "bg-primary/10 border border-primary/20"
                      }`}
                    >
                      <div className="text-[10px] text-muted-foreground mb-1">
                        {m.remetente_id === ticket.owner_id ? "Usuário" : "Equipe Ruby Rose"} ·{" "}
                        {new Date(m.created_at).toLocaleString("pt-BR")}
                      </div>
                      <div className="whitespace-pre-wrap">{m.conteudo}</div>
                    </div>
                  ))}
                  {mensagens.length === 0 && (
                    <div className="text-xs text-muted-foreground py-4 text-center">Nenhuma mensagem ainda.</div>
                  )}
                </div>
              )}
            </div>

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

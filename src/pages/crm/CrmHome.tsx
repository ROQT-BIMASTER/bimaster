import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useAuth } from "@/contexts/AuthContext";
import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { CrmStatusBadge } from "@/components/crm/CrmStatusBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Inbox, Ticket, Users, AlertTriangle, MessageCircle, Activity, ArrowRight } from "lucide-react";
import { relativeTime, channelIcon, initials } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

function Kpi({ icon: Icon, label, value, hint, tone = "default" }: { icon: typeof Inbox; label: string; value: string | number; hint?: string; tone?: "default" | "warn" | "danger" | "ok" }) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    danger: "bg-destructive/15 text-destructive",
    ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  }[tone];
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums text-foreground leading-tight">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </div>
    </Card>
  );
}

export default function CrmHome() {
  const { empresaSelecionada, empresaIds } = useEmpresaContext();
  const { user } = useAuth();
  const empresaId = empresaSelecionada?.id ?? empresaIds[0];

  const { data: kpis } = useQuery({
    queryKey: ["crm-home-kpis", empresaId],
    enabled: !!empresaId,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!empresaId) return null;
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const startIso = start.toISOString();
      const [conv, slaRisk, tickets, contatos] = await Promise.all([
        supabase.from("crm_conversas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).in("status", ["open", "assigned", "pending"]),
        supabase.from("crm_conversas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).lt("sla_due_at", new Date(Date.now() + 30 * 60 * 1000).toISOString()).in("status", ["open", "assigned", "pending"]),
        supabase.from("crm_tickets").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).in("status", ["open", "in_progress"]).in("prioridade", ["high", "urgent"]),
        supabase.from("crm_contatos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).gte("primeiro_contato_em", startIso),
      ]);
      return {
        conversasAbertas: conv.count ?? 0,
        slaRisk: slaRisk.count ?? 0,
        ticketsCriticos: tickets.count ?? 0,
        contatosNovosHoje: contatos.count ?? 0,
      };
    },
  });

  const { data: minhaCarga } = useQuery({
    queryKey: ["crm-home-minha-carga", empresaId, user?.id],
    enabled: !!empresaId && !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [conv, tic] = await Promise.all([
        supabase.from("crm_conversas")
          .select("id, canal, status, ultima_mensagem_em, sla_due_at, contato:crm_contatos(nome, telefone)")
          .eq("empresa_id", empresaId!).eq("operador_id", user!.id)
          .in("status", ["open", "assigned", "pending"])
          .order("ultima_mensagem_em", { ascending: false }).limit(8),
        supabase.from("crm_tickets")
          .select("id, numero, titulo, status, prioridade, sla_due_at")
          .eq("empresa_id", empresaId!).eq("operador_id", user!.id)
          .in("status", ["open", "in_progress"])
          .order("aberto_em", { ascending: false }).limit(8),
      ]);
      return { conversas: conv.data ?? [], tickets: tic.data ?? [] };
    },
  });

  return (
    <div className="min-h-full">
      <CrmPageHeader
        icon={Home}
        title="Visão geral"
        subtitle={empresaSelecionada?.nome ? `${empresaSelecionada.nome} · plataforma omnichannel` : "Plataforma omnichannel"}
      />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={Inbox} label="Conversas abertas" value={kpis?.conversasAbertas ?? "—"} hint="Aberta · Atribuída · Pendente" />
          <Kpi icon={AlertTriangle} label="SLA em risco" value={kpis?.slaRisk ?? "—"} hint="Vence em < 30 min" tone={kpis && kpis.slaRisk > 0 ? "warn" : "default"} />
          <Kpi icon={Ticket} label="Tickets críticos" value={kpis?.ticketsCriticos ?? "—"} hint="High + Urgent abertos" tone={kpis && kpis.ticketsCriticos > 0 ? "danger" : "default"} />
          <Kpi icon={Users} label="Contatos novos hoje" value={kpis?.contatosNovosHoje ?? "—"} tone="ok" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card className="p-0 overflow-hidden">
            <div className="px-3 py-2 border-b flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><MessageCircle className="h-3.5 w-3.5" /> Minhas conversas</div>
              <Link to="/dashboard/crm/inbox"><Button variant="ghost" size="sm" className="h-7 text-xs gap-1">Abrir Inbox <ArrowRight className="h-3 w-3" /></Button></Link>
            </div>
            <div className="divide-y">
              {(minhaCarga?.conversas ?? []).length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Nada atribuído a você</div>
              )}
              {minhaCarga?.conversas.map((c: any) => {
                const Icon = channelIcon(c.canal);
                return (
                  <Link key={c.id} to={`/dashboard/crm/inbox?conv=${c.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-xs">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-medium">{initials(c.contato?.nome ?? c.contato?.telefone)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{c.contato?.nome ?? c.contato?.telefone ?? "Contato"}</div>
                      <div className="text-muted-foreground text-[11px] flex items-center gap-1"><Icon className="h-3 w-3" />{c.canal} · {relativeTime(c.ultima_mensagem_em)}</div>
                    </div>
                    <CrmStatusBadge status={c.status} />
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-3 py-2 border-b flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground"><Activity className="h-3.5 w-3.5" /> Meus tickets</div>
              <Link to="/dashboard/crm/tickets"><Button variant="ghost" size="sm" className="h-7 text-xs gap-1">Abrir Tickets <ArrowRight className="h-3 w-3" /></Button></Link>
            </div>
            <div className="divide-y">
              {(minhaCarga?.tickets ?? []).length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Nada atribuído a você</div>
              )}
              {minhaCarga?.tickets.map((t: any) => (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-xs">
                  <div className="font-mono text-[11px] text-muted-foreground w-12">#{t.numero}</div>
                  <div className="flex-1 min-w-0 truncate text-foreground">{t.titulo}</div>
                  <CrmStatusBadge status={t.prioridade} />
                  <CrmStatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

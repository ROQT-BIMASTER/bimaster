import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { CrmPageHeader } from "@/components/crm/CrmPageHeader";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, Inbox, Ticket, Clock, Smile, Download } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums text-foreground leading-tight">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </div>
    </Card>
  );
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 142 71% 45%))", "hsl(var(--chart-3, 38 92% 50%))", "hsl(var(--chart-4, 271 81% 56%))", "hsl(var(--chart-5, 0 84% 60%))"];

export default function CrmAnalytics() {
  const { empresaSelecionada, empresaIds } = useEmpresaContext();
  const empresaId = empresaSelecionada?.id ?? empresaIds[0];
  const [periodo, setPeriodo] = useState("30");

  const sinceIso = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - Number(periodo)); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, [periodo]);

  const { data } = useQuery({
    queryKey: ["crm-analytics", empresaId, periodo],
    enabled: !!empresaId,
    queryFn: async () => {
      const [{ data: conv }, { data: tic }, abertas, contatosNovos] = await Promise.all([
        supabase.from("crm_conversas").select("canal, status, iniciada_em, ultima_mensagem_em, primeira_resposta_em, fechada_em").eq("empresa_id", empresaId!).gte("iniciada_em", sinceIso).limit(5000),
        supabase.from("crm_tickets").select("status, prioridade, aberto_em, resolvido_em, sla_due_at").eq("empresa_id", empresaId!).gte("aberto_em", sinceIso).limit(5000),
        supabase.from("crm_conversas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId!).in("status", ["open", "assigned", "pending"]),
        supabase.from("crm_contatos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId!).gte("primeiro_contato_em", sinceIso),
      ]);
      const conversas = conv ?? []; const tickets = tic ?? [];

      // Volume por dia
      const dias = new Map<string, number>();
      for (let i = Number(periodo) - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        dias.set(d.toISOString().slice(0, 10), 0);
      }
      conversas.forEach((c: any) => {
        const k = (c.iniciada_em as string).slice(0, 10);
        if (dias.has(k)) dias.set(k, (dias.get(k) ?? 0) + 1);
      });
      const volumeDia = Array.from(dias.entries()).map(([d, v]) => ({ d: d.slice(5), v }));

      // Por canal
      const canaisMap = new Map<string, number>();
      conversas.forEach((c: any) => canaisMap.set(c.canal, (canaisMap.get(c.canal) ?? 0) + 1));
      const porCanal = Array.from(canaisMap.entries()).map(([name, value]) => ({ name, value }));

      // TMR (tempo médio até primeira resposta)
      const tmrs = conversas
        .filter((c: any) => c.primeira_resposta_em && c.iniciada_em)
        .map((c: any) => (new Date(c.primeira_resposta_em).getTime() - new Date(c.iniciada_em).getTime()) / 60000);
      const tmr = tmrs.length ? tmrs.reduce((a, b) => a + b, 0) / tmrs.length : null;

      // TMA (tempo médio de atendimento até fechar)
      const tmas = conversas
        .filter((c: any) => c.fechada_em && c.iniciada_em)
        .map((c: any) => (new Date(c.fechada_em).getTime() - new Date(c.iniciada_em).getTime()) / 60000);
      const tma = tmas.length ? tmas.reduce((a, b) => a + b, 0) / tmas.length : null;

      // SLA cumprido nos tickets resolvidos
      const ticResolvidos = tickets.filter((t: any) => t.resolvido_em && t.sla_due_at);
      const slaOk = ticResolvidos.filter((t: any) => new Date(t.resolvido_em).getTime() <= new Date(t.sla_due_at).getTime()).length;
      const slaPct = ticResolvidos.length ? (slaOk / ticResolvidos.length) * 100 : null;

      // Por prioridade
      const prioMap = new Map<string, number>();
      tickets.forEach((t: any) => prioMap.set(t.prioridade, (prioMap.get(t.prioridade) ?? 0) + 1));
      const porPrio = Array.from(prioMap.entries()).map(([name, value]) => ({ name, value }));

      return {
        volumeDia, porCanal, tmr, tma, slaPct, porPrio,
        totalConversas: conversas.length, totalTickets: tickets.length,
        abertasNow: abertas.count ?? 0, novosContatos: contatosNovos.count ?? 0,
        ticketsResolvidos: tickets.filter((t: any) => t.status === "resolved" || t.status === "closed").length,
      };
    },
  });

  const exportCsv = () => {
    if (!data) return;
    const rows = [["dia", "conversas"], ...data.volumeDia.map(d => [d.d, String(d.v)])];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `crm-analytics-${periodo}d.csv`; a.click();
  };

  return (
    <div className="min-h-full flex flex-col">
      <CrmPageHeader
        icon={BarChart3}
        title="Analytics & BI"
        subtitle="Dashboards · TMA · TMR · SLA"
        actions={
          <>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Exportar</Button>
          </>
        }
      />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Kpi icon={Inbox} label="Conversas (período)" value={data?.totalConversas ?? "—"} />
          <Kpi icon={Inbox} label="Abertas agora" value={data?.abertasNow ?? "—"} />
          <Kpi icon={Clock} label="TMR (1ª resposta)" value={data?.tmr ? `${Math.round(data.tmr)}m` : "—"} />
          <Kpi icon={Clock} label="TMA (atendimento)" value={data?.tma ? `${Math.round(data.tma)}m` : "—"} />
          <Kpi icon={Smile} label="SLA cumprido" value={data?.slaPct !== null && data?.slaPct !== undefined ? `${Math.round(data.slaPct)}%` : "—"} />
          <Kpi icon={Ticket} label="Tickets resolvidos" value={data?.ticketsResolvidos ?? "—"} hint={`${data?.totalTickets ?? 0} no período`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="p-3 lg:col-span-2">
            <div className="text-xs font-semibold mb-2 text-foreground">Volume diário</div>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={data?.volumeDia ?? []}>
                  <defs>
                    <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="d" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                  <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" fill="url(#gv)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-3">
            <div className="text-xs font-semibold mb-2 text-foreground">Por canal</div>
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data?.porCanal ?? []} dataKey="value" nameKey="name" outerRadius={80} label={{ fontSize: 10 }}>
                    {(data?.porCanal ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-3 lg:col-span-3">
            <div className="text-xs font-semibold mb-2 text-foreground">Tickets por prioridade</div>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={data?.porPrio ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { format, startOfDay, subDays } from "date-fns";
import {
  SUPORTE_STATUS_LABEL,
  type SuporteChamado,
  type SuporteTicketStatus,
} from "@/hooks/suporte/types";

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

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#64748b",
];

export function SuporteCentralGraficos({
  tickets,
  periodoDias,
}: {
  tickets: SuporteChamado[];
  periodoDias: number;
}) {
  const data = useMemo(() => {
    const porCategoria = new Map<string, number>();
    const porStatus = new Map<string, number>();
    const porSla = new Map<string, number>();

    tickets.forEach((t) => {
      const cat = t.categoria ?? "outro";
      porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + 1);
      porStatus.set(t.status, (porStatus.get(t.status) ?? 0) + 1);
      const sla = t.status === "resolvido" ? "resolvido" : (t.sla_status ?? "no_prazo");
      porSla.set(sla, (porSla.get(sla) ?? 0) + 1);
    });

    const hoje = startOfDay(new Date());
    const dias = Math.min(Math.max(periodoDias, 7), 90);
    const evolucao: { dia: string; abertos: number }[] = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = subDays(hoje, i);
      const key = format(d, "dd/MM");
      const abertos = tickets.filter(
        (t) => format(startOfDay(new Date(t.created_at)), "dd/MM") === key,
      ).length;
      evolucao.push({ dia: key, abertos });
    }

    const slaLabel: Record<string, string> = {
      no_prazo: "No prazo",
      em_risco: "Em risco",
      violado: "Violado",
      resolvido: "Resolvido",
    };

    return {
      categoria: Array.from(porCategoria.entries()).map(([k, v]) => ({
        nome: CATEGORIA_LABEL[k] ?? k,
        value: v,
      })),
      status: Array.from(porStatus.entries()).map(([k, v]) => ({
        nome: SUPORTE_STATUS_LABEL[k as SuporteTicketStatus] ?? k,
        value: v,
      })),
      sla: Array.from(porSla.entries()).map(([k, v]) => ({
        nome: slaLabel[k] ?? k,
        value: v,
      })),
      evolucao,
    };
  }, [tickets, periodoDias]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tickets por status</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.status} dataKey="value" nameKey="nome" outerRadius={80} label>
                {data.status.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RTooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tickets por categoria</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.categoria}>
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
        <CardHeader>
          <CardTitle className="text-sm">Chamados abertos por dia</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.evolucao}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="dia" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <RTooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="abertos"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="Abertos"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SLA</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.sla}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="nome" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <RTooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.sla.map((d, i) => {
                  const color =
                    d.nome === "Violado"
                      ? "#ef4444"
                      : d.nome === "Em risco"
                      ? "#f59e0b"
                      : d.nome === "Resolvido"
                      ? "#10b981"
                      : "hsl(var(--primary))";
                  return <Cell key={i} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

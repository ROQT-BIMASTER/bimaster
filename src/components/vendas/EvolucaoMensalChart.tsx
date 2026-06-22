import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  data?: { mes: string; faturamento: number; notas: number }[];
  isLoading: boolean;
}

export function EvolucaoMensalChart({ data, isLoading }: Props) {
  const today = new Date();
  const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const rows = (data || []).map((d) => {
    const dt = parseLocalDate(d.mes);
    const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const isCurrent = ym === currentYM;
    return {
      ...d,
      label: format(dt, "MMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase()),
      isCurrent,
      valueLabel: d.faturamento >= 1_000_000 ? `R$ ${(d.faturamento / 1_000_000).toFixed(1).replace(".", ",")}` : d.faturamento >= 1000 ? `R$ ${(d.faturamento / 1000).toFixed(0)}K` : `R$ ${d.faturamento.toFixed(0)}`,
    };
  });

  const hasCurrent = rows.some((r) => r.isCurrent);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-1">
        <div className="text-base font-semibold text-foreground">Evolução mensal do faturamento</div>
        <div className="text-xs text-muted-foreground">R$ milhões</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : rows.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">Sem vendas no período</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rows} margin={{ top: 28, right: 16, left: 8, bottom: 8 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "hsl(var(--vendas-accent-softer))" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                  formatter={(value: number, name) => name === "faturamento" ? [formatCurrency(value), "Faturamento"] : [value.toLocaleString("pt-BR"), "Notas"]}
                />
                <Bar dataKey="faturamento" radius={[8, 8, 0, 0]} maxBarSize={64}>
                  {rows.map((r, i) => (
                    <Cell key={i} fill={r.isCurrent ? "hsl(var(--vendas-accent-soft))" : "hsl(var(--vendas-accent))"} />
                  ))}
                  <LabelList
                    dataKey="valueLabel"
                    position="top"
                    style={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {hasCurrent && (
              <div className="text-[11px] text-muted-foreground mt-2 text-right">
                * {format(today, "MMM", { locale: ptBR })} parcial (até dia {today.getDate()})
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

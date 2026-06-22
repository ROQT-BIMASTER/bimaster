import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { formatCurrency } from "@/lib/formatters";
import { TrendingUp } from "lucide-react";

interface Props {
  data?: { mes: string; faturamento: number; notas: number }[];
  isLoading: boolean;
}

export function EvolucaoMensalChart({ data, isLoading }: Props) {
  const rows = (data || []).map((d) => ({
    ...d,
    label: format(parseLocalDate(d.mes), "MMM/yy", { locale: ptBR }),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Evolução mensal
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-[280px] w-full" /> : rows.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">Sem vendas no período</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={rows} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                formatter={(value: number, name) => name === "faturamento" ? [formatCurrency(value), "Faturamento"] : [value.toLocaleString("pt-BR"), "Notas"]}
              />
              <Bar dataKey="faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

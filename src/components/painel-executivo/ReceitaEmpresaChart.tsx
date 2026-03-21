import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { Building2 } from "lucide-react";

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(199, 89%, 48%)",
  "hsl(326, 78%, 60%)",
  "hsl(45, 93%, 47%)",
];

interface Props {
  data: { nome_empresa: string; receita_total: number }[] | undefined;
  isLoading: boolean;
}

export function ReceitaEmpresaChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = (data || []).map((d) => ({
    ...d,
    nome_empresa: d.nome_empresa?.length > 20 ? d.nome_empresa.slice(0, 18) + "…" : d.nome_empresa,
    nome_full: d.nome_empresa,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4 text-violet-600" />
          Receita por Empresa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis type="category" dataKey="nome_empresa" tick={{ fontSize: 11 }} width={130} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), "Receita"]}
              contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
            />
            <Bar dataKey="receita_total" radius={[0, 4, 4, 0]} barSize={24}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

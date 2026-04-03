import { useMemo } from "react";
import { formatCurrencyCompact } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { chartColors } from "@/lib/chart-colors";
import { ChartTabs, type ChartTabItem } from "@/components/ui/chart-tabs";
import { BarChart3, PieChart as PieChartIcon, Layers } from "lucide-react";

interface MetasReducaoChartProps {
  revisoes: any[];
}

const STATUS_COLORS: Record<string, string> = {
  pendente: chartColors.warning,
  em_andamento: chartColors.accent,
  concluido: chartColors.success,
  cancelado: chartColors.destructive,
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
  color: 'hsl(var(--card-foreground))',
};

const axisTickStyle = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

export function MetasReducaoChart({ revisoes }: MetasReducaoChartProps) {
  const dadosPorTipo = useMemo(() => {
    const tipos = ['eliminar', 'reduzir', 'renegociar', 'monitorar'];
    return tipos.map(tipo => {
      const items = revisoes.filter(r => r.tipo_revisao === tipo);
      const meta = items.reduce((acc, r) => acc + (r.meta_reducao_valor || 0), 0);
      const realizado = items.filter(r => r.status === 'concluido').reduce((acc, r) => acc + (r.resultado_obtido || 0), 0);
      return { tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1), meta, realizado, quantidade: items.length };
    }).filter(d => d.quantidade > 0);
  }, [revisoes]);

  const dadosPorStatus = useMemo(() => {
    const statusMap: Record<string, { name: string; value: number; color: string }> = {
      pendente: { name: 'Pendente', value: 0, color: STATUS_COLORS.pendente },
      em_andamento: { name: 'Em Andamento', value: 0, color: STATUS_COLORS.em_andamento },
      concluido: { name: 'Concluído', value: 0, color: STATUS_COLORS.concluido },
      cancelado: { name: 'Cancelado', value: 0, color: STATUS_COLORS.cancelado },
    };
    revisoes.forEach(r => { if (statusMap[r.status]) statusMap[r.status].value++; });
    return Object.values(statusMap).filter(s => s.value > 0);
  }, [revisoes]);

  const dadosPorPrioridade = useMemo(() => {
    const prioridadeMap: Record<string, { name: string; meta: number; realizado: number }> = {
      alta: { name: 'Alta', meta: 0, realizado: 0 },
      media: { name: 'Média', meta: 0, realizado: 0 },
      baixa: { name: 'Baixa', meta: 0, realizado: 0 },
    };
    revisoes.forEach(r => {
      if (prioridadeMap[r.prioridade]) {
        prioridadeMap[r.prioridade].meta += r.meta_reducao_valor || 0;
        if (r.status === 'concluido') prioridadeMap[r.prioridade].realizado += r.resultado_obtido || 0;
      }
    });
    return Object.values(prioridadeMap).filter(p => p.meta > 0 || p.realizado > 0);
  }, [revisoes]);

  const formatCurrency = (value: number) => formatCurrencyCompact(value);

  if (revisoes.length === 0) return null;

  const tabs: ChartTabItem[] = [
    {
      key: "tipo",
      label: "Por Tipo de Ação",
      icon: <BarChart3 className="h-4 w-4" />,
      content: (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={dadosPorTipo} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradMeta" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.9} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="gradRealizado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.9} />
                <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="tipo" tick={axisTickStyle} />
            <YAxis tickFormatter={formatCurrency} tick={axisTickStyle} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="meta" name="Meta" fill="url(#gradMeta)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="realizado" name="Realizado" fill="url(#gradRealizado)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ),
    },
    {
      key: "status",
      label: "Por Status",
      icon: <PieChartIcon className="h-4 w-4" />,
      content: (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={dadosPorStatus}
              cx="50%"
              cy="45%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={true}
              style={{ fontSize: 11 }}
            >
              {dadosPorStatus.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      ),
    },
    ...(dadosPorPrioridade.length > 0
      ? [
          {
            key: "prioridade",
            label: "Por Prioridade",
            icon: <Layers className="h-4 w-4" />,
            content: (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dadosPorPrioridade} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradMetaH" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="gradRealizadoH" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={formatCurrency} tick={axisTickStyle} />
                  <YAxis type="category" dataKey="name" tick={axisTickStyle} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="meta" name="Meta" fill="url(#gradMetaH)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="realizado" name="Realizado" fill="url(#gradRealizadoH)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ),
          } as ChartTabItem,
        ]
      : []),
  ];

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Análise de Metas de Redução</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartTabs tabs={tabs} defaultTab="tipo" />
      </CardContent>
    </Card>
  );
}

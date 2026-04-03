import { useMemo } from "react";
import { formatCurrencyCompact } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface MetasReducaoChartProps {
  revisoes: any[];
}

const COLORS = {
  eliminar: '#ef4444',
  reduzir: '#f97316',
  renegociar: '#3b82f6',
  monitorar: '#a855f7',
};

const STATUS_COLORS = {
  pendente: '#eab308',
  em_andamento: '#3b82f6',
  concluido: '#22c55e',
  cancelado: '#6b7280',
};

export function MetasReducaoChart({ revisoes }: MetasReducaoChartProps) {
  // Dados por tipo de ação
  const dadosPorTipo = useMemo(() => {
    const tipos = ['eliminar', 'reduzir', 'renegociar', 'monitorar'];
    return tipos.map(tipo => {
      const items = revisoes.filter(r => r.tipo_revisao === tipo);
      const meta = items.reduce((acc, r) => acc + (r.meta_reducao_valor || 0), 0);
      const realizado = items.filter(r => r.status === 'concluido').reduce((acc, r) => acc + (r.resultado_obtido || 0), 0);
      return {
        tipo: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        meta,
        realizado,
        quantidade: items.length
      };
    }).filter(d => d.quantidade > 0);
  }, [revisoes]);

  // Dados por status
  const dadosPorStatus = useMemo(() => {
    const statusMap: Record<string, { name: string; value: number; color: string }> = {
      pendente: { name: 'Pendente', value: 0, color: STATUS_COLORS.pendente },
      em_andamento: { name: 'Em Andamento', value: 0, color: STATUS_COLORS.em_andamento },
      concluido: { name: 'Concluído', value: 0, color: STATUS_COLORS.concluido },
      cancelado: { name: 'Cancelado', value: 0, color: STATUS_COLORS.cancelado },
    };

    revisoes.forEach(r => {
      if (statusMap[r.status]) {
        statusMap[r.status].value++;
      }
    });

    return Object.values(statusMap).filter(s => s.value > 0);
  }, [revisoes]);

  // Dados por prioridade
  const dadosPorPrioridade = useMemo(() => {
    const prioridadeMap: Record<string, { name: string; meta: number; realizado: number }> = {
      alta: { name: 'Alta', meta: 0, realizado: 0 },
      media: { name: 'Média', meta: 0, realizado: 0 },
      baixa: { name: 'Baixa', meta: 0, realizado: 0 },
    };

    revisoes.forEach(r => {
      if (prioridadeMap[r.prioridade]) {
        prioridadeMap[r.prioridade].meta += r.meta_reducao_valor || 0;
        if (r.status === 'concluido') {
          prioridadeMap[r.prioridade].realizado += r.resultado_obtido || 0;
        }
      }
    });

    return Object.values(prioridadeMap).filter(p => p.meta > 0 || p.realizado > 0);
  }, [revisoes]);

  const formatCurrency = (value: number) => formatCurrencyCompact(value);

  if (revisoes.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Gráfico de Barras - Meta vs Realizado por Tipo */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Meta vs Realizado por Tipo de Ação</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dadosPorTipo} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="tipo" className="text-xs" />
              <YAxis tickFormatter={formatCurrency} className="text-xs" />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="meta" name="Meta" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="realizado" name="Realizado" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Pizza - Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={dadosPorStatus}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
                labelLine={false}
              >
                {dadosPorStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Barras - Por Prioridade */}
      {dadosPorPrioridade.length > 0 && (
        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Meta vs Realizado por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dadosPorPrioridade} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickFormatter={formatCurrency} className="text-xs" />
                <YAxis type="category" dataKey="name" className="text-xs" />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="meta" name="Meta" fill="#f97316" radius={[0, 4, 4, 0]} />
                <Bar dataKey="realizado" name="Realizado" fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

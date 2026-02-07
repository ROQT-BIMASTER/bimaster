import { useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MunicipioIntelligence } from "@/hooks/useMunicipiosIntelligence";

interface MunicipiosScatterChartProps {
  data: MunicipioIntelligence[];
  loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  Ativo: '#22c55e',
  Prospect: '#eab308',
  Lead: '#3b82f6',
  Virgem: '#9ca3af',
};

function formatAxisValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

export function MunicipiosScatterChart({ data, loading }: MunicipiosScatterChartProps) {
  const chartData = useMemo(() => {
    // Only show municipalities with PIB data, sample for performance
    const filtered = data.filter(d => d.pib_per_capita > 0);
    // If too many points, sample
    if (filtered.length > 300) {
      const sampled: MunicipioIntelligence[] = [];
      // Always include active ones
      const ativos = filtered.filter(d => d.status_comercial === 'Ativo');
      const prospects = filtered.filter(d => d.status_comercial === 'Prospect');
      const others = filtered.filter(d => d.status_comercial !== 'Ativo' && d.status_comercial !== 'Prospect');
      sampled.push(...ativos);
      sampled.push(...prospects);
      // Sample virgens by PIB (top ones)
      const sorted = others.sort((a, b) => b.pib_per_capita - a.pib_per_capita);
      sampled.push(...sorted.slice(0, 300 - ativos.length - prospects.length));
      return sampled;
    }
    return filtered;
  }, [data]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">PIB per Capita vs Receita</CardTitle>
        <CardDescription>
          Identifique municípios ricos onde a empresa ainda não atua. Tamanho = População. Cor = Status.
        </CardDescription>
        <div className="flex gap-4 mt-2">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">{status}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              type="number"
              dataKey="pib_per_capita"
              name="PIB per Capita"
              tickFormatter={formatAxisValue}
              label={{ value: 'PIB per Capita (R$)', position: 'bottom', offset: 0, style: { fontSize: 11 } }}
            />
            <YAxis
              type="number"
              dataKey="receita_total"
              name="Receita"
              tickFormatter={formatAxisValue}
              label={{ value: 'Receita (R$)', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload as MunicipioIntelligence;
                return (
                  <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm">
                    <p className="font-semibold">{d.municipio_nome} - {d.uf_sigla}</p>
                    <p>PIB/Capita: R$ {d.pib_per_capita.toLocaleString('pt-BR')}</p>
                    <p>Receita: R$ {d.receita_total.toLocaleString('pt-BR')}</p>
                    <p>População: {d.populacao.toLocaleString('pt-BR')}</p>
                    <p>Clientes: {d.total_clientes}</p>
                    <p>Status: {d.status_comercial}</p>
                  </div>
                );
              }}
            />
            <Scatter data={chartData} fill="#8884d8">
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={STATUS_COLORS[entry.status_comercial] || '#9ca3af'}
                  fillOpacity={0.7}
                  r={Math.max(3, Math.min(15, Math.sqrt(entry.populacao / 10000)))}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

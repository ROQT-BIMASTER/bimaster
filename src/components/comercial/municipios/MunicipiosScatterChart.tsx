import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MunicipiosKPIs } from "@/hooks/useMunicipiosIntelligence";
import { SmartValue } from "@/components/ui/smart-value";
import { MapPin, Users, TrendingUp, Globe } from "lucide-react";

interface MunicipiosCoberturaChartProps {
  kpis: MunicipiosKPIs | undefined;
  loading: boolean;
}

const STATUS_CONFIG = [
  { key: 'Ativo', label: 'Ativos', color: '#22c55e', icon: TrendingUp },
  { key: 'Prospect', label: 'Prospects', color: '#eab308', icon: Users },
  { key: 'Lead', label: 'Leads', color: '#3b82f6', icon: MapPin },
  { key: 'Virgem', label: 'Inexplorados', color: '#9ca3af', icon: Globe },
] as const;

export function MunicipiosScatterChart({ kpis, loading }: MunicipiosCoberturaChartProps) {
  const chartData = useMemo(() => {
    if (!kpis) return [];
    return [
      { name: 'Ativos', value: kpis.municipios_atendidos, color: '#22c55e' },
      { name: 'Prospects', value: kpis.municipios_prospect, color: '#eab308' },
      { name: 'Leads', value: kpis.municipios_lead, color: '#3b82f6' },
      { name: 'Inexplorados', value: kpis.municipios_virgem, color: '#9ca3af' },
    ].filter(d => d.value > 0);
  }, [kpis]);

  const totalMunicipios = kpis?.total_municipios || 0;
  const taxaPenetracao = kpis?.taxa_penetracao || 0;

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
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Cobertura Comercial Municipal</CardTitle>
        <CardDescription>
          Distribuição de status entre todos os municípios filtrados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Donut Chart */}
          <div className="relative w-[220px] h-[220px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-foreground">{taxaPenetracao.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">penetração</span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {totalMunicipios.toLocaleString('pt-BR')} mun.
              </span>
            </div>
          </div>

          {/* Right side: Legend + Metrics */}
          <div className="flex-1 space-y-5 min-w-0">
            {/* Legend */}
            <div className="grid grid-cols-2 gap-2.5">
              {STATUS_CONFIG.map((status) => {
                const value = status.key === 'Ativo'
                  ? kpis?.municipios_atendidos || 0
                  : status.key === 'Prospect'
                  ? kpis?.municipios_prospect || 0
                  : status.key === 'Lead'
                  ? kpis?.municipios_lead || 0
                  : kpis?.municipios_virgem || 0;
                
                const pct = totalMunicipios > 0 ? ((value / totalMunicipios) * 100).toFixed(1) : '0';

                return (
                  <div key={status.key} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: status.color }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground truncate">
                        {value.toLocaleString('pt-BR')} {status.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Separator */}
            <div className="border-t border-border" />

            {/* Opportunity Metrics */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Potencial Inexplorado
              </p>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pop. sem cobertura</span>
                  <SmartValue
                    value={(kpis?.populacao_total || 0) * ((kpis?.municipios_virgem || 0) / Math.max(totalMunicipios, 1))}
                    className="font-semibold text-foreground"
                    showTooltip={false}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">PIB não explorado</span>
                  <SmartValue
                    value={(kpis?.pib_total || 0) * ((kpis?.municipios_virgem || 0) / Math.max(totalMunicipios, 1))}
                    className="font-semibold text-foreground"
                    showTooltip={false}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Municípios por ativar</span>
                  <span className="font-semibold text-foreground">
                    {((kpis?.municipios_virgem || 0) + (kpis?.municipios_lead || 0) + (kpis?.municipios_prospect || 0)).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

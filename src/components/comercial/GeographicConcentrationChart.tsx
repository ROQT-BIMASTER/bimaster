import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConcentracaoUF } from "@/hooks/useClienteAnalytics";

interface Props {
  data: ConcentracaoUF[] | undefined;
  isLoading: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const COLORS = [
  "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af",
  "#60a5fa", "#93c5fd", "#bfdbfe",
  "#6b7280", "#9ca3af", "#d1d5db",
];

export function GeographicConcentrationChart({ data, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-[350px] rounded-xl" />;
  if (!data) return null;

  const top10 = data.slice(0, 10);
  const topUF = top10[0];
  const hhi = data.reduce((s, d) => s + Math.pow(d.pctReceita, 2), 0);
  const concentrationLevel = hhi > 2500 ? "Alta" : hhi > 1500 ? "Moderada" : "Baixa";
  const concentrationColor = hhi > 2500 ? "text-red-600" : hhi > 1500 ? "text-amber-600" : "text-green-600";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Concentração Geográfica de Receita</CardTitle>
          <div className="text-right">
            <span className={`text-xs font-semibold ${concentrationColor}`}>
              Concentração: {concentrationLevel}
            </span>
            <p className="text-[10px] text-muted-foreground">
              {topUF?.uf} = {topUF?.pctReceita.toFixed(1)}% da receita
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top10} margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="uf" fontSize={12} />
              <YAxis
                fontSize={11}
                tickFormatter={(v) =>
                  v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                }
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as ConcentracaoUF;
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm space-y-1">
                      <p className="font-semibold">{d.uf}</p>
                      <p>Receita última: {formatCurrency(d.receitaUltima)}</p>
                      <p>Clientes: {d.totalClientes} ({d.clientesComCompra} c/ compra)</p>
                      <p>Ticket médio: {formatCurrency(d.ticketMedio)}</p>
                      <p>% Receita: {d.pctReceita.toFixed(1)}%</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="receitaUltima" radius={[4, 4, 0, 0]} barSize={32}>
                {top10.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {top10.slice(0, 6).map((d) => (
            <div key={d.uf} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50">
              <span className="font-medium">{d.uf}</span>
              <span className="text-muted-foreground">{d.pctReceita.toFixed(1)}% · {d.totalClientes} cli</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

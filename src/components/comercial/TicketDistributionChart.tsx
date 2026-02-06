import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { FaixaTicket } from "@/hooks/useClienteAnalytics";

interface Props {
  data: FaixaTicket[] | undefined;
  isLoading: boolean;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const FAIXA_COLORS: Record<string, string> = {
  "Micro (< R$ 100)": "#94a3b8",
  "Pequeno (R$ 100-500)": "#60a5fa",
  "Médio (R$ 500-2k)": "#34d399",
  "Alto (R$ 2k-5k)": "#fbbf24",
  "Premium (R$ 5k-20k)": "#f97316",
  "Enterprise (> R$ 20k)": "#ef4444",
};

export function TicketDistributionChart({ data, isLoading }: Props) {
  if (isLoading) return <Skeleton className="h-[350px] rounded-xl" />;
  if (!data) return null;

  const withData = data.filter((f) => f.quantidade > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Distribuição por Faixa de Ticket</CardTitle>
        <p className="text-xs text-muted-foreground">
          Baseado no valor da última compra de cada cliente
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={withData} layout="vertical" margin={{ left: 15, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={11} />
              <YAxis
                dataKey="faixa"
                type="category"
                width={120}
                fontSize={11}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as FaixaTicket;
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm space-y-1">
                      <p className="font-semibold">{d.faixa}</p>
                      <p>{d.quantidade} clientes ({d.pctClientes.toFixed(1)}%)</p>
                      <p>Valor total: {formatCurrency(d.valorTotal)}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} barSize={20}>
                {withData.map((entry) => (
                  <Cell key={entry.faixa} fill={FAIXA_COLORS[entry.faixa] || "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {withData.map((d) => (
            <div key={d.faixa} className="flex items-center gap-1.5 text-xs">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FAIXA_COLORS[d.faixa] }} />
              <span className="text-muted-foreground">
                {d.faixa}: {d.quantidade} ({d.pctClientes.toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

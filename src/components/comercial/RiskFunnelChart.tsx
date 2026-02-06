import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ReativacaoKPI, RiskLevel } from "@/hooks/useClienteReativacao";

const COLORS: Record<string, string> = {
  atencao: "#f59e0b",
  alerta: "#f97316",
  critico: "#ef4444",
  inativo: "#6b7280",
};

interface Props {
  kpis: ReativacaoKPI[];
  onBarClick?: (nivel: RiskLevel) => void;
}

export function RiskFunnelChart({ kpis, onBarClick }: Props) {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  const data = kpis.map((k) => ({
    name: k.label,
    clientes: k.quantidade,
    valor: k.valor_total,
    nivel: k.nivel,
  }));

  const handleClick = (entry: { nivel: string }) => {
    onBarClick?.(entry.nivel as RiskLevel);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Funil de Risco</CardTitle>
        {onBarClick && <p className="text-xs text-muted-foreground">Clique em uma barra para filtrar a tabela</p>}
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${v}`} fontSize={12} />
              <YAxis dataKey="name" type="category" width={70} fontSize={12} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "clientes") return [value, "Clientes"];
                  return [formatCurrency(value), "Valor em Risco"];
                }}
                contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
              />
              <Bar
                dataKey="clientes"
                radius={[0, 4, 4, 0]}
                barSize={24}
                onClick={(_data: unknown, index: number) => handleClick(data[index])}
                className={onBarClick ? "cursor-pointer" : ""}
              >
                {data.map((entry) => (
                  <Cell key={entry.nivel} fill={COLORS[entry.nivel]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {data.map((d) => (
            <div
              key={d.nivel}
              className={`flex items-center gap-1.5 text-xs text-muted-foreground ${onBarClick ? "cursor-pointer hover:text-foreground transition-colors" : ""}`}
              onClick={() => onBarClick?.(d.nivel as RiskLevel)}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[d.nivel] }} />
              <span>{d.name}: {formatCurrency(d.valor)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

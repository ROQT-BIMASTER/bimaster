import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface UFItem {
  uf: string;
  qtdClientes: number;
  receita: number;
}

interface Props {
  data: UFItem[];
  isLoading: boolean;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(200, 65%, 50%)",
  "hsl(190, 60%, 45%)",
  "hsl(180, 55%, 40%)",
  "hsl(170, 50%, 45%)",
  "hsl(160, 45%, 50%)",
  "hsl(150, 40%, 55%)",
];

const fmtMoeda = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
};

export function ClientesUFTreemap({ data, isLoading }: Props) {
  if (isLoading) {
    return <Card><CardContent className="p-4"><Skeleton className="h-80 w-full" /></CardContent></Card>;
  }

  const top = data.slice(0, 12);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Clientes por UF</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={top} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" tickFormatter={fmtMoeda} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="uf" tick={{ fontSize: 12 }} width={40} />
            <Tooltip
              formatter={(v: any) => [fmtMoeda(v), "Receita"]}
              labelFormatter={(l) => `UF: ${l}`}
            />
            <Bar dataKey="receita" radius={[0, 4, 4, 0]}>
              {top.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

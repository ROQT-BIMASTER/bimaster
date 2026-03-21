import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface FaixaItem {
  faixa: string;
  min: number;
  max: number;
  quantidade: number;
  valorTotal: number;
}

interface Props {
  data: FaixaItem[];
  isLoading: boolean;
}

export function ClientesFaixaReceita({ data, isLoading }: Props) {
  if (isLoading) {
    return <Card><CardContent className="p-4"><Skeleton className="h-64 w-full" /></CardContent></Card>;
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Clientes por Faixa de Receita</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="faixa" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: any, name: string) => [
                name === "quantidade" ? v : `R$ ${Number(v).toLocaleString("pt-BR")}`,
                name === "quantidade" ? "Clientes" : "Valor Total"
              ]}
            />
            <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="quantidade" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

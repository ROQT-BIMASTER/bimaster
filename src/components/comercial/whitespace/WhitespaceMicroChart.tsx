import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import type { WhitespaceMicroRow } from "@/hooks/useWhitespaceAnalysis";

interface Props {
  data: WhitespaceMicroRow[];
  loading: boolean;
}

const formatCurrency = (n: number) => {
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1)}mi`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toFixed(0)}mil`;
  return `R$ ${n.toFixed(0)}`;
};

export function WhitespaceMicroChart({ data, loading }: Props) {
  const chartData = data.map((d) => ({
    name: d.microrregiao_nome.length > 20 
      ? d.microrregiao_nome.slice(0, 18) + "…" 
      : d.microrregiao_nome,
    fullName: d.microrregiao_nome,
    uf: d.uf,
    ativos: Number(d.municipios_ativos),
    whitespace: Number(d.municipios_whitespace),
    penetracao: Number(d.penetracao),
    pibInexplorado: Number(d.pib_inexplorado),
    receitaAtual: Number(d.receita_atual),
    score: Number(d.score_agregado),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top 15 Microrregiões com Oportunidade</CardTitle>
        <p className="text-xs text-muted-foreground">
          Distribuição: municípios ativos vs whitespace por microrregião
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
            Nenhuma microrregião encontrada com os filtros atuais
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <XAxis type="number" fontSize={11} />
              <YAxis
                type="category"
                dataKey="name"
                width={140}
                fontSize={11}
                tick={{ fill: "hsl(var(--foreground))" }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg text-xs space-y-1">
                      <p className="font-semibold">{d.fullName} ({d.uf})</p>
                      <p>🟢 Ativos: {d.ativos}</p>
                      <p>⚪ Whitespace: {d.whitespace}</p>
                      <p>📊 Penetração: {d.penetracao}%</p>
                      <p>💰 Receita atual: {formatCurrency(d.receitaAtual)}</p>
                      <p>📈 PIB inexplorado: {formatCurrency(d.pibInexplorado)}</p>
                      <p>⭐ Score: {Math.round(d.score).toLocaleString("pt-BR")}</p>
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                payload={[
                  { value: "Ativos", type: "rect", color: "hsl(142, 71%, 45%)" },
                  { value: "Whitespace", type: "rect", color: "hsl(var(--muted-foreground))" },
                ]}
              />
              <Bar dataKey="ativos" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} name="Ativos" />
              <Bar dataKey="whitespace" stackId="a" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} name="Whitespace" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

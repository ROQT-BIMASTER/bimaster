import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketCoverageRow } from "@/hooks/useMarketCoverage";

interface RegionHeatmapProps {
  data: MarketCoverageRow[];
  isLoading: boolean;
}

const formatNumber = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

export function RegionHeatmap({ data, isLoading }: RegionHeatmapProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="p-6">
          <div className="h-[400px] animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // Agrupar por região
  const regioes = data.reduce<
    Record<string, { total: number; comClientes: number; clientes: number; pop: number }>
  >((acc, row) => {
    const r = row.regiao_nome || "Indefinida";
    if (!acc[r]) acc[r] = { total: 0, comClientes: 0, clientes: 0, pop: 0 };
    acc[r].total += row.total_municipios;
    acc[r].comClientes += row.municipios_com_clientes;
    acc[r].clientes += row.total_clientes_erp;
    acc[r].pop += row.populacao_total;
    return acc;
  }, {});

  const sorted = Object.entries(regioes)
    .map(([nome, d]) => ({
      nome,
      ...d,
      penetracao: d.total > 0 ? (d.comClientes / d.total) * 100 : 0,
    }))
    .sort((a, b) => b.penetracao - a.penetracao);

  const maxPenetracao = Math.max(...sorted.map((s) => s.penetracao), 1);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Penetração por Região</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sorted.map((regiao) => {
            const pct = regiao.penetracao;
            const width = (pct / maxPenetracao) * 100;
            return (
              <div key={regiao.nome} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{regiao.nome}</span>
                  <span className="text-muted-foreground">
                    {pct.toFixed(1)}% · {formatNumber(regiao.clientes)} clientes
                  </span>
                </div>
                <div className="h-6 bg-muted rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                    style={{
                      width: `${Math.max(width, 2)}%`,
                      backgroundColor:
                        pct >= 15
                          ? "hsl(var(--chart-2))"
                          : pct >= 8
                          ? "hsl(var(--chart-1))"
                          : pct >= 3
                          ? "hsl(var(--chart-4))"
                          : "hsl(var(--chart-5))",
                    }}
                  >
                    {width > 15 && (
                      <span className="text-xs font-bold text-white">
                        {regiao.comClientes}/{regiao.total}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

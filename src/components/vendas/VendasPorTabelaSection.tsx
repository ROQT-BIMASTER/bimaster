import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Layers } from "lucide-react";
import { ChartContainer } from "@/components/ui/chart-container";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { formatQtd, type Unidade } from "@/lib/vendas/unidade";
import { getTabelaColor } from "@/lib/vendas/tabelaPrecoColors";
import { useVendasPorTabela } from "@/hooks/useVendasPorTabela";
import type { VendasFilters } from "@/hooks/useVendasAnalise";

const pctFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat("pt-BR");

interface Props {
  filters: VendasFilters;
  unidade: Unidade;
}

export function VendasPorTabelaSection({ filters, unidade }: Props) {
  const { data, isLoading } = useVendasPorTabela(filters);
  // Em agregado multi-produto/tabela, CX não tem fator único.
  const qtdDisplayUnidade: Unidade = unidade === "CX" ? "DZ" : unidade;
  const qtdHeaderLabel = unidade === "CX" ? "Qtde (dz)" : `Qtde (${unidade === "DZ" ? "dz" : "un"})`;

  const chart = (
    <div className="w-full h-full">
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          Sem dados no período selecionado.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 32, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => formatCurrency(Number(v)).replace("R$", "").trim()}
            />
            <YAxis
              type="category"
              dataKey="tabela_preco_nome"
              width={110}
              tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: any, _name: any, item: any) => {
                const row = item?.payload || {};
                return [
                  `${formatCurrency(Number(value))} · ${pctFmt.format(row.pct)}%`,
                  "Faturamento",
                ];
              }}
              labelFormatter={(label: any, payload: any) => {
                const row = payload?.[0]?.payload;
                if (!row) return label;
                return `${label} — ${intFmt.format(row.notas)} notas · ${formatQtd(row.qtd_un, qtdDisplayUnidade, null)}`;
              }}
            />
            <Bar dataKey="faturamento" radius={[0, 4, 4, 0]}>
              {data.map((r) => (
                <Cell key={r.tabela_preco_nome} fill={getTabelaColor(r.tabela_preco_nome)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const table = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tabela</TableHead>
          <TableHead className="text-right">Faturamento (R$)</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead className="text-right">Nº notas</TableHead>
          <TableHead className="text-right">{qtdHeaderLabel}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={5}><Skeleton className="h-4 w-full" /></TableCell>
            </TableRow>
          ))
        ) : !data || data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
              Sem dados no período selecionado.
            </TableCell>
          </TableRow>
        ) : (
          data.map((r) => {
            const isSemTabela = !r.tabela_preco_id;
            return (
              <TableRow key={`${r.tabela_preco_id ?? "null"}-${r.tabela_preco_nome}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: getTabelaColor(r.tabela_preco_nome) }}
                    />
                    <span className={isSemTabela ? "text-muted-foreground italic" : "font-medium"}>
                      {r.tabela_preco_nome}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.faturamento)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {pctFmt.format(r.pct)}%
                </TableCell>
                <TableCell className="text-right tabular-nums">{intFmt.format(r.notas)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQtd(r.qtd_un, qtdDisplayUnidade, null)}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  return (
    <ChartContainer
      title="Vendas por tabela"
      icon={<Layers className="h-4 w-4 text-primary" />}
      chart={chart}
      table={table}
      chartHeight="h-[420px]"
    />
  );
}

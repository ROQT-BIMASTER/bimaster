import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useVendasTopClientes, type VendasFilters } from "@/hooks/useVendasAnalise";

function fmtMi(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return formatCurrency(n);
}

export function TopClientesTable({ filters }: { filters: VendasFilters }) {
  const { data, isLoading } = useVendasTopClientes(filters, 10);
  const rows = data || [];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <div className="text-base font-semibold text-foreground">Top clientes</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[320px] w-full" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período</div>
        ) : (
          <ol className="divide-y divide-border/60">
            {rows.map((r, i) => (
              <li key={r.cliente_futura_id} className="flex items-center gap-3 py-2.5">
                <div
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                  style={{ background: "hsl(var(--vendas-accent-soft))", color: "hsl(var(--vendas-accent-strong))" }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 text-sm text-foreground truncate" title={r.cliente_nome}>{r.cliente_nome}</div>
                <div className="text-sm font-semibold tabular-nums text-foreground">{fmtMi(r.faturamento)}</div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

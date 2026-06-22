import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { Users } from "lucide-react";
import { useVendasTopClientes, type VendasFilters } from "@/hooks/useVendasAnalise";

export function TopClientesTable({ filters }: { filters: VendasFilters }) {
  const { data, isLoading } = useVendasTopClientes(filters, 10);
  const rows = data || [];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          Top 10 clientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-[300px] w-full" /> : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período</div>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Notas</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.cliente_futura_id}>
                    <TableCell className="font-medium">{r.cliente_nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.notas.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(r.faturamento)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { formatCurrency } from "@/lib/formatters";
import { useNotasPeriodoResult } from "@/hooks/vendas/useVendasResult";

const PAGE_SIZE = 50;

interface Props {
  de: string;
  ate: string;
  empresa: number | null;
  vendedor: number | null;
}

function EtapaBadge({ etapa }: { etapa: string | null }) {
  if (!etapa) return <span className="text-muted-foreground">—</span>;
  const isEntregue = etapa === "entregue";
  return (
    <Badge
      variant="outline"
      className={
        isEntregue
          ? "text-[10px] border-emerald-400/50 text-emerald-600 dark:text-emerald-400"
          : "text-[10px] border-sky-400/50 text-sky-600 dark:text-sky-400"
      }
    >
      {isEntregue ? "Entregue" : "Faturado"}
    </Badge>
  );
}

export function NotasPeriodoResultTable({ de, ate, empresa, vendedor }: Props) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useNotasPeriodoResult({
    de, ate, empresa, vendedor, page, pageSize: PAGE_SIZE,
  });
  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="text-base font-semibold text-foreground">
          Notas do período
          {total > 0 && (
            <span className="text-xs text-muted-foreground font-normal ml-2">
              ({total.toLocaleString("pt-BR")})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">NF</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vendedor</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow
                    key={`${r.venda_id}-${i}`}
                    className="odd:bg-muted/30 hover:bg-muted/50 border-border"
                  >
                    <TableCell className="tabular-nums text-sm">
                      {r.data_venda
                        ? format(parseLocalDate(r.data_venda), "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">{r.nf_numero ?? "—"}</TableCell>
                    <TableCell className="max-w-[320px] truncate text-sm">{r.cliente_nome ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.vendedor_nome ?? "—"}</TableCell>
                    <TableCell><EtapaBadge etapa={r.etapa} /></TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-sm">
                      {formatCurrency(Number(r.total_venda ?? 0))}
                    </TableCell>
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

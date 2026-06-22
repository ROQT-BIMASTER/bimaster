import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { useNotasPeriodo, type VendasFilters } from "@/hooks/useVendasAnalise";

const PAGE_SIZE = 50;

export function NotasPeriodoTable({ filters }: { filters: VendasFilters }) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useNotasPeriodo(filters, page, PAGE_SIZE);
  const rows = data?.rows || [];
  const total = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-violet-600" />
          Notas do período
          {total > 0 && <span className="text-xs text-muted-foreground font-normal ml-2">({total.toLocaleString("pt-BR")})</span>}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-[400px] w-full" /> : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período</div>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Série</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Coordenador</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any, i: number) => (
                  <TableRow key={`${r.nro_nota}-${r.serie}-${i}`}>
                    <TableCell className="tabular-nums">{r.data_emissao ? format(parseLocalDate(r.data_emissao), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                    <TableCell className="tabular-nums">{r.nro_nota}</TableCell>
                    <TableCell>{r.serie}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{r.cliente_nome ?? "-"}</TableCell>
                    <TableCell>{r.vendedor_nome ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.coordenador_nome ?? "Sem coordenador"}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(Number(r.total_nota ?? 0))}</TableCell>
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

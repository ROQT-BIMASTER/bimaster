import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNotasPeriodo, type VendasFilters } from "@/hooks/useVendasAnalise";
import { formatQtd, type Unidade } from "@/lib/vendas/unidade";

const PAGE_SIZE = 50;

export function NotasPeriodoTable({ filters, unidade }: { filters: VendasFilters; unidade: Unidade }) {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useNotasPeriodo(filters, page, PAGE_SIZE);
  const rows = data?.rows || [];
  const itemMap = data?.itemMap || {};
  const total = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="text-base font-semibold text-foreground">
          Notas do período
          {total > 0 && <span className="text-xs text-muted-foreground font-normal ml-2">({total.toLocaleString("pt-BR")})</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-[400px] w-full" /> : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nº Nota</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vendedor</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Coordenador</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Qtd. orig.</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Qtd. conv.</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any, i: number) => {
                  const agg = itemMap[String(r.futura_nota_id)];
                  const sigla = agg?.sigla_dominante ?? null;
                  const qtdUn = agg?.qtd_un ?? null;
                  const itensCx = agg?.itens_caixa ?? null;
                  // qtd original: se temos sigla dominante, converter qtd_un de volta para a unidade comercial
                  let origLabel = "—";
                  if (qtdUn != null && sigla) {
                    if (sigla === "DZ") origLabel = `${(qtdUn / 12).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} DZ`;
                    else if (sigla === "UN" || sigla === "PC" || sigla === "PCT") origLabel = `${qtdUn.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ${sigla}`;
                    else if ((sigla === "CX" || sigla === "BX") && itensCx) origLabel = `${(qtdUn / itensCx).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ${sigla}`;
                    else origLabel = `${qtdUn.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} ${sigla}`;
                  } else if (qtdUn != null && !sigla) {
                    origLabel = "misto";
                  }
                  const convLabel = qtdUn == null
                    ? "—"
                    : formatQtd(qtdUn, unidade, itensCx);
                  return (
                    <TableRow key={`${r.nro_nota}-${r.serie}-${i}`} className="odd:bg-muted/30 hover:bg-muted/50 border-border">
                      <TableCell className="tabular-nums text-sm">{r.data_emissao ? format(parseLocalDate(r.data_emissao), "dd/MM/yyyy", { locale: ptBR }) : "-"}</TableCell>
                      <TableCell className="tabular-nums text-sm">{r.nro_nota}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm">{r.cliente_nome ?? "-"}</TableCell>
                      <TableCell className="text-sm">{r.vendedor_nome ?? "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.coordenador_nome ?? "Sem coordenador"}</TableCell>
                      <TableCell className="text-right text-xs">
                        {origLabel === "misto"
                          ? <Badge variant="outline" className="text-[10px]">misto</Badge>
                          : <span className="tabular-nums text-muted-foreground">{origLabel}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{convLabel}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-sm">{formatCurrency(Number(r.total_nota ?? 0))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

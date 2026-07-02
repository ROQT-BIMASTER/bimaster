import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, Zap } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import type { PedidoFornecedor } from "@/hooks/fornecedor/useFornecedorPedidos";
import { formatTempoEtapa, getEtapaTheme } from "./etapaTheme";

interface PedidosTableProps {
  pedidos: PedidoFornecedor[];
  limiarParado: number;
  onPedidoClick?: (pedido: PedidoFornecedor) => void;
}

type SortKey = "nro_pedido" | "cliente_nome" | "vendedor_nome" | "etapa" | "dias_na_etapa" | "data_emissao" | "total_pedido";

export function PedidosTable({ pedidos, limiarParado, onPedidoClick }: PedidosTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("data_emissao");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const arr = [...pedidos];
    arr.sort((a, b) => {
      const va = (a[sortKey] ?? "") as any;
      const vb = (b[sortKey] ?? "") as any;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [pedidos, sortKey, sortDir]);

  const totalGeral = useMemo(() => sorted.reduce((s, p) => s + (p.total_pedido ?? 0), 0), [sorted]);



  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <Button variant="ghost" size="sm" className="h-7 px-1 -ml-1 gap-1" onClick={() => onSort(k)}>
      {children} <ArrowUpDown className="h-3 w-3 opacity-50" />
    </Button>
  );

  return (
    <Table stickyHeader minWidthClass="min-w-[900px]">
      <TableHeader>
        <TableRow>
          <TableHead><SortBtn k="nro_pedido">Nº pedido</SortBtn></TableHead>
          <TableHead><SortBtn k="cliente_nome">Cliente</SortBtn></TableHead>
          <TableHead><SortBtn k="vendedor_nome">Vendedor</SortBtn></TableHead>
          <TableHead><SortBtn k="etapa">Etapa</SortBtn></TableHead>
          <TableHead><SortBtn k="dias_na_etapa">Tempo na etapa</SortBtn></TableHead>
          <TableHead><SortBtn k="data_emissao">Emissão</SortBtn></TableHead>
          <TableHead className="text-right"><SortBtn k="total_pedido">Total</SortBtn></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
              Nenhum pedido no período
            </TableCell>
          </TableRow>
        ) : (
          sorted.map((p) => {
            const theme = getEtapaTheme(p.etapa);
            const dias = p.dias_na_etapa ?? 0;
            const parado = p.em_andamento && dias > limiarParado;
            const dataEmissao = p.data_emissao ? parseLocalDate(p.data_emissao) : null;
            return (
              <TableRow
                key={p.futura_pedido_id}
                className={cn(parado && "bg-destructive/5", onPedidoClick && "cursor-pointer hover:bg-muted/50")}
                onClick={onPedidoClick ? () => onPedidoClick(p) : undefined}
                tabIndex={onPedidoClick ? 0 : undefined}
                onKeyDown={
                  onPedidoClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onPedidoClick(p);
                        }
                      }
                    : undefined
                }
              >
                <TableCell className="font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {p.nro_pedido ?? p.futura_pedido_id}
                    {p.urgente && <Zap className="h-3 w-3 text-destructive" />}
                  </div>
                </TableCell>
                <TableCell className="max-w-[260px] truncate">{p.cliente_nome ?? "—"}</TableCell>
                <TableCell className="max-w-[180px] truncate text-muted-foreground">{p.vendedor_nome ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("font-normal", theme.badge)}>{theme.label}</Badge>
                </TableCell>
                <TableCell>
                  <span className={cn("flex items-center gap-1 text-sm", parado ? "text-destructive font-medium" : "text-muted-foreground")}>
                    {parado && <AlertTriangle className="h-3 w-3" />}
                    {formatTempoEtapa(p.dias_na_etapa)}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {dataEmissao ? format(dataEmissao, "dd/MM/yyyy") : "—"}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap">
                  {formatCurrency(p.total_pedido ?? 0)}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

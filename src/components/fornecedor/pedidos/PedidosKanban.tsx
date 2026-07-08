import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { PedidoFornecedor } from "@/hooks/fornecedor/useFornecedorPedidos";
import { KANBAN_COLUNAS, type KanbanColuna } from "./etapaTheme";
import { PedidoCard } from "./PedidoCard";

export type PedidosKanbanOrdem = "parado" | "recente" | "valor";

interface PedidosKanbanProps {
  pedidos: PedidoFornecedor[];
  limiarParado: number;
  onPedidoClick?: (pedido: PedidoFornecedor) => void;
  /** Override de colunas (ex.: Result inclui "Entregue"). Default: KANBAN_COLUNAS. */
  colunas?: KanbanColuna[];
  ordem?: PedidosKanbanOrdem;
}

const ETAPAS_EM_ANDAMENTO = new Set(["digitacao", "separacao", "separado", "conferido"]);

export function PedidosKanban({
  pedidos,
  limiarParado,
  onPedidoClick,
  colunas: colunasProp,
  ordem = "parado",
}: PedidosKanbanProps) {
  const colunasBase = colunasProp ?? KANBAN_COLUNAS;
  const colunas = useMemo(() => {
    return colunasBase.map((c) => {
      const pedidosCol = pedidos
        .filter((p) => c.etapas.includes(p.etapa as any))
        .sort((a, b) => {
          if (c.id === "entregue") {
            return (
              new Date(b.data_movimentacao ?? 0).getTime() -
              new Date(a.data_movimentacao ?? 0).getTime()
            );
          }
          if (ordem === "recente") {
            return (
              new Date(b.data_emissao ?? 0).getTime() -
              new Date(a.data_emissao ?? 0).getTime()
            );
          }
          if (ordem === "valor") {
            return (b.total_pedido ?? 0) - (a.total_pedido ?? 0);
          }
          return (b.dias_na_etapa ?? 0) - (a.dias_na_etapa ?? 0);
        });
      const total = pedidosCol.reduce((s, p) => s + (p.total_pedido ?? 0), 0);
      return { ...c, pedidos: pedidosCol, total };
    });
  }, [pedidos, colunasBase, ordem]);

  const { totalEmAndamento, countEmAndamento } = useMemo(() => {
    const cols = colunas.filter((c) => ETAPAS_EM_ANDAMENTO.has(c.id));
    return {
      totalEmAndamento: cols.reduce((s, c) => s + c.total, 0),
      countEmAndamento: cols.reduce((s, c) => s + c.pedidos.length, 0),
    };
  }, [colunas]);

  const gridCols =
    colunas.length >= 6
      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-5";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Em andamento</span>
        <span className="font-semibold text-foreground">
          {formatCurrency(totalEmAndamento)}
          <span className="ml-2 text-muted-foreground font-normal">
            · {countEmAndamento} {countEmAndamento === 1 ? "pedido" : "pedidos"}
          </span>
        </span>
      </div>

      <div className={cn("grid gap-3", gridCols)}>
        {colunas.map((col) => (
          <div key={col.id} className="flex flex-col bg-muted/30 rounded-md border border-border min-h-[400px]">
            <div className="px-3 py-2 border-b border-border space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                <Badge variant="secondary">{col.pedidos.length}</Badge>
              </div>
              <p className="text-xs font-semibold text-foreground/90">
                {formatCurrency(col.total)}
              </p>
            </div>
            <ScrollArea className="flex-1 max-h-[70vh]">
              <div className="p-2 space-y-2">
                {col.pedidos.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Sem pedidos</p>
                ) : (
                  col.pedidos.map((p) => (
                    <PedidoCard key={p.futura_pedido_id} pedido={p} limiarParado={limiarParado} onClick={onPedidoClick} />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  );
}

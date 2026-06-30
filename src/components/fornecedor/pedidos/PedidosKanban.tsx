import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PedidoFornecedor } from "@/hooks/fornecedor/useFornecedorPedidos";
import { KANBAN_COLUNAS, type KanbanColuna } from "./etapaTheme";
import { PedidoCard } from "./PedidoCard";

interface PedidosKanbanProps {
  pedidos: PedidoFornecedor[];
  limiarParado: number;
  onPedidoClick?: (pedido: PedidoFornecedor) => void;
  /** Override de colunas (ex.: Result inclui "Entregue"). Default: KANBAN_COLUNAS. */
  colunas?: KanbanColuna[];
}

export function PedidosKanban({
  pedidos,
  limiarParado,
  onPedidoClick,
  colunas: colunasProp,
}: PedidosKanbanProps) {
  const colunasBase = colunasProp ?? KANBAN_COLUNAS;
  const colunas = useMemo(() => {
    return colunasBase.map((c) => ({
      ...c,
      pedidos: pedidos
        .filter((p) => c.etapas.includes(p.etapa as any))
        .sort((a, b) =>
          c.id === "entregue"
            ? // Entregue: mais recentes primeiro
              (new Date(b.data_movimentacao ?? 0).getTime()) -
              (new Date(a.data_movimentacao ?? 0).getTime())
            : (b.dias_na_etapa ?? 0) - (a.dias_na_etapa ?? 0),
        ),
    }));
  }, [pedidos, colunasBase]);

  const gridCols =
    colunas.length >= 6
      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      : "grid-cols-1 md:grid-cols-2 lg:grid-cols-5";

  return (
    <div className={cn("grid gap-3", gridCols)}>
      {colunas.map((col) => (
        <div key={col.id} className="flex flex-col bg-muted/30 rounded-md border border-border min-h-[400px]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
            <Badge variant="secondary">{col.pedidos.length}</Badge>
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
  );
}

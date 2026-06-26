import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PedidoFornecedor } from "@/hooks/fornecedor/useFornecedorPedidos";
import { KANBAN_COLUNAS } from "./etapaTheme";
import { PedidoCard } from "./PedidoCard";

interface PedidosKanbanProps {
  pedidos: PedidoFornecedor[];
  limiarParado: number;
}

export function PedidosKanban({ pedidos, limiarParado }: PedidosKanbanProps) {
  const colunas = useMemo(() => {
    return KANBAN_COLUNAS.map((c) => ({
      ...c,
      pedidos: pedidos
        .filter((p) => c.etapas.includes(p.etapa as any))
        .sort((a, b) => (b.dias_na_etapa ?? 0) - (a.dias_na_etapa ?? 0)),
    }));
  }, [pedidos]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
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
                  <PedidoCard key={p.futura_pedido_id} pedido={p} limiarParado={limiarParado} />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}

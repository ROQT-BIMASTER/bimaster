import { AlertTriangle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { PedidoFornecedor } from "@/hooks/fornecedor/useFornecedorPedidos";
import { formatTempoEtapa, getEtapaTheme } from "./etapaTheme";

interface PedidoCardProps {
  pedido: PedidoFornecedor;
  limiarParado: number;
}

export function PedidoCard({ pedido, limiarParado }: PedidoCardProps) {
  const theme = getEtapaTheme(pedido.etapa);
  const dias = pedido.dias_na_etapa ?? 0;
  const parado = pedido.em_andamento && dias > limiarParado;

  return (
    <div
      className={cn(
        "rounded-md bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-3 space-y-2",
        theme.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {pedido.cliente_nome ?? "Cliente não informado"}
          </p>
          <p className="text-xs text-muted-foreground">
            Nº {pedido.nro_pedido ?? pedido.futura_pedido_id}
          </p>
        </div>
        {pedido.urgente && (
          <Badge variant="destructive" className="gap-1 shrink-0">
            <Zap className="h-3 w-3" /> Urgente
          </Badge>
        )}
      </div>

      <p className="text-sm font-medium text-foreground">
        {formatCurrency(pedido.total_pedido ?? 0)}
      </p>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground truncate">
          {pedido.vendedor_nome ?? "—"}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 font-medium",
            parado ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {parado && <AlertTriangle className="h-3 w-3" />}
          {formatTempoEtapa(pedido.dias_na_etapa)}
        </span>
      </div>
    </div>
  );
}

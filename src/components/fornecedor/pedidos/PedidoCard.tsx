import { useState } from "react";
import { AlertTriangle, Zap, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { PedidoFornecedor } from "@/hooks/fornecedor/useFornecedorPedidos";
import type { PedidoRubyspExt } from "@/hooks/fornecedor/useRubyspPedidos";
import { formatTempoEtapa, getEtapaTheme } from "./etapaTheme";
import { PedidoTimelineChip } from "./PedidoTimelineChip";

interface PedidoCardProps {
  pedido: PedidoFornecedor;
  limiarParado: number;
  onClick?: (pedido: PedidoFornecedor) => void;
}

export function PedidoCard({ pedido, limiarParado, onClick }: PedidoCardProps) {
  const theme = getEtapaTheme(pedido.etapa);
  const dias = pedido.dias_na_etapa ?? 0;
  const parado = pedido.em_andamento && dias > limiarParado;
  const [copied, setCopied] = useState(false);

  // O tipo do kanban chega como PedidoFornecedor, mas em Result o payload real é PedidoRubyspExt.
  const hasMarcos = (pedido as PedidoRubyspExt).marcos != null;
  const nro = pedido.nro_pedido ?? String(pedido.futura_pedido_id);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(nro);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick ? () => onClick(pedido) : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(pedido);
              }
            }
          : undefined
      }
      className={cn(
        "rounded-md bg-card border border-border shadow-sm hover:shadow-md transition-shadow p-3 space-y-2 group/card relative",
        onClick && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring",
        theme.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {pedido.cliente_nome ?? "Cliente não informado"}
          </p>
          <p className="text-xs text-muted-foreground">Nº {nro}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {parado && (
            <Badge variant="destructive" className="gap-1 h-5 px-1.5 text-[10px]">
              <AlertTriangle className="h-3 w-3" /> Parado
            </Badge>
          )}
          {pedido.urgente && (
            <Badge variant="destructive" className="gap-1 h-5 px-1.5 text-[10px]">
              <Zap className="h-3 w-3" /> Urgente
            </Badge>
          )}
          <button
            type="button"
            aria-label="Copiar nº do pedido"
            onClick={handleCopy}
            className="opacity-0 group-hover/card:opacity-100 transition-opacity h-5 w-5 rounded hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <p className="text-sm font-medium text-foreground">
        {formatCurrency(pedido.total_pedido ?? 0)}
      </p>

      {hasMarcos && (
        <PedidoTimelineChip
          pedido={pedido as PedidoRubyspExt}
          etapaAtual={pedido.etapa}
        />
      )}

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

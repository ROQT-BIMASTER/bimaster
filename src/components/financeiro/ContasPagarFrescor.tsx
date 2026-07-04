import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSyncControlRubysp } from "@/hooks/fornecedor/useSyncControlRubysp";
import { cn } from "@/lib/utils";

export function ContasPagarFrescor() {
  const { data, isLoading, solicitarSync, isSyncing } = useSyncControlRubysp();

  const status = data?.status_contas_pagar ?? null;
  const rodando = status === "rodando" || isSyncing;
  const ultima = data?.ultima_exec_contas_pagar
    ? formatDistanceToNow(new Date(data.ultima_exec_contas_pagar), { locale: ptBR, addSuffix: true })
    : "nunca";

  const dotClass =
    status === "ok"
      ? "bg-emerald-500"
      : rodando
      ? "bg-amber-500 animate-pulse"
      : status === "erro"
      ? "bg-destructive"
      : "bg-muted-foreground/40";

  const statusLabel =
    rodando ? "Sincronizando"
    : status === "ok" ? "Atualizado"
    : status === "erro" ? "Erro na última execução"
    : "Aguardando";

  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", dotClass)} aria-hidden />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-xs font-medium">{statusLabel}</span>
        <span className="text-[11px] text-muted-foreground truncate">
          {isLoading ? "Carregando…" : `A Pagar: atualizado ${ultima}`}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-8 ml-auto gap-1.5"
        onClick={() => solicitarSync("contas_pagar")}
        disabled={rodando}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", rodando && "animate-spin")} />
        {rodando ? "Rodando…" : "Atualizar agora"}
      </Button>
    </div>
  );
}

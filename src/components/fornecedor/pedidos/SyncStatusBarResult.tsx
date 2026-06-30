import { RefreshCw } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSyncControlRubysp, type SyncAlvo } from "@/hooks/fornecedor/useSyncControlRubysp";
import { cn } from "@/lib/utils";

type Status = "ok" | "rodando" | "erro" | null;

function dotClass(status: Status): string {
  switch (status) {
    case "ok":
      return "bg-emerald-500";
    case "rodando":
      return "bg-amber-500 animate-pulse";
    case "erro":
      return "bg-destructive";
    default:
      return "bg-muted-foreground/40";
  }
}

function frescor(ts: string | null): string {
  if (!ts) return "nunca sincronizado";
  try {
    return `atualizado há ${formatDistanceToNow(parseISO(ts), { locale: ptBR, addSuffix: false })}`;
  } catch {
    return "data inválida";
  }
}

interface IndicadorProps {
  titulo: string;
  status: Status;
  ultimaExec: string | null;
  labelBotao: string;
  onClick: () => void;
  loading: boolean;
}

function Indicador({ titulo, status, ultimaExec, labelBotao, onClick, loading }: IndicadorProps) {
  const statusNorm = (status as string | null)?.toLowerCase() as Status;
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("h-2 w-2 rounded-full shrink-0", dotClass(statusNorm))} aria-hidden />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium leading-tight">{titulo}</span>
          <span className="text-xs text-muted-foreground leading-tight truncate">
            {frescor(ultimaExec)}
          </span>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onClick} disabled={loading} className="gap-2">
        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        {labelBotao}
      </Button>
    </div>
  );
}

export function SyncStatusBarResult() {
  const { data, solicitarSync, syncingAlvo } = useSyncControlRubysp();

  const handle = (alvo: SyncAlvo) => () => solicitarSync(alvo);

  return (
    <Card>
      <CardContent className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
        <Indicador
          titulo="Pedidos"
          status={(data?.status_pedidos as Status) ?? null}
          ultimaExec={data?.ultima_exec_pedidos ?? null}
          labelBotao="Atualizar pedidos agora"
          onClick={handle("pedidos")}
          loading={syncingAlvo === "pedidos"}
        />
        <Indicador
          titulo="Forecast"
          status={(data?.status_historico as Status) ?? null}
          ultimaExec={data?.ultima_exec_historico ?? null}
          labelBotao="Atualizar forecast agora"
          onClick={handle("historico")}
          loading={syncingAlvo === "historico"}
        />
      </CardContent>
    </Card>
  );
}

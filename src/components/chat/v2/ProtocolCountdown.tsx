import { useEffect, useState } from "react";
import { Clock, CheckCircle2, AlertTriangle, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  protocolo: string;
  prazoEm?: string | null;
  resolvidoEm?: string | null;
  mine?: boolean;
}

function diffParts(target: Date, now: Date) {
  const ms = target.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1_000);
  return { ms, h, m, s };
}

export function ProtocolCountdown({ protocolo, prazoEm, resolvidoEm, mine }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (resolvidoEm || !prazoEm) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [prazoEm, resolvidoEm]);

  const resolved = !!resolvidoEm;
  const target = prazoEm ? new Date(prazoEm) : null;
  const parts = target ? diffParts(target, now) : null;
  const atrasado = !resolved && parts && parts.ms < 0;

  const baseCls = cn(
    "mt-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium flex items-center gap-2",
    mine ? "bg-white/10 border-white/20 text-white/95" : "bg-card border-border text-foreground",
    resolved && (mine ? "bg-emerald-500/20 border-emerald-300/40" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"),
    atrasado && !resolved && (mine ? "bg-red-500/20 border-red-300/40" : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"),
  );

  return (
    <div className={baseCls} title={target ? `Prazo: ${target.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : undefined}>
      <Hash className="h-3 w-3 shrink-0 opacity-80" />
      <span className="font-mono tracking-tight">{protocolo}</span>
      {target && (
        <span className="ml-auto inline-flex items-center gap-1 tabular-nums">
          {resolved ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Resolvido
            </>
          ) : atrasado ? (
            <>
              <AlertTriangle className="h-3 w-3" />
              Atrasado {parts!.h}h {parts!.m.toString().padStart(2, "0")}m
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              {parts!.h.toString().padStart(2, "0")}:{parts!.m.toString().padStart(2, "0")}:{parts!.s.toString().padStart(2, "0")}
            </>
          )}
        </span>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, AlertTriangle, Hash, Timer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  protocolo: string;
  prazoEm?: string | null;
  resolvidoEm?: string | null;
  iniciadoEm?: string | null;
  mine?: boolean;
}

function diffParts(ms: number) {
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor((abs % 86_400_000) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1_000);
  return { ms, d, h, m, s };
}

function formatDuration(ms: number) {
  const { d, h, m, s } = diffParts(ms);
  if (d > 0) return `${d}d ${h}h ${m.toString().padStart(2, "0")}m`;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

// Protocol formato: PREFIX-YYYYMMDD-XXXXXX (últimos 6 = prefixo do ticket id)
function extractTicketPrefix(protocolo: string): string | null {
  const parts = protocolo.split("-");
  const last = parts[parts.length - 1];
  if (!last || last.length < 4) return null;
  return last.toLowerCase();
}

export function ProtocolCountdown({ protocolo, prazoEm, resolvidoEm, iniciadoEm, mine }: Props) {
  const [now, setNow] = useState(() => new Date());

  const ticketPrefix = useMemo(() => extractTicketPrefix(protocolo), [protocolo]);

  // Busca o status atual do ticket pelo prefixo do id (live data)
  const { data: ticket } = useQuery({
    queryKey: ["protocol-ticket", ticketPrefix],
    enabled: !!ticketPrefix && !resolvidoEm,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("suporte_tickets" as any)
        .select("id, resolved_at, created_at, status")
        .ilike("id", `${ticketPrefix}%`)
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const resolvedAtStr = resolvidoEm ?? ticket?.resolved_at ?? null;
  const startedAtStr = iniciadoEm ?? ticket?.created_at ?? null;
  const resolved = !!resolvedAtStr;

  useEffect(() => {
    if (resolved || !prazoEm) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [prazoEm, resolved]);

  const target = prazoEm ? new Date(prazoEm) : null;
  const parts = target && !resolved ? diffParts(target.getTime() - now.getTime()) : null;
  const atrasado = !resolved && parts && parts.ms < 0;

  // Tempo de resolução quando resolvido
  const resolutionMs = useMemo(() => {
    if (!resolved || !resolvedAtStr || !startedAtStr) return null;
    return new Date(resolvedAtStr).getTime() - new Date(startedAtStr).getTime();
  }, [resolved, resolvedAtStr, startedAtStr]);

  const baseCls = cn(
    "mt-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium flex items-center gap-2 flex-wrap",
    mine ? "bg-white/10 border-white/20 text-white/95" : "bg-card border-border text-foreground",
    resolved && (mine ? "bg-emerald-500/20 border-emerald-300/40" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"),
    atrasado && !resolved && (mine ? "bg-red-500/20 border-red-300/40" : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"),
  );

  return (
    <div className={baseCls} title={target ? `Prazo: ${target.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : undefined}>
      <Hash className="h-3 w-3 shrink-0 opacity-80" />
      <span className="font-mono tracking-tight">{protocolo}</span>
      <span className="ml-auto inline-flex items-center gap-1 tabular-nums">
        {resolved ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            Resolvido
            {resolutionMs !== null && (
              <span className="inline-flex items-center gap-1 ml-1 opacity-90">
                <Timer className="h-3 w-3" /> em {formatDuration(resolutionMs)}
              </span>
            )}
          </>
        ) : target ? (
          atrasado ? (
            <>
              <AlertTriangle className="h-3 w-3" />
              Atrasado {parts!.h}h {parts!.m.toString().padStart(2, "0")}m
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              {parts!.h.toString().padStart(2, "0")}:{parts!.m.toString().padStart(2, "0")}:{parts!.s.toString().padStart(2, "0")}
            </>
          )
        ) : null}
      </span>
    </div>
  );
}

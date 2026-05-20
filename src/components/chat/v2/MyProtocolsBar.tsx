import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Hash, Clock, CheckCircle2, AlertTriangle, Reply, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const SUPORTE_CONV_ID = "3daf9772-404f-42f4-adbf-8a2566d91870";
const BOT_USER_ID = "1ee5b9de-4864-475f-9602-ee039197e46e";

interface Protocolo {
  ticketId: string;
  protocolo: string;
  status: string;
  resolvedAt: string | null;
  prazoEm: string | null;
  mensagemId: string;
  conteudo: string;
  createdAt: string;
}

function formatProto(ticketId: string, createdAt: string) {
  const d = new Date(createdAt);
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `RR-${ymd}-${ticketId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function countdown(target: Date, now: Date) {
  const ms = target.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  return { atrasado: ms < 0, h, m };
}

function formatDur(ms: number) {
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor((abs % 86_400_000) / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

interface Props {
  conversaId: string;
}

export function MyProtocolsBar({ conversaId }: Props) {
  const { user } = useAuth();
  const uid = user?.id;
  const [open, setOpen] = useState(false);
  const [filtro, setFiltro] = useState<"abertos" | "finalizados">("abertos");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  const enabled = !!uid && conversaId === SUPORTE_CONV_ID;

  const { data: protocolos = [] } = useQuery({
    queryKey: ["meus-protocolos-suporte", uid],
    enabled,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Protocolo[]> => {
      const { data: tickets } = await supabase
        .from("suporte_tickets")
        .select("id, status, resolved_at, created_at, prazo_resposta_em")
        .eq("owner_id", uid!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!tickets?.length) return [];

      const ticketIds = tickets.map((t: any) => t.id);
      const { data: msgs } = await supabase
        .from("mensagens")
        .select("id, ticket_id, conteudo, created_at, metadata")
        .eq("conversa_id", SUPORTE_CONV_ID)
        .eq("remetente_id", BOT_USER_ID)
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: false });

      const lastByTicket = new Map<string, any>();
      (msgs ?? []).forEach((m: any) => {
        if (!lastByTicket.has(m.ticket_id)) lastByTicket.set(m.ticket_id, m);
      });

      return tickets
        .map((t: any) => {
          const msg = lastByTicket.get(t.id);
          if (!msg) return null;
          return {
            ticketId: t.id,
            protocolo: msg.metadata?.protocolo ?? formatProto(t.id, t.created_at),
            status: t.status,
            resolvedAt: t.resolved_at,
            prazoEm: msg.metadata?.prazo_em ?? t.prazo_resposta_em ?? null,
            mensagemId: msg.id,
            conteudo: String(msg.conteudo ?? "").slice(0, 120),
            createdAt: t.created_at,
          } as Protocolo;
        })
        .filter(Boolean) as Protocolo[];
    },
  });

  const abertos = useMemo(() => protocolos.filter((p) => !p.resolvedAt && p.status !== "resolvido"), [protocolos]);
  const finalizados = useMemo(() => protocolos.filter((p) => p.resolvedAt || p.status === "resolvido"), [protocolos]);
  const lista = filtro === "abertos" ? abertos : finalizados;

  if (!enabled || protocolos.length === 0) return null;

  const responder = (p: Protocolo) => {
    window.dispatchEvent(new CustomEvent("suporte:reply-protocolo", {
      detail: { mensagemId: p.mensagemId, protocolo: p.protocolo },
    }));
    const el = document.getElementById(`msg-${p.mensagemId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center gap-2 text-xs hover:bg-muted/50 transition-colors"
      >
        <Hash className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Meus protocolos</span>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {abertos.length} em aberto
        </Badge>
        {finalizados.length > 0 && (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {finalizados.length} finalizados
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-2.5 space-y-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={filtro === "abertos" ? "default" : "ghost"}
              className="h-6 text-[11px] px-2"
              onClick={() => setFiltro("abertos")}
            >
              Em aberto ({abertos.length})
            </Button>
            <Button
              size="sm"
              variant={filtro === "finalizados" ? "default" : "ghost"}
              className="h-6 text-[11px] px-2"
              onClick={() => setFiltro("finalizados")}
            >
              Finalizados ({finalizados.length})
            </Button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {lista.length === 0 && (
              <div className="text-center py-4 text-[11px] text-muted-foreground">
                Nenhum protocolo nesta categoria.
              </div>
            )}
            {lista.map((p) => {
              const resolved = !!p.resolvedAt || p.status === "resolvido";
              const target = p.prazoEm ? new Date(p.prazoEm) : null;
              const cd = target && !resolved ? countdown(target, now) : null;
              return (
                <div
                  key={p.ticketId}
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-[11px]"
                >
                  <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-mono font-medium tracking-tight shrink-0">{p.protocolo}</span>
                  <span className="truncate text-muted-foreground flex-1">{p.conteudo}</span>
                  {resolved ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 className="h-3 w-3" /> Resolvido
                    </span>
                  ) : cd ? (
                    <span className={cn(
                      "inline-flex items-center gap-1 shrink-0 tabular-nums",
                      cd.atrasado ? "text-red-600 dark:text-red-400" : "text-foreground",
                    )}>
                      {cd.atrasado ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {cd.atrasado ? `Atrasado ${cd.h}h${String(cd.m).padStart(2, "0")}` : `${cd.h}h${String(cd.m).padStart(2, "0")}`}
                    </span>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[10px] shrink-0"
                    onClick={() => responder(p)}
                  >
                    <Reply className="h-3 w-3 mr-1" /> Responder
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

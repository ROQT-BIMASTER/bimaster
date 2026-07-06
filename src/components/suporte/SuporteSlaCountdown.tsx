import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pause, Play, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SuporteChamado } from "@/hooks/suporte/types";

interface Props {
  ticket: SuporteChamado;
}

/** Chip com contagem regressiva de SLA + botão pausar/retomar. */
export function SuporteSlaCountdown({ ticket }: Props) {
  const qc = useQueryClient();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const pausar = useMutation({
    mutationFn: async () => {
      const motivo = window.prompt("Motivo da pausa (opcional):") ?? undefined;
      const { error } = await (supabase.rpc as any)("rpc_suporte_pausar_sla", {
        p_ticket_id: ticket.id,
        p_motivo: motivo ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte"] });
      toast.success("SLA pausado");
    },
    onError: (e: Error) => toast.error("Falha ao pausar", { description: e.message }),
  });

  const retomar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as any)("rpc_suporte_retomar_sla", {
        p_ticket_id: ticket.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte"] });
      toast.success("SLA retomado");
    },
    onError: (e: Error) => toast.error("Falha ao retomar", { description: e.message }),
  });

  const pausado = !!ticket.sla_pausado_em || ticket.sla_status === "pausado";
  const prazo = ticket.primeira_resposta_em
    ? ticket.prazo_resolucao_em
    : ticket.prazo_primeira_resposta_em;

  const restanteMs = prazo ? new Date(prazo).getTime() - now : null;
  const label = ticket.primeira_resposta_em ? "Resolução" : "1ª resposta";

  let cls = "bg-muted text-muted-foreground";
  let texto = "SLA —";
  if (pausado) {
    cls = "bg-muted text-muted-foreground";
    texto = "SLA pausado";
  } else if (ticket.status === "resolvido") {
    cls =
      ticket.sla_status === "violado"
        ? "bg-red-500/10 text-red-700 border-red-500/20"
        : "bg-green-500/10 text-green-700 border-green-500/20";
    texto = ticket.sla_status === "violado" ? "SLA violado" : "SLA cumprido";
  } else if (restanteMs !== null) {
    if (restanteMs <= 0) {
      cls = "bg-red-500/10 text-red-700 border-red-500/20";
      texto = `${label}: atrasado ${formatDur(Math.abs(restanteMs))}`;
    } else if (restanteMs < 60 * 60_000) {
      cls = "bg-orange-500/10 text-orange-700 border-orange-500/20";
      texto = `${label} em ${formatDur(restanteMs)}`;
    } else {
      cls = "bg-blue-500/10 text-blue-700 border-blue-500/20";
      texto = `${label} em ${formatDur(restanteMs)}`;
    }
  }

  const podeAlternar = ticket.status !== "resolvido";

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Badge variant="outline" className={`text-[10px] gap-1 ${cls}`}>
        <Clock className="h-3 w-3" /> {texto}
      </Badge>
      {podeAlternar && !pausado && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1 text-xs"
          disabled={pausar.isPending}
          onClick={() => pausar.mutate()}
        >
          <Pause className="h-3 w-3" /> Pausar
        </Button>
      )}
      {podeAlternar && pausado && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1 text-xs"
          disabled={retomar.isPending}
          onClick={() => retomar.mutate()}
        >
          <Play className="h-3 w-3" /> Retomar
        </Button>
      )}
    </div>
  );
}

function formatDur(ms: number) {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m ? `${h}h ${m}min` : `${h}h`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return hr ? `${d}d ${hr}h` : `${d}d`;
}

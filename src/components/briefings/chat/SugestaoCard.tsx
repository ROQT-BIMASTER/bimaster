import { useState } from "react";
import { CheckCircle2, XCircle, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface SugestaoBriefing {
  id: string;
  campo: string;
  sugestao: string;
  justificativa?: string | null;
  valor_atual?: string | null;
  status?: "pendente" | "aceita" | "rejeitada";
}

interface Props {
  sugestao: SugestaoBriefing;
  campoLabel?: string;
  onDecided?: () => void;
}

export function SugestaoCard({ sugestao, campoLabel, onDecided }: Props) {
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState(sugestao.status ?? "pendente");

  const decidir = async (acao: "aceita" | "rejeitada") => {
    setBusy(true);
    try {
      const fn = acao === "aceita"
        ? "rpc_aceitar_sugestao_briefing"
        : "rpc_rejeitar_sugestao_briefing";
      const { error } = await supabase.rpc(fn as any, { p_sugestao_id: sugestao.id });
      if (error) throw error;
      setLocalStatus(acao);
      toast.success(acao === "aceita" ? "Sugestão aplicada ao canvas" : "Sugestão descartada");
      onDecided?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao decidir sugestão");
    } finally {
      setBusy(false);
    }
  };

  const decidida = localStatus !== "pendente";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 space-y-2.5 text-sm",
        decidida && "opacity-70",
      )}
    >
      <div className="flex items-center gap-2 text-xs">
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-medium uppercase tracking-wide text-muted-foreground">
          Sugestão da IA
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-foreground font-medium">{campoLabel ?? sugestao.campo}</span>
        {decidida && (
          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium",
              localStatus === "aceita"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            {localStatus === "aceita" ? "Aplicada" : "Mantido atual"}
          </span>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-primary font-semibold mb-1">
            Opção 1 — Sugestão
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">{sugestao.sugestao}</p>
        </div>
        <div className="rounded-md border bg-muted/40 p-2.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
            Opção 2 — Manter atual
          </div>
          <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">
            {sugestao.valor_atual?.trim() || "(campo vazio)"}
          </p>
        </div>
      </div>

      {sugestao.justificativa && (
        <p className="text-xs text-muted-foreground italic">
          <span className="font-medium not-italic">Por quê: </span>
          {sugestao.justificativa}
        </p>
      )}

      {!decidida && (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={() => decidir("aceita")} disabled={busy} className="h-7 text-xs">
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
            Aplicar sugestão
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => decidir("rejeitada")}
            disabled={busy}
            className="h-7 text-xs"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Manter atual
          </Button>
        </div>
      )}
    </div>
  );
}

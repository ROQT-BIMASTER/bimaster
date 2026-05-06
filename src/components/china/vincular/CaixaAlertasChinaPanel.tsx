import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, AlertCircle, CheckCircle2, RefreshCw, X } from "lucide-react";
import { useChinaAlertas, useDispensarAlerta, useRecalcularAlertas } from "@/hooks/useDespacharGranular";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  submissaoId: string;
}

const SEV_COLOR: Record<string, string> = {
  critica: "border-destructive/40 bg-destructive/10 text-destructive",
  alta: "border-warning/40 bg-warning/10 text-warning",
  media: "border-border bg-muted/30 text-foreground",
  baixa: "border-border bg-muted/20 text-muted-foreground",
};

export function CaixaAlertasChinaPanel({ submissaoId }: Props) {
  const { data: alertas = [], isLoading } = useChinaAlertas(submissaoId);
  const dispensar = useDispensarAlerta();
  const recalcular = useRecalcularAlertas();
  const qc = useQueryClient();

  useEffect(() => {
    // Recalcula ao montar
    recalcular.mutate(submissaoId);
    // Realtime
    const ch = supabase
      .channel(`alertas-${submissaoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "china_doc_alertas", filter: `submissao_id=eq.${submissaoId}` },
        () => qc.invalidateQueries({ queryKey: ["china-doc-alertas"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissaoId]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs font-semibold">Caixa de alertas</span>
          <Badge variant="outline" className="text-[10px]">{alertas.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-6 gap-1 text-[11px]" onClick={() => recalcular.mutate(submissaoId)}>
          <RefreshCw className="h-3 w-3" />
          Recalcular
        </Button>
      </div>

      {isLoading ? (
        <p className="text-[11px] text-muted-foreground">Carregando alertas...</p>
      ) : alertas.length === 0 ? (
        <div className="flex items-center gap-2 rounded border border-success/30 bg-success/10 px-2 py-1.5 text-[11px] text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Nenhuma pendência detectada.
        </div>
      ) : (
        <ScrollArea className="max-h-60">
          <ul className="space-y-1">
            {alertas.map((a: any) => (
              <li key={a.id} className={`flex items-start gap-2 rounded border px-2 py-1.5 text-[11px] ${SEV_COLOR[a.severidade] ?? SEV_COLOR.media}`}>
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="leading-snug">{a.mensagem}</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wider opacity-70">{a.tipo} · {a.severidade}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => dispensar.mutate(a.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

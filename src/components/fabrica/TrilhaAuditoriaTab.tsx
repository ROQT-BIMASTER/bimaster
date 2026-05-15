import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Send, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";

interface AuditEntry {
  id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string | null;
  user_nome: string | null;
  detalhes: any;
  created_at: string;
}

const acaoMeta: Record<string, { label: string; icon: any; className: string }> = {
  submissao: { label: "Submetido para aprovação", icon: Send, className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  aprovacao: { label: "Aprovada", icon: CheckCircle2, className: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/30" },
  revisao_solicitada: { label: "Revisão solicitada", icon: AlertTriangle, className: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30" },
  cancelamento_aprovacao: { label: "Aprovação cancelada", icon: RotateCcw, className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  reabertura: { label: "Reaberta", icon: RotateCcw, className: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30" },
};

export function TrilhaAuditoriaTab({ revisaoId }: { revisaoId: string }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("fabrica_ficha_revisoes_audit_log" as any)
      .select("id, acao, status_anterior, status_novo, user_nome, detalhes, created_at")
      .eq("revisao_id", revisaoId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setLogs((data || []) as any);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [revisaoId]);

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (logs.length === 0) {
    return <div className="text-center py-8 text-muted-foreground text-sm">Sem eventos registrados.</div>;
  }

  return (
    <ScrollArea className="max-h-[360px]">
      <div className="space-y-2">
        {logs.map((e) => {
          const meta = acaoMeta[e.acao] || { label: e.acao, icon: ShieldCheck, className: "bg-muted text-muted-foreground" };
          const Icon = meta.icon;
          return (
            <div key={e.id} className={`p-3 border rounded-lg ${meta.className}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium">{meta.label}</span>
                  {e.detalhes?.versao != null && (
                    <Badge variant="outline" className="text-[10px]">v{e.detalhes.versao}</Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(e.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-xs mt-1 text-foreground/80">
                <span className="font-medium">{e.user_nome || "—"}</span>
                {e.detalhes?.parecer && <span className="text-muted-foreground"> · {String(e.detalhes.parecer).slice(0, 120)}</span>}
              </p>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Upload, ShieldCheck, Download, Star, RotateCcw, FileText, ArrowRight, Sparkles, Loader2, History,
} from "lucide-react";
import { toast } from "sonner";

const ACTION_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  upload: { icon: Upload, label: "Upload", color: "text-blue-400" },
  revisao: { icon: RotateCcw, label: "Revisão", color: "text-amber-400" },
  aprovacao: { icon: ShieldCheck, label: "Aprovação", color: "text-emerald-400" },
  rejeicao: { icon: RotateCcw, label: "Rejeição", color: "text-destructive" },
  publicacao_cofre: { icon: FileText, label: "Publicado no Cofre", color: "text-primary" },
  download: { icon: Download, label: "Download", color: "text-muted-foreground" },
  versao_oficial: { icon: Star, label: "Versão Oficial", color: "text-amber-500" },
  status_change: { icon: ArrowRight, label: "Mudança de Status", color: "text-purple-400" },
};

interface AuditTimelineProps {
  produtoId?: string;
  projetoId?: string;
  tarefaId?: string;
  maxItems?: number;
}

export function AuditTimeline({ produtoId, projetoId, tarefaId, maxItems = 30 }: AuditTimelineProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["audit-timeline", produtoId, projetoId, tarefaId],
    queryFn: async () => {
      let query = supabase
        .from("produto_doc_audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(maxItems);

      if (produtoId) query = query.eq("produto_id", produtoId);
      if (projetoId) query = query.eq("projeto_id", projetoId);

      const { data } = await query;
      return (data || []) as any[];
    },
    enabled: !!(produtoId || projetoId),
  });

  const handleAISummary = async () => {
    if (auditLogs.length === 0) return;
    setLoadingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("projeto-ia-assistant", {
        body: {
          action: "summarize_audit",
          context: {
            logs: auditLogs.slice(0, 20).map((l: any) => ({
              acao: l.acao,
              user_name: l.user_name,
              created_at: l.created_at,
              detalhes: l.detalhes,
            })),
          },
        },
      });
      if (error) throw error;
      setAiSummary(data?.summary || data?.result || "Não foi possível gerar o resumo.");
    } catch {
      toast.error("Erro ao gerar resumo com IA.");
    } finally {
      setLoadingSummary(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (auditLogs.length === 0) {
    return (
      <div className="text-center py-6">
        <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Nenhuma atividade registrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <History className="h-4 w-4" />
          Timeline de Auditoria
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] gap-1"
          onClick={handleAISummary}
          disabled={loadingSummary}
        >
          {loadingSummary ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Resumir com IA
        </Button>
      </div>

      {aiSummary && (
        <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-xs text-foreground/90">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-primary">Resumo IA</span>
          </div>
          <p className="whitespace-pre-wrap">{aiSummary}</p>
        </div>
      )}

      <ScrollArea className="max-h-[300px]">
        <div className="relative">
          <div className="absolute left-[9px] top-3 bottom-3 w-0.5 bg-border/40" />
          <div className="space-y-0">
            {auditLogs.map((log: any) => {
              const config = ACTION_CONFIG[log.acao] || { icon: FileText, label: log.acao, color: "text-muted-foreground" };
              const IconComp = config.icon;
              const detalhes = log.detalhes || {};

              return (
                <div key={log.id} className="relative flex gap-3 py-2">
                  <div className="relative z-10 flex-shrink-0 mt-0.5">
                    <div className="h-5 w-5 rounded-full bg-background border border-border/50 flex items-center justify-center">
                      <IconComp className={cn("h-3 w-3", config.color)} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                        {config.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground/80 mt-0.5">
                      <span className="font-medium">{log.user_name}</span>
                      {detalhes.nome_arquivo && <span> · {detalhes.nome_arquivo}</span>}
                      {detalhes.from && detalhes.to && (
                        <span> · {detalhes.from} → {detalhes.to}</span>
                      )}
                      {detalhes.justificativa && (
                        <span className="text-muted-foreground italic"> — "{detalhes.justificativa}"</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

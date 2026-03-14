import { CheckCircle2, XCircle, AlertTriangle, Eye } from "lucide-react";
import { CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { formatLocalDate } from "@/utils/dateUtils";
import type { Revisao } from "@/hooks/useChinaRevisoes";

interface Props {
  revisoes: Revisao[];
}

const ICONS: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  aprovado: { icon: CheckCircle2, color: "text-success" },
  ciencia: { icon: Eye, color: "text-success" },
  rejeitado: { icon: XCircle, color: "text-destructive" },
  contestado: { icon: AlertTriangle, color: "text-warning" },
};

export function ChinaAprovacaoTimeline({ revisoes }: Props) {
  if (revisoes.length === 0) return null;

  const getDocLabel = (docId: string) => {
    // We don't have doc tipo here easily, so show generic
    return docId.substring(0, 8);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Histórico de Ações 操作历史
      </p>
      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
        {revisoes.map(r => {
          const cfg = ICONS[r.resultado] || ICONS.aprovado;
          const Icon = cfg.icon;
          const acaoLabel = r.acao_tipo || r.resultado;

          return (
            <div key={r.id} className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-accent/10 transition-colors">
              <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
              <div className="flex-1 min-w-0 text-xs">
                <span className="font-medium text-foreground">
                  {r.acao_por_nome || "Usuário"}
                </span>
                <span className="text-muted-foreground">
                  {" "}{acaoLabel === "ciencia" ? "deu ciência em" : acaoLabel === "aprovado" ? "aprovou" : acaoLabel === "rejeitado" ? "rejeitou" : "contestou"}{" "}
                </span>
                {r.motivo_rejeicao && (
                  <span className="text-muted-foreground italic"> — "{r.motivo_rejeicao.substring(0, 60)}"</span>
                )}
                {r.contestacao_texto && (
                  <span className="text-muted-foreground italic"> — "{r.contestacao_texto.substring(0, 60)}"</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatLocalDate(r.created_at, "dd/MM HH:mm")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

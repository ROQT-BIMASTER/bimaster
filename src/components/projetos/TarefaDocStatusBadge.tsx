/**
 * TarefaDocStatusBadge — selo de situação administrativa dos documentos
 * vinculados a uma tarefa, exibido no card do quadro (Kanban).
 */
import { Check, Clock, FileWarning, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DECISAO_LABEL } from "@/lib/china/docStatus";
import type { TarefaDocStatus } from "@/hooks/useTarefasDocStatus";

const TONE: Record<string, { light: string; dark: string; icon: typeof Check }> = {
  aprovado: {
    light: "bg-emerald-100 text-emerald-900",
    dark: "bg-emerald-500/20 text-emerald-200",
    icon: Check,
  },
  em_analise: {
    light: "bg-amber-100 text-amber-900",
    dark: "bg-amber-500/20 text-amber-200",
    icon: Clock,
  },
  rejeitado: {
    light: "bg-rose-100 text-rose-900",
    dark: "bg-rose-500/20 text-rose-200",
    icon: XCircle,
  },
  pendente: {
    light: "bg-muted text-muted-foreground",
    dark: "bg-white/10 text-white/70",
    icon: FileWarning,
  },
};

interface Props {
  status?: TarefaDocStatus;
  darkBg?: boolean;
}

export function TarefaDocStatusBadge({ status, darkBg = false }: Props) {
  if (!status) return null;
  const tone = TONE[status.decisao] || TONE.pendente;
  const Icon = tone.icon;
  const sufixo =
    status.total > 1 ? ` (${status.aprovados}/${status.total})` : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
        darkBg ? tone.dark : tone.light,
      )}
      title={`Documentos da submissão: ${DECISAO_LABEL[status.decisao]}${sufixo}`}
    >
      <Icon className="h-3 w-3" />
      {DECISAO_LABEL[status.decisao]}
      {sufixo}
    </span>
  );
}

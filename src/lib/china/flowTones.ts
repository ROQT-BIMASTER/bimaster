/**
 * flowTones — tokens visuais compartilhados para fluxos visuais (n8n-like)
 * usados na Caixa de Entrada China e potencialmente em outros módulos
 * (Controladoria já tem o mesmo conceito embutido em ProdutoWorkflowDrawer).
 *
 * Mantém quatro tons semânticos:
 *  - done  : etapa concluída (verde)
 *  - prog  : em andamento / aguardando análise (amarelo)
 *  - block : bloqueado / devolvido (rosa)
 *  - idle  : ainda não iniciado (cinza)
 */
import { Check, Circle, Clock, AlertTriangle, Upload } from "lucide-react";

export type FlowTone = "done" | "prog" | "block" | "idle";

export interface FlowToneConfig {
  ring: string;
  border: string;
  bg: string;
  text: string;
  icon: typeof Check;
  label: string;
}

export const FLOW_TONE: Record<FlowTone, FlowToneConfig> = {
  done: {
    ring: "ring-emerald-500/30",
    border: "border-emerald-500/60",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
    icon: Check,
    label: "Concluído",
  },
  prog: {
    ring: "ring-amber-500/30",
    border: "border-amber-500/60",
    bg: "bg-amber-500/10",
    text: "text-amber-600",
    icon: Clock,
    label: "Em andamento",
  },
  block: {
    ring: "ring-rose-500/30",
    border: "border-rose-500/60",
    bg: "bg-rose-500/10",
    text: "text-rose-600",
    icon: AlertTriangle,
    label: "Devolvido",
  },
  idle: {
    ring: "ring-slate-400/20",
    border: "border-border",
    bg: "bg-muted/40",
    text: "text-muted-foreground",
    icon: Circle,
    label: "Pendente",
  },
};

/** Mapeia bucket visual (do MailboxKanban) para o tom do fluxo. */
export type FlowBucket =
  | "aprovado"
  | "em_analise"
  | "enviado"
  | "pendente"
  | "rejeitado"
  | "nao_criado";

export function bucketToTone(bucket: FlowBucket): FlowTone {
  switch (bucket) {
    case "aprovado":
      return "done";
    case "em_analise":
    case "enviado":
      return "prog";
    case "rejeitado":
      return "block";
    case "pendente":
    case "nao_criado":
    default:
      return "idle";
  }
}

export const BUCKET_LABEL: Record<FlowBucket, string> = {
  aprovado: "aprovado",
  em_analise: "em análise",
  enviado: "enviado ao Brasil",
  pendente: "pendente",
  rejeitado: "devolvido",
  nao_criado: "não criado",
};

/** Ícone específico do bucket — sobrescreve o ícone do tom quando útil. */
export function iconForBucket(bucket: FlowBucket): typeof Check {
  if (bucket === "enviado") return Upload;
  return FLOW_TONE[bucketToTone(bucket)].icon;
}

/** Deriva o bucket visual a partir do doc_status persistido. */
export function bucketForDoc(d: { doc_status?: string | null } | null | undefined): FlowBucket {
  if (!d) return "nao_criado";
  const s = (d.doc_status || "").toLowerCase();
  if (s === "aprovado") return "aprovado";
  if (s === "rejeitado") return "rejeitado";
  if (s === "contestado") return "em_analise";
  if (s === "enviado" || s === "enviado_brasil") return "enviado";
  if (s === "pendente") return "em_analise";
  if (s === "rascunho") return "pendente";
  return "pendente";
}


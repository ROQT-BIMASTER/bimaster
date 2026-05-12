import {
  FileText,
  FilePlus2,
  FileCheck2,
  FileX2,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Factory,
  Hammer,
  PackageCheck,
  Ship,
  Container,
  PackageOpen,
  PackageSearch,
  AlertTriangle,
  CheckCircle2,
  Activity,
  type LucideIcon,
} from "lucide-react";

export interface KindConfig {
  label: string;
  icon: LucideIcon;
  /** Tailwind utility for icon background tint */
  tint: string;
  group: "submissao" | "documento" | "governanca" | "oc" | "producao" | "embarque" | "recebimento" | "nc" | "chat";
}

export const KIND_CONFIG: Record<string, KindConfig> = {
  submissao_criada: { label: "Submissão criada", icon: FilePlus2, tint: "bg-primary/15 text-primary", group: "submissao" },
  submissao_status: { label: "Submissão", icon: Activity, tint: "bg-primary/10 text-primary", group: "submissao" },

  documento_anexado: { label: "Documento anexado", icon: FileText, tint: "bg-muted text-foreground", group: "documento" },
  documento_status: { label: "Documento", icon: FileCheck2, tint: "bg-muted text-foreground", group: "documento" },
  parecer_china: { label: "Parecer China", icon: MessageSquare, tint: "bg-warning/15 text-warning", group: "documento" },

  waiver_aplicado: { label: "Waiver aplicado", icon: ShieldAlert, tint: "bg-warning/15 text-warning", group: "governanca" },
  liberada_para_oc: { label: "Liberada para OC", icon: ShieldCheck, tint: "bg-success/15 text-success", group: "governanca" },

  oc_emitida: { label: "OC emitida", icon: ShoppingCart, tint: "bg-blue-500/15 text-blue-600", group: "oc" },
  oc_status: { label: "OC", icon: ShoppingCart, tint: "bg-blue-500/10 text-blue-600", group: "oc" },

  op_criada: { label: "OP criada", icon: Factory, tint: "bg-purple-500/15 text-purple-600", group: "producao" },
  apontamento_producao: { label: "Apontamento", icon: Hammer, tint: "bg-purple-500/10 text-purple-600", group: "producao" },

  pronto_embarque: { label: "Pronto p/ embarque", icon: PackageCheck, tint: "bg-amber-500/15 text-amber-600", group: "embarque" },
  embarque_criado: { label: "Embarque criado", icon: Ship, tint: "bg-cyan-500/15 text-cyan-600", group: "embarque" },
  embarque_status: { label: "Embarque", icon: Ship, tint: "bg-cyan-500/10 text-cyan-600", group: "embarque" },
  container_evento: { label: "Container", icon: Container, tint: "bg-cyan-500/10 text-cyan-600", group: "embarque" },

  recebimento_iniciado: { label: "Recebimento", icon: PackageOpen, tint: "bg-emerald-500/15 text-emerald-600", group: "recebimento" },
  recebimento_status: { label: "Recebimento", icon: PackageSearch, tint: "bg-emerald-500/10 text-emerald-600", group: "recebimento" },

  nc_aberta: { label: "NC aberta", icon: AlertTriangle, tint: "bg-destructive/15 text-destructive", group: "nc" },
  nc_status: { label: "NC", icon: CheckCircle2, tint: "bg-destructive/10 text-destructive", group: "nc" },

  chat_mensagem: { label: "Mensagem", icon: MessageSquare, tint: "bg-muted text-foreground", group: "chat" },
};

export const DEFAULT_KIND: KindConfig = {
  label: "Evento",
  icon: Activity,
  tint: "bg-muted text-foreground",
  group: "submissao",
};

export function kindConfig(kind: string): KindConfig {
  return KIND_CONFIG[kind] || DEFAULT_KIND;
}

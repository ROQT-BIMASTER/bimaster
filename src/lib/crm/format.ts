import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Instagram, Facebook, Globe, Mail, Phone, HelpCircle, type LucideIcon } from "lucide-react";

export type CrmStatus =
  | "open" | "pending" | "assigned" | "closed"
  | "in_progress" | "resolved"
  | "low" | "normal" | "high" | "urgent";

export const statusLabel: Record<string, string> = {
  open: "Aberta", pending: "Pendente", assigned: "Atribuída", closed: "Fechada",
  in_progress: "Em andamento", resolved: "Resolvida",
  low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente",
};

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "open": return "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400";
    case "assigned": return "bg-violet-500/15 text-violet-600 border-violet-500/30 dark:text-violet-400";
    case "pending": return "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400";
    case "in_progress": return "bg-indigo-500/15 text-indigo-600 border-indigo-500/30 dark:text-indigo-400";
    case "resolved": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400";
    case "closed": return "bg-muted text-muted-foreground border-border";
    case "urgent": return "bg-destructive/15 text-destructive border-destructive/30";
    case "high": return "bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400";
    case "low": return "bg-slate-500/15 text-slate-600 border-slate-500/30 dark:text-slate-400";
    case "normal":
    default: return "bg-secondary text-secondary-foreground border-border";
  }
}

export function channelIcon(canal: string): LucideIcon {
  switch (canal) {
    case "whatsapp": return MessageSquare;
    case "instagram": return Instagram;
    case "messenger": return Facebook;
    case "webchat": return Globe;
    case "email": return Mail;
    case "voz": return Phone;
    default: return HelpCircle;
  }
}

export function relativeTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

export function slaPercent(dueAt: string | null | undefined, startedAt: string | null | undefined): number | null {
  if (!dueAt || !startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(dueAt).getTime();
  const now = Date.now();
  const total = end - start;
  if (total <= 0) return 0;
  const remaining = end - now;
  return Math.max(0, Math.min(100, (remaining / total) * 100));
}

export function slaColor(pct: number | null): string {
  if (pct === null) return "bg-muted text-muted-foreground";
  if (pct <= 0) return "bg-destructive/15 text-destructive border-destructive/30";
  if (pct < 20) return "bg-destructive/10 text-destructive border-destructive/20";
  if (pct < 50) return "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400";
  return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400";
}

export function formatMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

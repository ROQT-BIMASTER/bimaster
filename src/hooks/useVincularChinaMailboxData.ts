import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SubmissaoRow } from "@/components/china/VincularChinaTable";

export type VincularFolder =
  | "todas"
  | "nao_vinculadas"
  | "vinculadas"
  | "rascunho"
  | "enviado"
  | "em_revisao"
  | "aprovado"
  | "enviado_brasil"
  | "rejeitado"
  | "pendencias"
  | "estrelados"
  | "snoozed";

export interface VincularFolderCounts {
  todas: number;
  nao_vinculadas: number;
  vinculadas: number;
  rascunho: number;
  enviado: number;
  em_revisao: number;
  aprovado: number;
  enviado_brasil: number;
  rejeitado: number;
  pendencias: number;
  estrelados: number;
  snoozed: number;
}

const ZERO: VincularFolderCounts = {
  todas: 0,
  nao_vinculadas: 0,
  vinculadas: 0,
  rascunho: 0,
  enviado: 0,
  em_revisao: 0,
  aprovado: 0,
  enviado_brasil: 0,
  rejeitado: 0,
  pendencias: 0,
  estrelados: 0,
  snoozed: 0,
};

export interface MailboxRow extends SubmissaoRow {
  is_flagged: boolean;
  snooze_until: string | null;
}

export function useVincularChinaUserState() {
  const flags = useQuery({
    queryKey: ["vincular-china-flags"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new Set<string>();
      const { data } = await (supabase
        .from("china_submissao_user_flags" as any)
        .select("submissao_id")
        .eq("usuario_id", user.id) as any);
      return new Set<string>(((data || []) as any[]).map((r) => r.submissao_id));
    },
    staleTime: 30_000,
  });

  const snoozes = useQuery({
    queryKey: ["vincular-china-snoozes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new Map<string, string>();
      const { data } = await (supabase
        .from("china_inbox_snooze" as any)
        .select("submissao_id, snooze_until")
        .eq("usuario_id", user.id) as any);
      const m = new Map<string, string>();
      ((data || []) as any[]).forEach((r) => m.set(r.submissao_id, r.snooze_until));
      return m;
    },
    staleTime: 30_000,
  });

  return { flags: flags.data ?? new Set<string>(), snoozes: snoozes.data ?? new Map<string, string>() };
}

export function classifyVincularRows(rows: SubmissaoRow[], flags: Set<string>, snoozes: Map<string, string>) {
  const now = Date.now();
  const enriched: MailboxRow[] = rows.map((r) => {
    const sn = snoozes.get(r.id);
    const stillSnoozed = sn ? new Date(sn).getTime() > now : false;
    return {
      ...r,
      is_flagged: flags.has(r.id),
      snooze_until: stillSnoozed ? sn! : null,
    };
  });

  const counts: VincularFolderCounts = { ...ZERO, todas: enriched.length };
  for (const r of enriched) {
    if (r.snooze_until) counts.snoozed++;
    if (r.is_flagged) counts.estrelados++;
    if (r.isLinked) counts.vinculadas++;
    else counts.nao_vinculadas++;
    if ((r.pendencias ?? 0) > 0) counts.pendencias++;
    switch (r.status) {
      case "rascunho": counts.rascunho++; break;
      case "enviado": counts.enviado++; break;
      case "em_revisao": counts.em_revisao++; break;
      case "aprovado": counts.aprovado++; break;
      case "enviado_brasil": counts.enviado_brasil++; break;
      case "rejeitado": counts.rejeitado++; break;
    }
  }

  return { rows: enriched, counts };
}

export function filterByFolder(rows: MailboxRow[], folder: VincularFolder): MailboxRow[] {
  switch (folder) {
    case "todas": return rows.filter((r) => !r.snooze_until);
    case "nao_vinculadas": return rows.filter((r) => !r.isLinked && !r.snooze_until);
    case "vinculadas": return rows.filter((r) => r.isLinked && !r.snooze_until);
    case "pendencias": return rows.filter((r) => (r.pendencias ?? 0) > 0 && !r.snooze_until);
    case "estrelados": return rows.filter((r) => r.is_flagged);
    case "snoozed": return rows.filter((r) => !!r.snooze_until);
    default: return rows.filter((r) => r.status === folder && !r.snooze_until);
  }
}

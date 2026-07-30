/**
 * Preferências de notificação por tipo de mudança de situação dos documentos
 * da China. Cada usuário controla, por situação e por papel (responsável ou
 * supervisor), se deseja receber o aviso. Ausência de registro = ativo.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type NotifStatus = "em_analise" | "pendente" | "aprovado" | "rejeitado" | "reaberto";
export type NotifPapel = "responsavel" | "supervisor";

export const NOTIF_STATUS_ORDEM: NotifStatus[] = [
  "em_analise",
  "pendente",
  "aprovado",
  "rejeitado",
  "reaberto",
];

export const NOTIF_STATUS_LABEL: Record<NotifStatus, string> = {
  em_analise: "Em análise",
  pendente: "Pendente de aprovação",
  aprovado: "Aprovado",
  rejeitado: "Não aprovado",
  reaberto: "Reaberto para nova análise",
};

export const NOTIF_PAPEL_LABEL: Record<NotifPapel, string> = {
  responsavel: "Como responsável",
  supervisor: "Como supervisor",
};

export type NotifPrefMap = Record<string, boolean>;

export const prefKey = (status: NotifStatus, papel: NotifPapel) => `${status}:${papel}`;

const QK = ["china-doc-notif-prefs"];

export function useChinaDocNotifPrefs() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<NotifPrefMap> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return {};
      const { data, error } = await supabase
        .from("china_doc_notif_prefs" as any)
        .select("status, papel, enabled")
        .eq("user_id", uid);
      if (error) throw error;
      const map: NotifPrefMap = {};
      (data as any[] | null)?.forEach((r) => {
        map[prefKey(r.status as NotifStatus, r.papel as NotifPapel)] = !!r.enabled;
      });
      return map;
    },
    staleTime: 60_000,
  });
}

export function useSalvarChinaDocNotifPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (map: NotifPrefMap) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada.");
      const rows = NOTIF_STATUS_ORDEM.flatMap((status) =>
        (["responsavel", "supervisor"] as NotifPapel[]).map((papel) => ({
          user_id: uid,
          status,
          papel,
          enabled: map[prefKey(status, papel)] !== false,
        })),
      );
      const { error } = await supabase
        .from("china_doc_notif_prefs" as any)
        .upsert(rows as any, { onConflict: "user_id,status,papel" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast.success("Preferências de notificação salvas.");
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível salvar as preferências."),
  });
}

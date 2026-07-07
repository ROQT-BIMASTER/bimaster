import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type PapelEtapa = "responsavel" | "seguidor" | "escalonado";

export interface EtapaPapelRow {
  id: string;
  etapa_id: string;
  user_id: string;
  papel: PapelEtapa;
  descritivo_atividades?: string | null;
  profile?: { nome: string | null; avatar_url: string | null } | null;
}

export function useEtapaPapeis(etapaId: string | null | undefined) {
  return useQuery<EtapaPapelRow[]>({
    queryKey: ["etapa-papeis", etapaId],
    enabled: !!etapaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_etapa_responsaveis")
        .select("id, etapa_id, user_id, papel, descritivo_atividades")
        .eq("etapa_id", etapaId!);
      if (error) throw error;
      const rows = (data ?? []) as EtapaPapelRow[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) return rows;
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", ids);
      const byId = new Map<string, { nome: string | null; avatar_url: string | null }>();
      for (const p of profiles ?? []) byId.set(p.id, { nome: p.nome, avatar_url: p.avatar_url });
      return rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
    },
  });
}


export function useAddEtapaPapel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { etapa_id: string; user_id: string; papel: PapelEtapa }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("processo_etapa_responsaveis").insert({
        etapa_id: p.etapa_id,
        user_id: p.user_id,
        papel: p.papel,
        criado_por: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["etapa-papeis", v.etapa_id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao adicionar papel"),
  });
}

export function useRemoveEtapaPapel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; etapa_id: string }) => {
      const { error } = await (supabase as any)
        .from("processo_etapa_responsaveis")
        .delete()
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["etapa-papeis", v.etapa_id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover papel"),
  });
}
export function useSalvarDescritivoAtividades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; etapa_id: string; descritivo_atividades: string }) => {
      const { error } = await (supabase as any)
        .from("processo_etapa_responsaveis")
        .update({ descritivo_atividades: p.descritivo_atividades })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["etapa-papeis", v.etapa_id] });
      toast.success("Descritivo salvo");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar descritivo"),
  });
}


export function useSalvarParecerEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { etapa_id: string; parecer_administrativo: string }) => {
      const { error } = await (supabase as any)
        .from("processo_etapas")
        .update({ parecer_administrativo: p.parecer_administrativo })
        .eq("id", p.etapa_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processo"] });
      toast.success("Parecer salvo");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar parecer"),
  });
}

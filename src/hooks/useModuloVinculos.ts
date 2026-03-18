import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ModuloType = "composicao" | "amostras" | "analise_embalagem" | "etiqueta_bula" | "fluxo_artes" | "aprovacao_artes" | "ficha_china";

export interface ModuloVinculo {
  id: string;
  modulo: string;
  registro_id: string;
  projeto_id: string;
  secao_id: string | null;
  tarefa_id: string | null;
  created_by: string | null;
  created_at: string;
  // joined
  projeto_nome?: string;
  secao_nome?: string;
  tarefa_titulo?: string;
}

export const MODULO_LABELS: Record<string, { label: string; icon: string; route: string }> = {
  composicao: { label: "Composição INCI", icon: "🧪", route: "/dashboard/composicao" },
  amostras: { label: "Amostras", icon: "📦", route: "/dashboard/amostras" },
  analise_embalagem: { label: "Análise Embalagem", icon: "📦", route: "/dashboard/embalagem" },
  etiqueta_bula: { label: "Etiqueta / Bula", icon: "🏷️", route: "/dashboard/etiqueta-bula" },
  fluxo_artes: { label: "Motor de Artes", icon: "🎨", route: "/dashboard/fluxo-artes" },
  aprovacao_artes: { label: "Aprovação de Artes", icon: "✅", route: "/dashboard/aprovacao-artes" },
  ficha_china: { label: "Ficha do Produto China", icon: "📋", route: "/dashboard/fabrica-china/recebimentos" },
};

export function useVinculosDoRegistro(modulo: ModuloType, registroId: string | undefined) {
  return useQuery({
    queryKey: ["modulo-vinculos", modulo, registroId],
    enabled: !!registroId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulo_projeto_vinculos" as any)
        .select("*")
        .eq("modulo", modulo)
        .eq("registro_id", registroId!);
      if (error) throw error;

      const vinculos = (data || []) as any[];
      if (vinculos.length === 0) return [];

      // Enrich with names
      const projetoIds = [...new Set(vinculos.map(v => v.projeto_id))];
      const secaoIds = [...new Set(vinculos.map(v => v.secao_id).filter(Boolean))];
      const tarefaIds = [...new Set(vinculos.map(v => v.tarefa_id).filter(Boolean))];

      const [projRes, secRes, tarRes] = await Promise.all([
        supabase.from("projetos").select("id, nome").in("id", projetoIds),
        secaoIds.length > 0 ? supabase.from("projeto_secoes").select("id, nome").in("id", secaoIds) : { data: [] },
        tarefaIds.length > 0 ? supabase.from("projeto_tarefas").select("id, titulo").in("id", tarefaIds) : { data: [] },
      ]);

      const projMap = Object.fromEntries((projRes.data || []).map(p => [p.id, p.nome]));
      const secMap = Object.fromEntries(((secRes as any).data || []).map((s: any) => [s.id, s.nome]));
      const tarMap = Object.fromEntries(((tarRes as any).data || []).map((t: any) => [t.id, t.titulo]));

      return vinculos.map(v => ({
        ...v,
        projeto_nome: projMap[v.projeto_id] || "—",
        secao_nome: v.secao_id ? secMap[v.secao_id] || "—" : null,
        tarefa_titulo: v.tarefa_id ? tarMap[v.tarefa_id] || "—" : null,
      })) as ModuloVinculo[];
    },
  });
}

export function useVinculosDaTarefa(tarefaId: string | undefined) {
  return useQuery({
    queryKey: ["modulo-vinculos-tarefa", tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulo_projeto_vinculos" as any)
        .select("*")
        .eq("tarefa_id", tarefaId!);
      if (error) throw error;
      return (data || []) as unknown as ModuloVinculo[];
    },
  });
}

export function useCreateModuloVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { modulo: ModuloType; registro_id: string; projeto_id: string; secao_id?: string; tarefa_id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("modulo_projeto_vinculos" as any)
        .insert({
          modulo: params.modulo,
          registro_id: params.registro_id,
          projeto_id: params.projeto_id,
          secao_id: params.secao_id || null,
          tarefa_id: params.tarefa_id || null,
          created_by: user?.id,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["modulo-vinculos"] });
      qc.invalidateQueries({ queryKey: ["modulo-vinculos-tarefa"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar vínculo"),
  });
}

export function useDeleteModuloVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("modulo_projeto_vinculos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo removido.");
      qc.invalidateQueries({ queryKey: ["modulo-vinculos"] });
      qc.invalidateQueries({ queryKey: ["modulo-vinculos-tarefa"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover vínculo"),
  });
}

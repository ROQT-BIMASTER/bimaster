import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FichaVisibilidade {
  id: string;
  submissao_id: string;
  user_id: string;
  pode_despachar: boolean;
  concedido_por: string | null;
  created_at: string;
  // joined
  user_nome?: string;
  user_email?: string;
}

export function useFichaVisibilidade(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["ficha-visibilidade", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_ficha_visibilidade" as any)
        .select("*")
        .eq("submissao_id", submissaoId!);
      if (error) throw error;

      const items = (data || []) as any[];
      if (items.length === 0) return [];

      const userIds = [...new Set(items.map((i: any) => i.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);

      const profileMap = Object.fromEntries(
        (profiles || []).map((p: any) => [p.id, p])
      );

      return items.map((i: any) => ({
        ...i,
        user_nome: profileMap[i.user_id]?.nome || "—",
        user_email: profileMap[i.user_id]?.email || "",
      })) as FichaVisibilidade[];
    },
  });
}

export function useAddFichaVisibilidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { submissao_id: string; user_id: string; pode_despachar?: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("china_ficha_visibilidade" as any)
        .insert({
          submissao_id: params.submissao_id,
          user_id: params.user_id,
          pode_despachar: params.pode_despachar ?? false,
          concedido_por: user?.id,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso concedido!");
      qc.invalidateQueries({ queryKey: ["ficha-visibilidade"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao conceder acesso"),
  });
}

export function useRemoveFichaVisibilidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("china_ficha_visibilidade" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acesso removido.");
      qc.invalidateQueries({ queryKey: ["ficha-visibilidade"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover acesso"),
  });
}

export function useFichaDespachos(submissaoId: string | undefined) {
  return useQuery({
    queryKey: ["ficha-despachos", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_ficha_despachos" as any)
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const items = (data || []) as any[];
      if (items.length === 0) return [];

      const userIds = [...new Set([
        ...items.map((i: any) => i.despachado_por).filter(Boolean),
        ...items.map((i: any) => i.usuario_destino_id).filter(Boolean),
      ])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", userIds);
      const profileMap = Object.fromEntries(
        (profiles || []).map((p: any) => [p.id, p.nome_completo])
      );

      return items.map((i: any) => ({
        ...i,
        despachado_por_nome: profileMap[i.despachado_por] || "—",
        usuario_destino_nome: profileMap[i.usuario_destino_id] || null,
      }));
    },
  });
}

export function useCreateFichaDespacho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      submissao_id: string;
      modulo_destino: string;
      usuario_destino_id?: string;
      observacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("china_ficha_despachos" as any)
        .insert({
          submissao_id: params.submissao_id,
          modulo_destino: params.modulo_destino,
          usuario_destino_id: params.usuario_destino_id || null,
          observacao: params.observacao || null,
          despachado_por: user?.id,
        } as any);
      if (error) throw error;

      // Auto-grant visibility if dispatching to a specific user
      if (params.usuario_destino_id) {
        await supabase
          .from("china_ficha_visibilidade" as any)
          .upsert({
            submissao_id: params.submissao_id,
            user_id: params.usuario_destino_id,
            pode_despachar: false,
            concedido_por: user?.id,
          } as any, { onConflict: "submissao_id,user_id" });
      }
    },
    onSuccess: () => {
      toast.success("Ficha despachada com sucesso!");
      qc.invalidateQueries({ queryKey: ["ficha-despachos"] });
      qc.invalidateQueries({ queryKey: ["ficha-visibilidade"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao despachar ficha"),
  });
}

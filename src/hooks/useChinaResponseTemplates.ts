import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ResponseTemplate {
  id: string;
  usuario_id: string | null;
  tipo: "aprovar" | "rejeitar";
  titulo: string;
  conteudo: string;
  conteudo_cn: string | null;
  ordem: number;
}

export function useResponseTemplates(tipo?: "aprovar" | "rejeitar") {
  return useQuery({
    queryKey: ["china-response-templates", tipo ?? "all"],
    queryFn: async () => {
      let q = (supabase.from("china_response_templates" as any) as any)
        .select("*")
        .order("usuario_id", { ascending: true, nullsFirst: false })
        .order("ordem", { ascending: true });
      if (tipo) q = q.eq("tipo", tipo);
      const { data, error } = await q;
      if (error) throw error;
      return ((data || []) as any[]) as ResponseTemplate[];
    },
    staleTime: 60_000,
  });
}

export function useSaveResponseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      tipo: "aprovar" | "rejeitar";
      titulo: string;
      conteudo: string;
      conteudo_cn?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const payload = {
        usuario_id: user.id,
        tipo: input.tipo,
        titulo: input.titulo,
        conteudo: input.conteudo,
        conteudo_cn: input.conteudo_cn ?? null,
      };
      if (input.id) {
        const { error } = await (supabase.from("china_response_templates" as any) as any)
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("china_response_templates" as any) as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-response-templates"] });
      toast.success("Modelo salvo");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar modelo"),
  });
}

export function useDeleteResponseTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("china_response_templates" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-response-templates"] });
      toast.success("Modelo removido");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover modelo"),
  });
}

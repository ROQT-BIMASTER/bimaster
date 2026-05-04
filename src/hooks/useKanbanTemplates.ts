import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ColunasConfig } from "./useKanbanPreferencias";

export type KanbanTemplateEscopo = "pessoal" | "equipe" | "departamento" | "sistema";

export type ResponsavelTipo = "user" | "papel" | "departamento";

export interface EtapaResponsavel {
  coluna_key: string;
  etapa_label: string;
  responsavel_id: string | null;
  responsavel_tipo: ResponsavelTipo;
  sla_horas?: number | null;
}

export interface KanbanTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  escopo: KanbanTemplateEscopo;
  departamento_id: string | null;
  equipe_ids: string[];
  projeto_id: string | null;
  owner_id: string | null;
  colunas_config: ColunasConfig;
  etapas_responsaveis: EtapaResponsavel[];
  is_padrao: boolean;
  created_at: string;
  updated_at: string;
}

export type KanbanTemplateInput = Partial<
  Omit<KanbanTemplate, "id" | "created_at" | "updated_at" | "owner_id">
> & {
  nome: string;
};

export function useKanbanTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["kanban-templates"],
    enabled: !!user?.id,
    queryFn: async (): Promise<KanbanTemplate[]> => {
      const { data, error } = await supabase
        .from("kanban_templates" as any)
        .select("*")
        .order("escopo", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as KanbanTemplate[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: KanbanTemplateInput & { id?: string }) => {
      if (!user?.id) throw new Error("não autenticado");
      const row = {
        ...payload,
        owner_id: user.id,
      };
      if (payload.id) {
        const { error } = await supabase
          .from("kanban_templates" as any)
          .update(row)
          .eq("id", payload.id);
        if (error) throw error;
        return payload.id;
      }
      const { data, error } = await supabase
        .from("kanban_templates" as any)
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban-templates"] });
      toast.success("Template salvo");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao salvar template"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("kanban_templates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban-templates"] });
      toast.success("Template removido");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao remover"),
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("rpc_duplicar_kanban_template" as any, {
        _template_id: id,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban-templates"] });
      toast.success("Template duplicado");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao duplicar"),
  });

  return { list, save, remove, duplicate };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FieldVisibilityRule {
  id: string;
  departamento_controlador_id: string;
  departamento_alvo_id: string;
  tela_codigo: string;
  campo_codigo: string;
  visivel: boolean;
  editavel: boolean;
  configurado_por: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook para verificar visibilidade de campos para o departamento do usuário atual.
 * Campos sem regra explícita são visíveis por padrão.
 */
export function useFieldVisibility(telaCodigo: string) {
  const { session } = useAuth();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["field-visibility", telaCodigo, session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      // Get user's department
      const { data: profile } = await supabase
        .from("profiles")
        .select("departamento_id")
        .eq("id", session.user.id)
        .single();

      if (!profile?.departamento_id) return [];

      const { data, error } = await supabase
        .from("departamento_campo_visibilidade")
        .select("*")
        .eq("departamento_alvo_id", profile.departamento_id)
        .eq("tela_codigo", telaCodigo);

      if (error) {
        console.error("Error fetching field visibility:", error);
        return [];
      }

      return (data || []) as FieldVisibilityRule[];
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const isFieldVisible = (campoCodigo: string): boolean => {
    const rule = rules.find(r => r.campo_codigo === campoCodigo);
    return rule ? rule.visivel : true; // default visible
  };

  const isFieldEditable = (campoCodigo: string): boolean => {
    const rule = rules.find(r => r.campo_codigo === campoCodigo);
    return rule ? rule.editavel : true; // default editable
  };

  return {
    isFieldVisible,
    isFieldEditable,
    rules,
    isLoading,
  };
}

/**
 * Hook para gerenciar regras de visibilidade (usado pelo painel admin/dept manager).
 */
export function useFieldVisibilityManagement(
  departamentoControladorId: string,
  departamentoAlvoId: string
) {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["field-visibility-management", departamentoControladorId, departamentoAlvoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departamento_campo_visibilidade")
        .select("*")
        .eq("departamento_controlador_id", departamentoControladorId)
        .eq("departamento_alvo_id", departamentoAlvoId)
        .order("tela_codigo")
        .order("campo_codigo");

      if (error) throw error;
      return (data || []) as FieldVisibilityRule[];
    },
    enabled: !!departamentoControladorId && !!departamentoAlvoId,
  });

  const upsertRule = useMutation({
    mutationFn: async (rule: {
      tela_codigo: string;
      campo_codigo: string;
      visivel: boolean;
      editavel: boolean;
    }) => {
      const existing = rules.find(
        r => r.tela_codigo === rule.tela_codigo && r.campo_codigo === rule.campo_codigo
      );

      // Audit log
      await supabase.from("departamento_visibilidade_audit").insert({
        campo_visibilidade_id: existing?.id || null,
        departamento_alvo_id: departamentoAlvoId,
        tela_codigo: rule.tela_codigo,
        campo_codigo: rule.campo_codigo,
        acao: existing ? "update" : "create",
        valor_anterior: existing ? { visivel: existing.visivel, editavel: existing.editavel } : null,
        valor_novo: { visivel: rule.visivel, editavel: rule.editavel },
        alterado_por: session?.user?.id,
      });

      if (existing) {
        const { error } = await supabase
          .from("departamento_campo_visibilidade")
          .update({
            visivel: rule.visivel,
            editavel: rule.editavel,
            configurado_por: session?.user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("departamento_campo_visibilidade")
          .insert({
            departamento_controlador_id: departamentoControladorId,
            departamento_alvo_id: departamentoAlvoId,
            tela_codigo: rule.tela_codigo,
            campo_codigo: rule.campo_codigo,
            visivel: rule.visivel,
            editavel: rule.editavel,
            configurado_por: session?.user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["field-visibility-management", departamentoControladorId, departamentoAlvoId],
      });
    },
  });

  return {
    rules,
    isLoading,
    upsertRule,
  };
}

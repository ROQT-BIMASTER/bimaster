import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CorrectionRule {
  id: string;
  name: string;
  is_active: boolean;
  lock_supplier_name: boolean;
  lock_supplier_document: boolean;
  lock_document_type: boolean;
  lock_document_number: boolean;
  lock_due_date: boolean;
  lock_portador: boolean;
  lock_attachments: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CorrectionLocks {
  supplier_name: boolean;
  supplier_document: boolean;
  document_type: boolean;
  document_number: boolean;
  due_date: boolean;
  portador: boolean;
  attachments: boolean;
}

const DEFAULT_LOCKS: CorrectionLocks = {
  supplier_name: true,
  supplier_document: true,
  document_type: false,
  document_number: false,
  due_date: false,
  portador: false,
  attachments: false,
};

export function useActiveCorrectionRule() {
  return useQuery({
    queryKey: ["active-correction-rule"],
    queryFn: async (): Promise<CorrectionRule | null> => {
      const { data, error } = await (supabase
        .from("financial_correction_rules") as any)
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as CorrectionRule | null;
    },
  });
}

export function getCorrectionLocks(rule: CorrectionRule | null | undefined): CorrectionLocks {
  if (!rule) return DEFAULT_LOCKS;
  return {
    supplier_name: rule.lock_supplier_name,
    supplier_document: rule.lock_supplier_document,
    document_type: rule.lock_document_type,
    document_number: rule.lock_document_number,
    due_date: rule.lock_due_date,
    portador: rule.lock_portador,
    attachments: rule.lock_attachments,
  };
}

export function useFinancialCorrectionRules() {
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ["financial-correction-rules"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("financial_correction_rules") as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as CorrectionRule[];
    },
  });

  const createRule = useMutation({
    mutationFn: async (input: Partial<CorrectionRule>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Deactivate existing active rules
      await (supabase
        .from("financial_correction_rules") as any)
        .update({ is_active: false })
        .eq("is_active", true);

      const { data, error } = await (supabase
        .from("financial_correction_rules") as any)
        .insert({
          ...input,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-correction-rules"] });
      queryClient.invalidateQueries({ queryKey: ["active-correction-rule"] });
      toast.success("Regra de correção criada!");
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<CorrectionRule>) => {
      const { data, error } = await (supabase
        .from("financial_correction_rules") as any)
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-correction-rules"] });
      queryClient.invalidateQueries({ queryKey: ["active-correction-rule"] });
      toast.success("Regra atualizada!");
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("financial_correction_rules") as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-correction-rules"] });
      queryClient.invalidateQueries({ queryKey: ["active-correction-rule"] });
      toast.success("Regra removida!");
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (is_active) {
        await (supabase
          .from("financial_correction_rules") as any)
          .update({ is_active: false })
          .eq("is_active", true);
      }

      const { data, error } = await (supabase
        .from("financial_correction_rules") as any)
        .update({ is_active })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-correction-rules"] });
      queryClient.invalidateQueries({ queryKey: ["active-correction-rule"] });
      toast.success("Regra atualizada!");
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  return {
    rules: rulesQuery.data ?? [],
    isLoading: rulesQuery.isLoading,
    createRule,
    updateRule,
    deleteRule,
    toggleActive,
  };
}

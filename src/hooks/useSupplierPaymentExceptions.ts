import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getDayName,
  getDayNameShort,
  formatCutoffTime,
  getNextCutoffDate,
  getNextPaymentDate,
  type FinancialPaymentPolicy,
} from "./useFinancialPaymentPolicies";

export interface SupplierPaymentException {
  id: string;
  supplier_id: string;
  name: string;
  cutoff_day_of_week: number;
  cutoff_time: string;
  payment_day_of_week: number;
  allows_exceptions: boolean;
  exception_requires_approval: boolean;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  supplier?: {
    razao_social: string;
    cnpj: string | null;
  };
}

export interface CreateSupplierExceptionInput {
  supplier_id: string;
  name: string;
  cutoff_day_of_week: number;
  cutoff_time: string;
  payment_day_of_week: number;
  allows_exceptions: boolean;
  exception_requires_approval: boolean;
  description?: string;
}

export function useSupplierPaymentExceptions() {
  const queryClient = useQueryClient();

  const exceptionsQuery = useQuery({
    queryKey: ["supplier-payment-exceptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_payment_exceptions")
        .select("*, supplier:fabrica_fornecedores(razao_social, cnpj)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as SupplierPaymentException[];
    },
  });

  const createException = useMutation({
    mutationFn: async (input: CreateSupplierExceptionInput) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Deactivate existing exception for this supplier
      await supabase
        .from("supplier_payment_exceptions")
        .update({ is_active: false })
        .eq("supplier_id", input.supplier_id)
        .eq("is_active", true);

      const { data, error } = await supabase
        .from("supplier_payment_exceptions")
        .insert({
          ...input,
          is_active: true,
          created_by: user.id,
        })
        .select("*, supplier:fabrica_fornecedores(razao_social, cnpj)")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-payment-exceptions"] });
      toast.success("Exceção de fornecedor criada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar exceção: ${error.message}`);
    },
  });

  const toggleException = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from("supplier_payment_exceptions")
        .update({ is_active })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-payment-exceptions"] });
      toast.success("Exceção atualizada!");
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteException = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("supplier_payment_exceptions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-payment-exceptions"] });
      toast.success("Exceção removida!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  return {
    exceptions: exceptionsQuery.data ?? [],
    isLoading: exceptionsQuery.isLoading,
    createException,
    toggleException,
    deleteException,
  };
}

/**
 * Get the active exception for a specific supplier, if any.
 */
export function useSupplierException(supplierId: string | undefined) {
  return useQuery({
    queryKey: ["supplier-payment-exception", supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<SupplierPaymentException | null> => {
      const { data, error } = await supabase
        .from("supplier_payment_exceptions")
        .select("*, supplier:fabrica_fornecedores(razao_social, cnpj)")
        .eq("supplier_id", supplierId!)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data as SupplierPaymentException | null;
    },
  });
}

/**
 * Convert a SupplierPaymentException to a FinancialPaymentPolicy-compatible object
 * for reuse with existing date calculation utilities.
 */
export function exceptionAsPolicy(exception: SupplierPaymentException): FinancialPaymentPolicy {
  return {
    id: exception.id,
    name: exception.name,
    cutoff_day_of_week: exception.cutoff_day_of_week,
    cutoff_time: exception.cutoff_time,
    payment_day_of_week: exception.payment_day_of_week,
    allows_exceptions: exception.allows_exceptions,
    exception_requires_approval: exception.exception_requires_approval,
    description: exception.description,
    is_active: exception.is_active,
    created_by: exception.created_by,
    created_at: exception.created_at,
    updated_at: exception.updated_at,
  };
}

export function getExceptionSummary(exception: SupplierPaymentException): string {
  const cutoffDay = getDayNameShort(exception.cutoff_day_of_week);
  const cutoffTime = formatCutoffTime(exception.cutoff_time);
  const paymentDay = getDayNameShort(exception.payment_day_of_week);
  return `Corte: ${cutoffDay} ${cutoffTime} — Pagamento: ${paymentDay}`;
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addDays, setDay, setHours, setMinutes, isAfter, isBefore, startOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface FinancialPaymentPolicy {
  id: string;
  name: string;
  cutoff_day_of_week: number;
  cutoff_time: string; // "HH:mm:ss"
  payment_day_of_week: number;
  allows_exceptions: boolean;
  exception_requires_approval: boolean;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePolicyInput {
  name: string;
  cutoff_day_of_week: number;
  cutoff_time: string;
  payment_day_of_week: number;
  allows_exceptions: boolean;
  exception_requires_approval: boolean;
  description?: string;
}

const DAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const DAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function getDayName(day: number): string {
  return DAY_NAMES[day] || "";
}

export function getDayNameShort(day: number): string {
  return DAY_NAMES_SHORT[day] || "";
}

export function formatCutoffTime(time: string): string {
  // "18:00:00" -> "18:00"
  return time?.substring(0, 5) || "18:00";
}

/**
 * Given a policy, calculate the next cutoff date/time from now.
 */
export function getNextCutoffDate(policy: FinancialPaymentPolicy): Date {
  const now = new Date();
  const [hours, minutes] = policy.cutoff_time.split(":").map(Number);
  
  // Get this week's cutoff day
  let cutoffDate = setDay(now, policy.cutoff_day_of_week, { weekStartsOn: 0 });
  cutoffDate = setHours(cutoffDate, hours);
  cutoffDate = setMinutes(cutoffDate, minutes);
  
  // If the cutoff is already past, move to next week
  if (isAfter(now, cutoffDate)) {
    cutoffDate = addDays(cutoffDate, 7);
  }
  
  return cutoffDate;
}

/**
 * Given a policy, calculate the next payment date from now.
 */
export function getNextPaymentDate(policy: FinancialPaymentPolicy): Date {
  const cutoffDate = getNextCutoffDate(policy);
  
  // Payment date is the payment_day_of_week after the cutoff
  let paymentDate = setDay(cutoffDate, policy.payment_day_of_week, { weekStartsOn: 0 });
  paymentDate = startOfDay(paymentDate);
  
  // If payment day is before or same as cutoff day, it's next week
  if (isBefore(paymentDate, cutoffDate) || paymentDate.getTime() === cutoffDate.getTime()) {
    paymentDate = addDays(paymentDate, 7);
  }
  
  return paymentDate;
}

/**
 * Check if a submission right now is within the cutoff window.
 */
export function isWithinCutoff(policy: FinancialPaymentPolicy): boolean {
  const now = new Date();
  const [hours, minutes] = policy.cutoff_time.split(":").map(Number);
  
  const currentDay = now.getDay();
  
  // Build the range: from payment_day_of_week (start of cycle) to cutoff_day + cutoff_time
  // Simple check: is today before or on cutoff day, and if on cutoff day, before cutoff time?
  if (currentDay < policy.cutoff_day_of_week) {
    return true;
  }
  if (currentDay === policy.cutoff_day_of_week) {
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    return currentHours < hours || (currentHours === hours && currentMinutes <= minutes);
  }
  return false;
}

/**
 * Get a human-readable summary of the policy.
 */
export function getPolicySummary(policy: FinancialPaymentPolicy): string {
  const cutoffDay = getDayNameShort(policy.cutoff_day_of_week);
  const cutoffTime = formatCutoffTime(policy.cutoff_time);
  const paymentDay = getDayNameShort(policy.payment_day_of_week);
  
  return `Lançamentos até ${cutoffDay} ${cutoffTime} — Pagamento na ${paymentDay}`;
}

/**
 * Get the formatted next payment date string.
 */
export function getNextPaymentDateFormatted(policy: FinancialPaymentPolicy): string {
  const date = getNextPaymentDate(policy);
  return format(date, "EEEE, dd/MM/yyyy", { locale: ptBR });
}

// ======================== HOOKS ========================

export function useActivePaymentPolicy() {
  return useQuery({
    queryKey: ["active-payment-policy"],
    queryFn: async (): Promise<FinancialPaymentPolicy | null> => {
      const { data, error } = await supabase
        .from("financial_payment_policies")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as FinancialPaymentPolicy | null;
    },
  });
}

export function useFinancialPaymentPolicies() {
  const queryClient = useQueryClient();

  const policiesQuery = useQuery({
    queryKey: ["financial-payment-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_payment_policies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as FinancialPaymentPolicy[];
    },
  });

  const createPolicy = useMutation({
    mutationFn: async (input: CreatePolicyInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Deactivate all existing policies first
      await supabase
        .from("financial_payment_policies")
        .update({ is_active: false })
        .eq("is_active", true);

      const { data, error } = await supabase
        .from("financial_payment_policies")
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
      queryClient.invalidateQueries({ queryKey: ["financial-payment-policies"] });
      queryClient.invalidateQueries({ queryKey: ["active-payment-policy"] });
      toast.success("Política de pagamento criada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar política: ${error.message}`);
    },
  });

  const updatePolicy = useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<CreatePolicyInput>) => {
      const { data, error } = await supabase
        .from("financial_payment_policies")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-payment-policies"] });
      queryClient.invalidateQueries({ queryKey: ["active-payment-policy"] });
      toast.success("Política atualizada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar política: ${error.message}`);
    },
  });

  const togglePolicyActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // If activating, deactivate all others first
      if (is_active) {
        await supabase
          .from("financial_payment_policies")
          .update({ is_active: false })
          .eq("is_active", true);
      }

      const { data, error } = await supabase
        .from("financial_payment_policies")
        .update({ is_active })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-payment-policies"] });
      queryClient.invalidateQueries({ queryKey: ["active-payment-policy"] });
      toast.success("Política atualizada!");
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deletePolicy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_payment_policies")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-payment-policies"] });
      queryClient.invalidateQueries({ queryKey: ["active-payment-policy"] });
      toast.success("Política removida!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  return {
    policies: policiesQuery.data ?? [],
    isLoading: policiesQuery.isLoading,
    createPolicy,
    updatePolicy,
    togglePolicyActive,
    deletePolicy,
  };
}

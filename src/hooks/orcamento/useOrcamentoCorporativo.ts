import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractOrcamentoError } from "@/lib/orcamento/errors";
import type {
  AtribuirPerfilInput,
  CriarPeriodoInput,
  DistribuirVerbaInput,
  PlanoCategoriaInput,
} from "@/lib/validations/orcamento";

// ============================================================
// Categorias compartilhadas
// ============================================================
export function useOrcamentoCategorias() {
  return useQuery({
    queryKey: ["orcamento_categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamento_categorias")
        .select("id,nome,cor,ordem,ativo")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ============================================================
// Períodos orçamentários
// ============================================================
export function useBudgetPeriods() {
  return useQuery({
    queryKey: ["budget_periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_periods")
        .select(
          "id,nome,tipo,data_inicio,data_fim,valor_total_empresa,status,criado_por,observacao,created_at",
        )
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateBudgetPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarPeriodoInput) => {
      const { data, error } = await supabase.rpc("rpc_criar_periodo_orcamentario", {
        p_nome: input.nome,
        p_tipo: input.tipo,
        p_data_inicio: input.data_inicio,
        p_data_fim: input.data_fim,
        p_valor_total_empresa: input.valor_total_empresa,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_periods"] });
    },
    onError: (e) => {
      toast.error(extractOrcamentoError(e, "Falha ao criar período"));
    },
  });
}

// ============================================================
// Distribuições
// ============================================================
export function useBudgetDistributions(periodId: string | undefined) {
  return useQuery({
    queryKey: ["budget_distributions", periodId],
    enabled: Boolean(periodId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_distributions")
        .select(
          "id,period_id,department_id,valor_alocado,valor_reservado,status,aprovado_por,aprovado_em,observacao",
        )
        .eq("period_id", periodId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDistribuirVerba() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DistribuirVerbaInput) => {
      const { error } = await supabase.rpc("rpc_distribuir_verba", {
        p_period_id: input.period_id,
        p_alocacoes: input.alocacoes as unknown as never,
      });
      if (error) throw error;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ["budget_distributions", input.period_id] });
      qc.invalidateQueries({ queryKey: ["budget_distribution_kpis"] });
    },
    onError: (e) => {
      toast.error(extractOrcamentoError(e, "Falha ao distribuir verba"));
    },
  });
}

// ============================================================
// Plano de categorias
// ============================================================
export function useBudgetPlanCategories(distributionId: string | undefined) {
  return useQuery({
    queryKey: ["budget_plan_categories", distributionId],
    enabled: Boolean(distributionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_plan_categories")
        .select(
          "id,distribution_id,categoria_id,nome,valor_planejado,cor,is_reserva,ordem",
        )
        .eq("distribution_id", distributionId!)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertPlanCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlanoCategoriaInput) => {
      if (input.id) {
        const { error } = await supabase
          .from("budget_plan_categories")
          .update({
            categoria_id: input.categoria_id,
            nome: input.nome ?? null,
            valor_planejado: input.valor_planejado,
            cor: input.cor ?? null,
            is_reserva: input.is_reserva,
            ordem: input.ordem,
          })
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from("budget_plan_categories")
        .insert({
          distribution_id: input.distribution_id,
          categoria_id: input.categoria_id,
          nome: input.nome ?? null,
          valor_planejado: input.valor_planejado,
          cor: input.cor ?? null,
          is_reserva: input.is_reserva,
          ordem: input.ordem,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ["budget_plan_categories", input.distribution_id] });
      qc.invalidateQueries({ queryKey: ["budget_distribution_kpis", input.distribution_id] });
    },
    onError: (e) => {
      toast.error(extractOrcamentoError(e, "Falha ao salvar categoria"));
    },
  });
}

export function useDeletePlanCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; distribution_id: string }) => {
      const { error } = await supabase
        .from("budget_plan_categories")
        .delete()
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["budget_plan_categories", vars.distribution_id] });
      qc.invalidateQueries({ queryKey: ["budget_distribution_kpis", vars.distribution_id] });
    },
    onError: (e) => {
      toast.error(extractOrcamentoError(e, "Falha ao excluir categoria"));
    },
  });
}

// ============================================================
// KPIs
// ============================================================
export type BudgetDistributionKpis = {
  distribution_id: string;
  period_id: string;
  department_id: string;
  valor_alocado: number;
  valor_planejado: number;
  saldo_reservado: number;
  valor_comprometido: number;
  valor_utilizado: number;
  valor_pago: number;
  saldo_livre: number;
};

export function useBudgetKpis(distributionId: string | undefined) {
  return useQuery({
    queryKey: ["budget_distribution_kpis", distributionId],
    enabled: Boolean(distributionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_budget_distribution_kpis" as never)
        .select("*")
        .eq("distribution_id" as never, distributionId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as BudgetDistributionKpis | null;
    },
  });
}

// ============================================================
// Consumo (Fase 2) — chama fn_orcamento_saldos direto
// ============================================================
export type OrcamentoConsumoEstagio = "ok" | "alerta_80" | "critico_95" | "estourado_100";

export type OrcamentoConsumoRow = {
  distribution_id: string | null;
  period_id: string;
  department_id: string | null;
  department_nome: string | null;
  valor_alocado: number;
  valor_planejado: number;
  saldo_reservado: number;
  valor_comprometido: number;
  valor_utilizado: number;
  valor_pago: number;
  em_fila: number;
  saldo_livre: number;
  pct_consumido: number | null;
  estagio: OrcamentoConsumoEstagio;
};

export function useOrcamentoConsumo(periodId: string | undefined) {
  return useQuery({
    queryKey: ["orcamento_consumo", periodId],
    enabled: Boolean(periodId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_orcamento_saldos" as never, {
        p_period_id: periodId!,
      } as never);
      if (error) throw error;
      return ((data ?? []) as unknown as OrcamentoConsumoRow[]).map((r) => ({
        ...r,
        valor_alocado: Number(r.valor_alocado ?? 0),
        valor_planejado: Number(r.valor_planejado ?? 0),
        saldo_reservado: Number(r.saldo_reservado ?? 0),
        valor_comprometido: Number(r.valor_comprometido ?? 0),
        valor_utilizado: Number(r.valor_utilizado ?? 0),
        valor_pago: Number(r.valor_pago ?? 0),
        em_fila: Number(r.em_fila ?? 0),
        saldo_livre: Number(r.saldo_livre ?? 0),
        pct_consumido: r.pct_consumido == null ? null : Number(r.pct_consumido),
      }));
    },
  });
}

// ============================================================
// Perfis de departamento
// ============================================================
export function useDepartmentMemberRoles(departmentId: string | undefined) {
  return useQuery({
    queryKey: ["department_member_roles", departmentId],
    enabled: Boolean(departmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_member_roles")
        .select("id,department_id,user_id,perfil,created_at")
        .eq("department_id", departmentId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAtribuirPerfilDepartamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AtribuirPerfilInput) => {
      const { data, error } = await supabase.rpc("rpc_atribuir_perfil_departamento", {
        p_department_id: input.department_id,
        p_user_id: input.user_id,
        p_perfil: input.perfil,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, input) => {
      qc.invalidateQueries({ queryKey: ["department_member_roles", input.department_id] });
    },
    onError: (e) => {
      toast.error(extractOrcamentoError(e, "Falha ao atribuir perfil"));
    },
  });
}

export function useRemoverPerfilDepartamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; department_id: string }) => {
      const { error } = await supabase
        .from("department_member_roles")
        .delete()
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["department_member_roles", vars.department_id] });
    },
    onError: (e) => {
      toast.error(extractOrcamentoError(e, "Falha ao remover perfil"));
    },
  });
}

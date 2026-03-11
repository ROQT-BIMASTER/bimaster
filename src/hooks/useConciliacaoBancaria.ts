import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const invokeFunction = async (action: string, body: Record<string, any> = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const { data, error } = await supabase.functions.invoke("conciliacao-bancaria", {
    body: { action, ...body },
  });
  if (error) throw error;
  return data;
};

export function useConciliacaoBancaria(empresaId?: number | null) {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingConnectionId, setSyncingConnectionId] = useState<string | null>(null);

  const connectionsQuery = useQuery({
    queryKey: ["bank-connections", empresaId],
    queryFn: () => invokeFunction("list-connections", empresaId ? { empresaId } : {}),
  });

  const historyQuery = useQuery({
    queryKey: ["conciliacao-history"],
    queryFn: () => invokeFunction("history"),
  });

  const conciliacoesQuery = useQuery({
    queryKey: ["conciliacoes-bancarias", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("conciliacoes_bancarias")
        .select("*, bank_connections(banco, conta, empresa_id)")
        .order("data_transacao", { ascending: false })
        .limit(500);

      if (empresaId) {
        const connIds = (connectionsQuery.data?.connections || []).map((c: any) => c.id);
        if (connIds.length > 0) {
          query = query.in("bank_connection_id", connIds);
        } else {
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !empresaId || !!connectionsQuery.data,
  });

  const getConnectToken = async () => {
    try {
      const result = await invokeFunction("connect");
      return result.accessToken;
    } catch (err: any) {
      toast.error("Erro ao gerar token de conexão: " + err.message);
      throw err;
    }
  };

  const saveConnection = useMutation({
    mutationFn: (params: { itemId: string; banco: string; conta?: string; agencia?: string; empresaId?: number }) =>
      invokeFunction("save-connection", params),
    onSuccess: () => {
      toast.success("Conexão bancária salva!");
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
    },
    onError: (err: any) => toast.error("Erro ao salvar conexão: " + err.message),
  });

  const syncTransactions = async (connectionId: string, dateFrom?: string, dateTo?: string) => {
    setIsSyncing(true);
    setSyncingConnectionId(connectionId);
    try {
      const result = await invokeFunction("sync-transactions", { connectionId, dateFrom, dateTo });
      toast.success(
        `Sincronização concluída: ${result.conciliados} conciliados, ${result.pendentes} pendentes, ${result.divergentes} divergentes`
      );
      queryClient.invalidateQueries({ queryKey: ["conciliacoes-bancarias"] });
      queryClient.invalidateQueries({ queryKey: ["conciliacao-history"] });
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      queryClient.invalidateQueries({ queryKey: ["financial-stats"] });
      return result;
    } catch (err: any) {
      toast.error("Erro na sincronização: " + err.message);
      throw err;
    } finally {
      setIsSyncing(false);
      setSyncingConnectionId(null);
    }
  };

  const matchManual = useMutation({
    mutationFn: (params: { conciliacaoId: string; contaPagarId: string }) =>
      invokeFunction("match-manual", params),
    onSuccess: () => {
      toast.success("Conciliação manual realizada!");
      queryClient.invalidateQueries({ queryKey: ["conciliacoes-bancarias"] });
      queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
      queryClient.invalidateQueries({ queryKey: ["financial-stats"] });
    },
    onError: (err: any) => toast.error("Erro na conciliação manual: " + err.message),
  });

  const investmentsQuery = useQuery({
    queryKey: ["pluggy-investments", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("pluggy_investments")
        .select("*, bank_connections(banco, conta, empresa_id, empresas(id, nome, uf))")
        .order("balance", { ascending: false });

      if (empresaId) {
        const connIds = (connectionsQuery.data?.connections || []).map((c: any) => c.id);
        if (connIds.length > 0) {
          query = query.in("bank_connection_id", connIds);
        } else {
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !empresaId || !!connectionsQuery.data,
  });

  const syncInvestments = async (connectionId: string) => {
    try {
      const result = await invokeFunction("fetch-investments", { connectionId });
      toast.success(`${result.total} investimentos sincronizados`);
      queryClient.invalidateQueries({ queryKey: ["pluggy-investments"] });
      return result;
    } catch (err: any) {
      toast.error("Erro ao sincronizar investimentos: " + err.message);
      throw err;
    }
  };

  const fetchIdentity = async (connectionId: string) => {
    try {
      const result = await invokeFunction("fetch-identity", { connectionId });
      toast.success("Dados do titular sincronizados");
      queryClient.invalidateQueries({ queryKey: ["pluggy-identities"] });
      return result;
    } catch (err: any) {
      toast.error("Erro ao buscar identidade: " + err.message);
      throw err;
    }
  };

  const loansQuery = useQuery({
    queryKey: ["pluggy-loans", empresaId],
    queryFn: async () => {
      let query = supabase
        .from("pluggy_loans")
        .select("*, bank_connections(banco, conta, empresa_id, empresas(id, nome, uf))")
        .order("outstanding_balance", { ascending: false });

      if (empresaId) {
        const connIds = (connectionsQuery.data?.connections || []).map((c: any) => c.id);
        if (connIds.length > 0) {
          query = query.in("bank_connection_id", connIds);
        } else {
          return [];
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !empresaId || !!connectionsQuery.data,
  });

  const fetchCategories = async () => {
    try {
      return await invokeFunction("fetch-categories");
    } catch (err: any) {
      toast.error("Erro ao buscar categorias: " + err.message);
      throw err;
    }
  };

  const categoryRulesQuery = useQuery({
    queryKey: ["pluggy-category-rules"],
    queryFn: () => invokeFunction("list-category-rules"),
  });

  const createCategoryRule = useMutation({
    mutationFn: (params: { description: string; categoryId: string; categoryName?: string; contaContabilId?: string }) =>
      invokeFunction("create-category-rule", params),
    onSuccess: () => {
      toast.success("Regra de categorização criada!");
      queryClient.invalidateQueries({ queryKey: ["pluggy-category-rules"] });
    },
    onError: (err: any) => toast.error("Erro ao criar regra: " + err.message),
  });

  const deleteCategoryRule = useMutation({
    mutationFn: (ruleId: string) => invokeFunction("delete-category-rule", { ruleId }),
    onSuccess: () => {
      toast.success("Regra removida!");
      queryClient.invalidateQueries({ queryKey: ["pluggy-category-rules"] });
    },
    onError: (err: any) => toast.error("Erro ao remover regra: " + err.message),
  });

  const balanceAlertsQuery = useQuery({
    queryKey: ["balance-alerts"],
    queryFn: () => invokeFunction("list-balance-alerts"),
  });

  const manageBalanceAlert = useMutation({
    mutationFn: (params: { connectionId?: string; threshold?: number; alertId?: string; action?: string }) =>
      invokeFunction("manage-balance-alert", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["balance-alerts"] });
    },
    onError: (err: any) => toast.error("Erro ao gerenciar alerta: " + err.message),
  });

  const listConnectors = async (filters?: { name?: string; countries?: string; types?: string }) => {
    try {
      return await invokeFunction("list-connectors", filters || {});
    } catch (err: any) {
      toast.error("Erro ao listar conectores: " + err.message);
      throw err;
    }
  };

  const fetchAccounts = async (connectionId: string) => {
    try {
      const result = await invokeFunction("fetch-accounts", { connectionId });
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      queryClient.invalidateQueries({ queryKey: ["pluggy-loans"] });
      return result;
    } catch (err: any) {
      toast.error("Erro ao buscar contas: " + err.message);
      throw err;
    }
  };

  return {
    connections: connectionsQuery.data?.connections || [],
    connectionsLoading: connectionsQuery.isLoading,
    history: historyQuery.data?.uploads || [],
    historyLoading: historyQuery.isLoading,
    conciliacoes: conciliacoesQuery.data || [],
    conciliacoesLoading: conciliacoesQuery.isLoading,
    isSyncing,
    syncingConnectionId,
    getConnectToken,
    saveConnection,
    syncTransactions,
    matchManual,
    investments: investmentsQuery.data || [],
    investmentsLoading: investmentsQuery.isLoading,
    syncInvestments,
    fetchIdentity,
    loans: loansQuery.data || [],
    loansLoading: loansQuery.isLoading,
    fetchCategories,
    categoryRules: categoryRulesQuery.data?.rules || [],
    categoryRulesLoading: categoryRulesQuery.isLoading,
    createCategoryRule,
    deleteCategoryRule,
    balanceAlerts: balanceAlertsQuery.data?.alerts || [],
    balanceAlertsLoading: balanceAlertsQuery.isLoading,
    manageBalanceAlert,
    listConnectors,
    fetchAccounts,
  };
}

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

export function useConciliacaoBancaria() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const connectionsQuery = useQuery({
    queryKey: ["bank-connections"],
    queryFn: () => invokeFunction("list-connections"),
  });

  const historyQuery = useQuery({
    queryKey: ["conciliacao-history"],
    queryFn: () => invokeFunction("history"),
  });

  const conciliacoesQuery = useQuery({
    queryKey: ["conciliacoes-bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conciliacoes_bancarias")
        .select("*, bank_connections(banco, conta)")
        .order("data_transacao", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
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
    mutationFn: (params: { itemId: string; banco: string; conta?: string; agencia?: string }) =>
      invokeFunction("save-connection", params),
    onSuccess: () => {
      toast.success("Conexão bancária salva!");
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
    },
    onError: (err: any) => toast.error("Erro ao salvar conexão: " + err.message),
  });

  const syncTransactions = async (connectionId: string, dateFrom?: string, dateTo?: string) => {
    setIsSyncing(true);
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

  return {
    connections: connectionsQuery.data?.connections || [],
    connectionsLoading: connectionsQuery.isLoading,
    history: historyQuery.data?.uploads || [],
    historyLoading: historyQuery.isLoading,
    conciliacoes: conciliacoesQuery.data || [],
    conciliacoesLoading: conciliacoesQuery.isLoading,
    isSyncing,
    getConnectToken,
    saveConnection,
    syncTransactions,
    matchManual,
  };
}

/**
 * Hook de sincronização de Vendas (ConsultaPowerBI → public."Union").
 *
 * Espelha o padrão de useContasReceberSync / useContasPagarSync.
 *
 * Apenas leitura no banco local — todas as escritas ocorrem exclusivamente
 * via Edge Function `erp-sync-engine` (service_role). Nenhuma mutation
 * sobre `Union`/`vendas_union` deve ser feita pelo frontend.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export interface SyncResult {
  success: boolean;
  totalRows?: number;
  upserted?: number;
  pages?: number;
  stoppedByTimeGuard?: boolean;
  duration_ms?: number;
  error?: string;
  message?: string;
}

export interface SyncHistory {
  id: string;
  ultima_sync: string;
  total_registros: number;
  registros_inseridos: number;
  registros_atualizados: number;
  registros_ignorados: number;
  duracao_ms: number;
  status: string;
  erro_mensagem?: string;
  empresa_id?: number;
}

export interface VendasStats {
  totalRecords: number;
  notasMesAtual: number;
  faturamentoMesAtual: number;
  empresas: number;
  lastSync: string | null;
}

const initialProgress = {
  isActive: false,
  elapsedSeconds: 0,
  message: '',
  startTime: null as number | null,
};

const VENDAS_ENTITIES = ['vendas', 'vendas_incremental', 'vendas_full'];

export function useVendasSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<VendasStats | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [erpConnectionStatus, setErpConnectionStatus] =
    useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(initialProgress);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (syncProgress.isActive && syncProgress.startTime) {
      interval = setInterval(() => {
        setSyncProgress(prev => ({
          ...prev,
          elapsedSeconds: Math.floor(
            (Date.now() - (prev.startTime || Date.now())) / 1000
          ),
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [syncProgress.isActive, syncProgress.startTime]);

  const callErpEngine = useCallback(
    async (path: string, body?: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('erp-sync-engine', {
        body: { path, ...body },
      });
      if (error) throw error;
      return data;
    },
    []
  );

  const invalidateVendasCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['vendas-union'] });
    queryClient.invalidateQueries({ queryKey: ['detalhamento-vendas'] });
    queryClient.invalidateQueries({ queryKey: ['clientes-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['produtos-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['geografico-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['painel-executivo'] });
    queryClient.invalidateQueries({ queryKey: ['performance-vendas'] });
  }, [queryClient]);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [totalResult, mesResult, faturamentoResult, empresasResult, lastSyncResult] =
        await Promise.all([
          supabase.from('vendas_union').select('id', { count: 'exact', head: true }),
          supabase
            .from('vendas_union')
            .select('id', { count: 'exact', head: true })
            .gte('data', firstDay),
          supabase
            .from('vendas_union')
            .select('venda')
            .gte('data', firstDay)
            .limit(50000),
          supabase.from('vendas_union').select('id_empresa').limit(50000),
          supabase
            .from('sync_control')
            .select('*')
            .in('entidade', VENDAS_ENTITIES)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      let faturamentoMesAtual = 0;
      faturamentoResult.data?.forEach((v: any) => {
        faturamentoMesAtual += Number(v.venda) || 0;
      });

      const empresasSet = new Set<number>();
      empresasResult.data?.forEach((v: any) => {
        if (v.id_empresa != null) empresasSet.add(v.id_empresa);
      });

      setStats({
        totalRecords: totalResult.count || 0,
        notasMesAtual: mesResult.count || 0,
        faturamentoMesAtual,
        empresas: empresasSet.size,
        lastSync: lastSyncResult.data?.ultima_sync || null,
      });
    } catch (err) {
      console.error('Erro ao buscar estatísticas de vendas:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSyncHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .in('entidade', VENDAS_ENTITIES)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;

      setSyncHistory(
        data?.map(item => ({
          id: item.id,
          ultima_sync: item.ultima_sync,
          total_registros: item.total_registros || 0,
          registros_inseridos: item.registros_inseridos || 0,
          registros_atualizados: item.registros_atualizados || 0,
          registros_ignorados: item.registros_ignorados || 0,
          duracao_ms: item.duracao_ms || 0,
          status: item.status || 'unknown',
          erro_mensagem: item.erro_mensagem || undefined,
          empresa_id: item.empresa_id || undefined,
        })) || []
      );
    } catch (err) {
      console.error('Erro ao buscar histórico de sync de vendas:', err);
    }
  }, []);

  const testConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const { count, error } = await supabase
        .from('vendas_union')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      toast({
        title: 'Conexão OK',
        description: `Banco de dados acessível. ${count || 0} registros encontrados.`,
      });
      return { connected: true, count };
    } catch (err) {
      toast({
        title: 'Erro de Conexão',
        description: 'Falha ao conectar com o banco de dados',
        variant: 'destructive',
      });
      return { connected: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const testErpConnection = useCallback(async () => {
    setErpConnectionStatus('checking');
    try {
      const data = await callErpEngine('test-connection');
      if (data?.success) {
        setErpConnectionStatus('connected');
        toast({
          title: 'Conexão ERP OK',
          description: `Conectado ao SQL Server. ${data.rowCount || 0} registros de teste.`,
        });
        return { connected: true, data };
      } else {
        throw new Error(data?.error || 'Falha na conexão');
      }
    } catch (err) {
      setErpConnectionStatus('error');
      toast({
        title: 'Erro de Conexão ERP',
        description: 'Falha ao conectar com o SQL Server.',
        variant: 'destructive',
      });
      return { connected: false, error: err };
    }
  }, [toast, callErpEngine]);

  const syncFull = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress({
      isActive: true,
      elapsedSeconds: 0,
      message: 'Iniciando sync full de vendas (≥ 2025)...',
      startTime: Date.now(),
    });
    try {
      const data = await callErpEngine('sync-vendas-full');
      setLastSyncResult({
        success: true,
        totalRows: data?.totalRows,
        upserted: data?.upserted,
        message: `${data?.empresas || 0} empresas processadas`,
      });
      toast({
        title: 'Sync Full Concluída',
        description: `${data?.totalRows?.toLocaleString() || 0} registros processados`,
      });
      invalidateVendasCaches();
      await Promise.all([fetchStats(), fetchSyncHistory()]);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setLastSyncResult({ success: false, error: msg });
      toast({ title: 'Erro na Sync Full', description: msg, variant: 'destructive' });
      return null;
    } finally {
      setIsSyncing(false);
      setSyncProgress(prev => ({ ...prev, isActive: false, message: 'Concluído' }));
    }
  }, [callErpEngine, toast, fetchStats, fetchSyncHistory, invalidateVendasCaches]);

  const syncIncremental = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress({
      isActive: true,
      elapsedSeconds: 0,
      message: 'Sync incremental de novos faturamentos...',
      startTime: Date.now(),
    });
    try {
      const data = await callErpEngine('sync-vendas-incremental');
      setLastSyncResult({
        success: true,
        totalRows: data?.totalRows,
        upserted: data?.upserted,
        message: 'Novos faturamentos sincronizados',
      });
      toast({
        title: 'Sync Incremental Concluída',
        description: `${data?.totalRows?.toLocaleString() || 0} registros processados`,
      });
      invalidateVendasCaches();
      await Promise.all([fetchStats(), fetchSyncHistory()]);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setLastSyncResult({ success: false, error: msg });
      toast({
        title: 'Erro na Sync Incremental',
        description: msg,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
      setSyncProgress(prev => ({ ...prev, isActive: false, message: 'Concluído' }));
    }
  }, [callErpEngine, toast, fetchStats, fetchSyncHistory, invalidateVendasCaches]);

  const syncByEmpresa = useCallback(
    async (empresaId: number) => {
      setIsSyncing(true);
      setSyncProgress({
        isActive: true,
        elapsedSeconds: 0,
        message: `Sincronizando empresa ${empresaId}...`,
        startTime: Date.now(),
      });
      try {
        const data = await callErpEngine('sync-vendas-por-empresa', {
          empresa_id: empresaId,
        });
        setLastSyncResult({
          success: true,
          totalRows: data?.totalRows,
          upserted: data?.upserted,
          message: `Empresa ${empresaId} sincronizada`,
        });
        toast({
          title: 'Sync Empresa Concluída',
          description: `Empresa ${empresaId}: ${data?.totalRows?.toLocaleString() || 0} registros`,
        });
        invalidateVendasCaches();
        await Promise.all([fetchStats(), fetchSyncHistory()]);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setLastSyncResult({ success: false, error: msg });
        toast({ title: 'Erro na Sync', description: msg, variant: 'destructive' });
        return null;
      } finally {
        setIsSyncing(false);
        setSyncProgress(prev => ({ ...prev, isActive: false, message: 'Concluído' }));
      }
    },
    [callErpEngine, toast, fetchStats, fetchSyncHistory, invalidateVendasCaches]
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStats(), fetchSyncHistory()]);
  }, [fetchStats, fetchSyncHistory]);

  const resetProgress = useCallback(() => {
    setSyncProgress(initialProgress);
    setLastSyncResult(null);
  }, []);

  return {
    isLoading,
    isSyncing,
    stats,
    syncHistory,
    lastSyncResult,
    erpConnectionStatus,
    syncProgress,
    fetchStats,
    fetchSyncHistory,
    testConnection,
    testErpConnection,
    syncFull,
    syncIncremental,
    syncByEmpresa,
    refreshAll,
    resetProgress,
  };
}

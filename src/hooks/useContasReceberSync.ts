import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

export interface ContasReceberStats {
  totalRecords: number;
  pendentes: number;
  vencidas: number;
  totalValorAberto: number;
  totalValorRecebido: number;
  lastSync: string | null;
}

const initialProgress = {
  isActive: false,
  elapsedSeconds: 0,
  message: '',
  startTime: null as number | null,
};

export function useContasReceberSync() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<ContasReceberStats | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [erpConnectionStatus, setErpConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(initialProgress);

  // Timer for elapsed time during sync
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (syncProgress.isActive && syncProgress.startTime) {
      interval = setInterval(() => {
        setSyncProgress(prev => ({
          ...prev,
          elapsedSeconds: Math.floor((Date.now() - (prev.startTime || Date.now())) / 1000)
        }));
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [syncProgress.isActive, syncProgress.startTime]);

  // Helper to call erp-sync-engine
  const callErpEngine = useCallback(async (path: string, body?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('erp-sync-engine', {
      body: { path, ...body }
    });
    if (error) throw error;
    return data;
  }, []);

  // Fetch local stats from database
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [totalResult, pendentesResult, vencidasResult, valoresResult, lastSyncResult] = await Promise.all([
        supabase.from('contas_receber').select('id', { count: 'exact', head: true }),
        supabase.from('contas_receber').select('id', { count: 'exact', head: true }).gt('valor_aberto', 0).gte('data_vencimento', today),
        supabase.from('contas_receber').select('id', { count: 'exact', head: true }).gt('valor_aberto', 0).lt('data_vencimento', today),
        supabase.from('contas_receber').select('valor_aberto, valor_recebido').limit(10000),
        supabase.from('sync_control').select('*').eq('entidade', 'contas_receber').order('created_at', { ascending: false }).limit(1).single()
      ]);

      let totalValorAberto = 0;
      let totalValorRecebido = 0;
      if (valoresResult.data) {
        valoresResult.data.forEach(conta => {
          totalValorAberto += conta.valor_aberto || 0;
          totalValorRecebido += conta.valor_recebido || 0;
        });
      }

      setStats({
        totalRecords: totalResult.count || 0,
        pendentes: pendentesResult.count || 0,
        vencidas: vencidasResult.count || 0,
        totalValorAberto,
        totalValorRecebido,
        lastSync: lastSyncResult.data?.ultima_sync || null
      });
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch sync history
  const fetchSyncHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .eq('entidade', 'contas_receber')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;

      setSyncHistory(data?.map(item => ({
        id: item.id,
        ultima_sync: item.ultima_sync,
        total_registros: item.total_registros || 0,
        registros_inseridos: item.registros_inseridos || 0,
        registros_atualizados: item.registros_atualizados || 0,
        registros_ignorados: item.registros_ignorados || 0,
        duracao_ms: item.duracao_ms || 0,
        status: item.status || 'unknown',
        erro_mensagem: item.erro_mensagem || undefined,
        empresa_id: item.empresa_id || undefined
      })) || []);
    } catch (err) {
      console.error('Erro ao buscar histórico de sync:', err);
    }
  }, []);

  // Test database connection
  const testConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const { count, error } = await supabase.from('contas_receber').select('id', { count: 'exact', head: true });
      if (error) throw error;
      toast({ title: 'Conexão OK', description: `Banco de dados acessível. ${count || 0} registros encontrados.` });
      return { connected: true, count };
    } catch (err) {
      toast({ title: 'Erro de Conexão', description: 'Falha ao conectar com o banco de dados', variant: 'destructive' });
      return { connected: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Test ERP SQL Server connection via erp-sync-engine
  const testErpConnection = useCallback(async () => {
    setErpConnectionStatus('checking');
    try {
      const data = await callErpEngine('test-connection');
      if (data?.success) {
        setErpConnectionStatus('connected');
        toast({ title: 'Conexão ERP OK', description: `Conectado ao SQL Server. ${data.rowCount || 0} registros de teste.` });
        return { connected: true, data };
      } else {
        throw new Error(data?.error || 'Falha na conexão');
      }
    } catch (err) {
      setErpConnectionStatus('error');
      toast({ title: 'Erro de Conexão ERP', description: 'Falha ao conectar com o SQL Server.', variant: 'destructive' });
      return { connected: false, error: err };
    }
  }, [toast, callErpEngine]);

  // Sync full (all companies via external orchestration)
  const syncFull = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress({ isActive: true, elapsedSeconds: 0, message: 'Iniciando sync full...', startTime: Date.now() });
    try {
      const data = await callErpEngine('sync-contas-receber-full');
      setLastSyncResult({ success: true, totalRows: data?.totalRows, upserted: data?.upserted, message: `${data?.empresas || 0} empresas processadas` });
      toast({ title: 'Sync Full Concluída', description: `${data?.totalRows?.toLocaleString() || 0} registros processados` });
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
  }, [callErpEngine, toast, fetchStats, fetchSyncHistory]);

  // Sync incremental (last 2 hours payments)
  const syncIncremental = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress({ isActive: true, elapsedSeconds: 0, message: 'Sync incremental...', startTime: Date.now() });
    try {
      const data = await callErpEngine('sync-contas-receber-incremental');
      setLastSyncResult({ success: true, totalRows: data?.totalRows, upserted: data?.upserted, message: 'Pagamentos recentes sincronizados' });
      toast({ title: 'Sync Incremental Concluída', description: `${data?.totalRows?.toLocaleString() || 0} registros processados` });
      await Promise.all([fetchStats(), fetchSyncHistory()]);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setLastSyncResult({ success: false, error: msg });
      toast({ title: 'Erro na Sync Incremental', description: msg, variant: 'destructive' });
      return null;
    } finally {
      setIsSyncing(false);
      setSyncProgress(prev => ({ ...prev, isActive: false, message: 'Concluído' }));
    }
  }, [callErpEngine, toast, fetchStats, fetchSyncHistory]);

  // Sync by company
  const syncByEmpresa = useCallback(async (empresaId: number) => {
    setIsSyncing(true);
    setSyncProgress({ isActive: true, elapsedSeconds: 0, message: `Sincronizando empresa ${empresaId}...`, startTime: Date.now() });
    try {
      const data = await callErpEngine('sync-contas-receber-por-empresa', { empresa_id: empresaId });
      setLastSyncResult({ success: true, totalRows: data?.totalRows, upserted: data?.upserted, message: `Empresa ${empresaId} sincronizada` });
      toast({ title: 'Sync Empresa Concluída', description: `Empresa ${empresaId}: ${data?.totalRows?.toLocaleString() || 0} registros` });
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
  }, [callErpEngine, toast, fetchStats, fetchSyncHistory]);

  // Check engine status
  const checkStatus = useCallback(async () => {
    try {
      return await callErpEngine('status');
    } catch (err) {
      console.error('Erro ao verificar status:', err);
      return null;
    }
  }, [callErpEngine]);

  // Refresh all
  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStats(), fetchSyncHistory()]);
  }, [fetchStats, fetchSyncHistory]);

  // Reset progress
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
    checkStatus,
    refreshAll,
    resetProgress,
  };
}

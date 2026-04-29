import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from "@/lib/logger";

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

export interface EstoqueErpStats {
  totalSkus: number;
  distribuidorasAtivas: number;
  skusZerados: number;
  valorTotalCusto: number;
  lastSync: string | null;
}

const initialProgress = {
  isActive: false,
  elapsedSeconds: 0,
  message: '',
  startTime: null as number | null,
};

export function useEstoqueErpSync() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<EstoqueErpStats | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [erpConnectionStatus, setErpConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState(initialProgress);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (syncProgress.isActive && syncProgress.startTime) {
      interval = setInterval(() => {
        setSyncProgress(prev => ({
          ...prev,
          elapsedSeconds: Math.floor((Date.now() - (prev.startTime || Date.now())) / 1000),
        }));
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [syncProgress.isActive, syncProgress.startTime]);

  const callErpEngine = useCallback(async (path: string, body?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('erp-sync-engine', {
      body: { path, ...body },
    });
    if (error) throw error;
    return data;
  }, []);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const tbl = supabase.from('erp_estoque_distribuidora' as any);
      const [totalRes, zeradosRes, valoresRes, lastSyncRes, distRes] = await Promise.all([
        tbl.select('id', { count: 'exact', head: true }),
        supabase.from('erp_estoque_distribuidora' as any).select('id', { count: 'exact', head: true }).lte('saldo', 0),
        supabase.from('erp_estoque_distribuidora' as any).select('custo_total').limit(20000),
        supabase.from('sync_control').select('*').eq('entidade', 'estoque').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('erp_estoque_distribuidora' as any).select('abrev_par').limit(20000),
      ]);

      let valorTotal = 0;
      ((valoresRes as any).data || []).forEach((r: any) => { valorTotal += Number(r.custo_total) || 0; });
      const distribuidoras = new Set<string>();
      ((distRes as any).data || []).forEach((r: any) => { if (r.abrev_par) distribuidoras.add(r.abrev_par); });

      setStats({
        totalSkus: (totalRes as any).count || 0,
        skusZerados: (zeradosRes as any).count || 0,
        distribuidorasAtivas: distribuidoras.size,
        valorTotalCusto: valorTotal,
        lastSync: (lastSyncRes as any).data?.ultima_sync || null,
      });
    } catch (err) {
      logger.error('Erro ao buscar estatísticas estoque:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSyncHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .eq('entidade', 'estoque')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setSyncHistory((data || []).map((item: any) => ({
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
      })));
    } catch (err) {
      logger.error('Erro ao buscar histórico estoque:', err);
    }
  }, []);

  const testConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const { count, error } = await supabase.from('erp_estoque_distribuidora' as any).select('id', { count: 'exact', head: true });
      if (error) throw error;
      toast({ title: 'Conexão OK', description: `Banco acessível. ${count || 0} registros de estoque.` });
      return { connected: true, count };
    } catch (err) {
      toast({ title: 'Erro de Conexão', description: 'Falha ao acessar a base local.', variant: 'destructive' });
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
        toast({ title: 'Conexão ERP OK', description: 'Conectado ao SQL Server.' });
        return { connected: true, data };
      }
      throw new Error(data?.error || 'Falha na conexão');
    } catch (err) {
      setErpConnectionStatus('error');
      toast({ title: 'Erro de Conexão ERP', description: 'Falha ao conectar com o SQL Server.', variant: 'destructive' });
      return { connected: false, error: err };
    }
  }, [toast, callErpEngine]);

  const syncFull = useCallback(async () => {
    setIsSyncing(true);
    setSyncProgress({ isActive: true, elapsedSeconds: 0, message: 'Sincronizando estoque (todas distribuidoras)...', startTime: Date.now() });
    try {
      const data = await callErpEngine('sync-estoque-full');
      setLastSyncResult({ success: true, totalRows: data?.totalRows, upserted: data?.upserted, message: `${data?.empresas || 0} distribuidoras processadas` });
      toast({ title: 'Sync Concluída', description: `${data?.totalRows?.toLocaleString() || 0} SKUs sincronizados` });
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

  const syncIncremental = useCallback(async () => {
    // Para estoque, incremental == full rápido (não há timestamp na fonte)
    return syncFull();
  }, [syncFull]);

  const syncByEmpresa = useCallback(async (empresaId: number) => {
    setIsSyncing(true);
    setSyncProgress({ isActive: true, elapsedSeconds: 0, message: `Sincronizando distribuidora ${empresaId}...`, startTime: Date.now() });
    try {
      const data = await callErpEngine('sync-estoque-por-empresa', { empresa_id: empresaId });
      setLastSyncResult({ success: true, totalRows: data?.totalRows, upserted: data?.upserted, message: `Distribuidora ${empresaId} sincronizada` });
      toast({ title: 'Sync Concluída', description: `Distribuidora ${empresaId}: ${data?.totalRows?.toLocaleString() || 0} SKUs` });
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

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

export interface SyncResult {
  success: boolean;
  totalRows?: number;
  upserted?: number;
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

export interface ComposicaoErpStats {
  totalRegistros: number;
  empresasDistintas: number;
  produtosDistintos: number;
  materiasDistintas: number;
  lastSync: string | null;
}

const initialProgress = {
  isActive: false,
  elapsedSeconds: 0,
  message: '',
  startTime: null as number | null,
};

export function useComposicaoErpSync() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<ComposicaoErpStats | null>(null);
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
      const tbl = 'erp_composicao_produto' as any;
      const [totalRes, sampleRes, lastSyncRes] = await Promise.all([
        supabase.from(tbl).select('erp_id', { count: 'exact', head: true }),
        supabase.from(tbl).select('empresa_compo,produto_compo,materia_compo').limit(50000),
        supabase.from('sync_control').select('*').eq('entidade', 'composicao').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      const empresas = new Set<number>();
      const produtos = new Set<number>();
      const materias = new Set<number>();
      ((sampleRes as any).data || []).forEach((r: any) => {
        if (r.empresa_compo != null) empresas.add(r.empresa_compo);
        if (r.produto_compo != null) produtos.add(r.produto_compo);
        if (r.materia_compo != null) materias.add(r.materia_compo);
      });
      setStats({
        totalRegistros: (totalRes as any).count || 0,
        empresasDistintas: empresas.size,
        produtosDistintos: produtos.size,
        materiasDistintas: materias.size,
        lastSync: (lastSyncRes as any).data?.ultima_sync || null,
      });
    } catch (err) {
      logger.error('Erro ao buscar estatísticas composição:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSyncHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .eq('entidade', 'composicao')
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
      logger.error('Erro ao buscar histórico composição:', err);
    }
  }, []);

  const testConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const { count, error } = await supabase.from('erp_composicao_produto' as any).select('erp_id', { count: 'exact', head: true });
      if (error) throw error;
      toast({ title: 'Conexão OK', description: `Banco acessível. ${count || 0} registros de composição.` });
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
    setSyncProgress({ isActive: true, elapsedSeconds: 0, message: 'Sincronizando composição (todas empresas)...', startTime: Date.now() });
    try {
      const data = await callErpEngine('sync-composicao-full');
      setLastSyncResult({ success: true, totalRows: data?.totalRows, upserted: data?.upserted, message: `${data?.empresas || 0} empresas processadas` });
      toast({ title: 'Sync Concluída', description: `${data?.totalRows?.toLocaleString() || 0} registros sincronizados` });
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

  const syncByEmpresa = useCallback(async (empresaId: number) => {
    setIsSyncing(true);
    setSyncProgress({ isActive: true, elapsedSeconds: 0, message: `Sincronizando empresa ${empresaId}...`, startTime: Date.now() });
    try {
      const data = await callErpEngine('sync-composicao-por-empresa', { empresa_id: empresaId });
      setLastSyncResult({ success: true, totalRows: data?.totalRows, upserted: data?.upserted, message: `Empresa ${empresaId} sincronizada` });
      toast({ title: 'Sync Concluída', description: `Empresa ${empresaId}: ${data?.totalRows?.toLocaleString() || 0} registros` });
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
    isLoading, isSyncing, stats, syncHistory, lastSyncResult,
    erpConnectionStatus, syncProgress,
    fetchStats, fetchSyncHistory, testConnection, testErpConnection,
    syncFull, syncByEmpresa, refreshAll, resetProgress,
  };
}

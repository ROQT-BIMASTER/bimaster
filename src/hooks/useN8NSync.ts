import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface N8NStatus {
  success: boolean;
  n8n: {
    connected: boolean;
    responseTime?: number;
    webhookUrl: string;
    sampleRecord?: any;
    metadata?: any;
    error?: string;
  };
  local?: {
    totalRecords: number;
    lastSync: string | null;
    lastSyncStatus: string | null;
    lastSyncRecords: number | null;
  };
}

interface SyncResult {
  success: boolean;
  syncId?: string;
  mode?: 'full' | 'incremental' | 'bulk_sql';
  summary?: {
    totalProcessed: number;
    pagesProcessed: number;
    duration: number;
    durationFormatted: string;
    recordsPerSecond: number;
    errors: number;
  };
  statistics?: {
    total_received: number;
    processed: number;
    inserted?: number;
    updated?: number;
    skipped?: number;
    errors: number;
    rate_per_second: number;
  };
  errors?: any[];
  error?: string;
}

interface PreviewResult {
  success: boolean;
  preview: any[];
  originalFormat: any;
  metadata: any;
}

interface SyncHistory {
  id: string;
  entidade: string;
  tipo_sync: string;
  last_sync_at: string;
  records_processed: number;
  records_inserted: number;
  records_updated: number;
  records_skipped: number;
  duration_ms: number;
  status: string;
}

export function useN8NSync() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<N8NStatus | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const testConnection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('n8n-contas-receber/status');
      
      if (fnError) throw fnError;
      
      setStatus(data);
      
      if (data.success && data.n8n.connected) {
        toast({
          title: 'Conexão OK',
          description: `N8N respondeu em ${data.n8n.responseTime}ms`,
        });
      } else {
        toast({
          title: 'Conexão falhou',
          description: data.n8n.error || 'Não foi possível conectar ao N8N',
          variant: 'destructive',
        });
      }
      
      return data;
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao testar conexão';
      setError(errorMsg);
      toast({
        title: 'Erro',
        description: errorMsg,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchPreview = useCallback(async (limit = 10) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('n8n-contas-receber/preview', {
        body: { limit },
      });
      
      if (fnError) throw fnError;
      
      setPreview(data);
      return data;
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao buscar preview';
      setError(errorMsg);
      toast({
        title: 'Erro',
        description: errorMsg,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const getLastSyncTimestamp = useCallback(async (tipo: 'full' | 'incremental' = 'full') => {
    try {
      // Use direct Supabase query instead of Edge Function for reliability
      const { data: lastSync, error: syncError } = await supabase
        .from('sync_tracking')
        .select('*')
        .eq('entidade', 'contas_receber')
        .eq('tipo_sync', tipo)
        .order('last_sync_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (syncError) throw syncError;
      
      // Get history
      const { data: history, error: historyError } = await supabase
        .from('sync_tracking')
        .select('*')
        .eq('entidade', 'contas_receber')
        .order('last_sync_at', { ascending: false })
        .limit(10);
      
      if (historyError) throw historyError;
      
      const result = {
        last_sync_timestamp: lastSync?.last_sync_at || null,
        history: history || []
      };
      
      setLastSyncTimestamp(result.last_sync_timestamp);
      setSyncHistory(result.history as SyncHistory[]);
      return result;
    } catch (err: any) {
      console.error('Erro ao buscar último timestamp:', err);
      return null;
    }
  }, []);

  const calculateEta = useCallback((totalRecords: number, processedRecords: number, elapsedMs: number) => {
    if (processedRecords === 0 || elapsedMs === 0) {
      setEta(null);
      return;
    }
    
    const rate = processedRecords / (elapsedMs / 1000);
    const remaining = totalRecords - processedRecords;
    const remainingSeconds = remaining / rate;
    
    if (remainingSeconds < 60) {
      setEta(`${Math.round(remainingSeconds)}s`);
    } else if (remainingSeconds < 3600) {
      setEta(`${Math.round(remainingSeconds / 60)}min`);
    } else {
      setEta(`${Math.round(remainingSeconds / 3600)}h ${Math.round((remainingSeconds % 3600) / 60)}min`);
    }
  }, []);

  const syncAll = useCallback(async (batchSize = 1000) => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);
    setEta(null);
    
    abortControllerRef.current = new AbortController();
    
    toast({
      title: 'Sincronização FULL iniciada',
      description: 'Buscando todos os dados do ERP via N8N...',
    });
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('n8n-contas-receber/sync-all', {
        body: { batchSize },
      });
      
      if (fnError) throw fnError;
      
      setSyncResult(data);
      
      if (data.success) {
        toast({
          title: 'Sincronização FULL concluída',
          description: `${data.summary?.totalProcessed?.toLocaleString() || 0} registros em ${data.summary?.durationFormatted || '?'}`,
        });
      } else {
        toast({
          title: 'Sincronização falhou',
          description: data.error || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
      
      // Atualizar histórico
      await getLastSyncTimestamp('full');
      
      return data;
    } catch (err: any) {
      const errorMsg = err.message || 'Erro na sincronização';
      setError(errorMsg);
      toast({
        title: 'Erro',
        description: errorMsg,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
      setEta(null);
      abortControllerRef.current = null;
    }
  }, [toast, getLastSyncTimestamp]);

  const syncIncremental = useCallback(async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);
    setEta(null);
    
    toast({
      title: 'Sincronização INCREMENTAL iniciada',
      description: 'Buscando apenas registros alterados...',
    });
    
    try {
      // Primeiro, buscar o último timestamp
      const lastSync = await getLastSyncTimestamp('incremental');
      const since = lastSync?.last_sync_timestamp || new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      
      // Buscar dados do N8N com filtro de data
      const { data: n8nData, error: n8nError } = await supabase.functions.invoke('n8n-contas-receber/query', {
        body: { 
          limit: 50000,
          filters: { since }
        },
      });
      
      if (n8nError) throw n8nError;
      
      if (!n8nData?.data?.length) {
        toast({
          title: 'Nenhuma alteração',
          description: 'Não há registros novos desde a última sincronização.',
        });
        setSyncResult({ success: true, mode: 'incremental', statistics: { total_received: 0, processed: 0, errors: 0, rate_per_second: 0 } });
        return { success: true, processed: 0 };
      }
      
      // Enviar para sync incremental
      const { data, error: fnError } = await supabase.functions.invoke('contas-receber-api/sync-incremental', {
        body: { 
          contas: n8nData.data,
          skip_unchanged: true
        },
      });
      
      if (fnError) throw fnError;
      
      setSyncResult(data);
      
      if (data.success) {
        const stats = data.statistics;
        toast({
          title: 'Sincronização INCREMENTAL concluída',
          description: `${stats.processed} processados, ${stats.skipped || 0} sem alteração (${stats.rate_per_second} rec/s)`,
        });
      } else {
        toast({
          title: 'Sincronização falhou',
          description: data.error || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
      
      // Atualizar histórico
      await getLastSyncTimestamp('incremental');
      
      return data;
    } catch (err: any) {
      const errorMsg = err.message || 'Erro na sincronização incremental';
      setError(errorMsg);
      toast({
        title: 'Erro',
        description: errorMsg,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
      setEta(null);
    }
  }, [toast, getLastSyncTimestamp]);

  const cancelSync = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      toast({
        title: 'Cancelado',
        description: 'Sincronização cancelada pelo usuário.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const queryPage = useCallback(async (limit = 100, offset = 0, filters = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('n8n-contas-receber/query', {
        body: { limit, offset, filters },
      });
      
      if (fnError) throw fnError;
      
      return data;
    } catch (err: any) {
      const errorMsg = err.message || 'Erro ao consultar dados';
      setError(errorMsg);
      toast({
        title: 'Erro',
        description: errorMsg,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    // State
    isLoading,
    isSyncing,
    status,
    preview,
    syncResult,
    error,
    syncHistory,
    lastSyncTimestamp,
    eta,
    
    // Actions
    testConnection,
    fetchPreview,
    syncAll,
    syncIncremental,
    cancelSync,
    queryPage,
    getLastSyncTimestamp,
  };
}

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
    records2025?: number;
    records2024Plus?: number;
    lastSync: string | null;
    lastSyncStatus: string | null;
    lastSyncRecords: number | null;
  };
  database?: {
    healthy: boolean;
    responseTime: number;
    message?: string;
  };
  activeSyncs?: number;
  protections?: {
    rateLimitPerMinute: number;
    maxConcurrentSyncs: number;
    pageDelayMs: number;
    circuitBreakerMs?: number;
  };
}

interface SyncResult {
  success: boolean;
  syncId?: string;
  mode?: 'full' | 'incremental' | 'bulk_sql';
  scope?: string;
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

export interface SyncProgress {
  currentPage: number;
  recordsProcessed: number;
  recordsInCurrentBatch: number;
  startTime: number;
  isRunning: boolean;
  scope?: string;
}

export type SyncScope = '2025' | '2024+' | 'full';

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
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const testConnection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('n8n-contas-receber/status');
      
      if (fnError) throw fnError;
      
      setStatus(data);
      
      if (data.success && data.n8n.connected) {
        const healthMsg = data.database?.healthy 
          ? `DB OK (${data.database.responseTime}ms)` 
          : 'DB lento';
        toast({
          title: 'Conexão OK',
          description: `N8N conectado. ${healthMsg}. Syncs ativos: ${data.activeSyncs || 0}`,
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
      const { data: lastSync, error: syncError } = await supabase
        .from('sync_tracking')
        .select('*')
        .eq('entidade', 'contas_receber')
        .eq('tipo_sync', tipo)
        .order('last_sync_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (syncError) throw syncError;
      
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

  // Sync with scope selection (safe sync)
  const syncWithScope = useCallback(async (scope: SyncScope = '2025', batchSize = 500) => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);
    setEta(null);
    
    const startTime = Date.now();
    const anoMinimo = scope === '2025' ? 2025 : (scope === '2024+' ? 2024 : null);
    
    setSyncProgress({
      currentPage: 0,
      recordsProcessed: 0,
      recordsInCurrentBatch: batchSize,
      startTime,
      isRunning: true,
      scope,
    });
    
    toast({
      title: `Sincronização ${scope.toUpperCase()} iniciada`,
      description: `Buscando dados com proteções anti-sobrecarga...`,
    });
    
    try {
      // Start sync
      const { data: startData, error: startError } = await supabase.functions.invoke('n8n-contas-receber/sync-start', {
        body: { batchSize, scope, anoMinimo },
      });
      
      if (startError) throw startError;
      
      if (!startData.success) {
        throw new Error(startData.message || startData.error || 'Falha ao iniciar sync');
      }
      
      // Poll para atualizar progresso
      progressIntervalRef.current = setInterval(async () => {
        try {
          const { data: trackingData } = await supabase
            .from('sync_tracking')
            .select('records_processed, status, metadata')
            .eq('id', startData.trackingId)
            .single();
          
          if (trackingData) {
            const processed = trackingData.records_processed || 0;
            const metadata = trackingData.metadata as Record<string, unknown> | null;
            const pagesProcessed = (metadata?.pagesProcessed as number) || 0;
            
            setSyncProgress(prev => ({
              ...prev!,
              currentPage: pagesProcessed,
              recordsProcessed: processed,
              isRunning: trackingData.status === 'running',
            }));
            
            // Calcular ETA
            const elapsed = Date.now() - startTime;
            if (processed > 0 && elapsed > 0) {
              const rate = processed / (elapsed / 1000);
              const estimatedTotal = scope === '2025' ? 40000 : (scope === '2024+' ? 100000 : 220000);
              const remaining = Math.max(0, estimatedTotal - processed);
              const remainingSeconds = remaining / rate;
              
              if (remainingSeconds < 60) {
                setEta(`~${Math.round(remainingSeconds)}s`);
              } else if (remainingSeconds < 3600) {
                setEta(`~${Math.round(remainingSeconds / 60)}min`);
              } else {
                setEta(`~${Math.round(remainingSeconds / 3600)}h ${Math.round((remainingSeconds % 3600) / 60)}min`);
              }
            }
            
            // Check if completed
            if (trackingData.status !== 'running') {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
              
              setSyncResult({
                success: trackingData.status === 'completed',
                mode: scope === 'full' ? 'full' : 'incremental',
                scope,
                summary: {
                  totalProcessed: processed,
                  pagesProcessed,
                  duration: Date.now() - startTime,
                  durationFormatted: `${Math.round((Date.now() - startTime) / 1000)}s`,
                  recordsPerSecond: Math.round(processed / ((Date.now() - startTime) / 1000)),
                  errors: 0,
                },
              });
              
              setIsSyncing(false);
              setSyncProgress(null);
              setEta(null);
            }
          }
        } catch (e) {
          // Silenciar erros de polling
        }
      }, 3000);
      
      return startData;
      
    } catch (err: any) {
      const errorMsg = err.message || 'Erro na sincronização';
      setError(errorMsg);
      toast({
        title: 'Erro',
        description: errorMsg,
        variant: 'destructive',
      });
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setIsSyncing(false);
      setSyncProgress(null);
      setEta(null);
      
      return null;
    }
  }, [toast]);

  const syncAll = useCallback(async (batchSize = 500) => {
    return syncWithScope('full', batchSize);
  }, [syncWithScope]);

  // Sync Incremental 100% BACKEND - busca dados antigos (até 30 dias) para capturar pagamentos de títulos em atraso
  const syncIncremental = useCallback(async (diasRetroativos = 30) => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);
    setEta(null);
    
    const startTime = Date.now();
    
    setSyncProgress({
      currentPage: 0,
      recordsProcessed: 0,
      recordsInCurrentBatch: 0,
      startTime,
      isRunning: true,
      scope: 'incremental',
    });
    
    toast({
      title: 'Sincronização INCREMENTAL iniciada',
      description: `Buscando dados dos últimos ${diasRetroativos} dias (pagamentos de títulos antigos)...`,
    });
    
    try {
      // Chamar endpoint 100% backend
      const { data, error: fnError } = await supabase.functions.invoke('n8n-contas-receber/sync-incremental', {
        body: { diasRetroativos, batchSize: 50, maxPages: 100 },
      });
      
      if (fnError) throw fnError;
      
      if (!data.success) {
        throw new Error(data.error || data.message || 'Falha na sincronização incremental');
      }
      
      setSyncResult({
        success: true,
        mode: 'incremental',
        summary: {
          totalProcessed: data.summary?.totalProcessed || 0,
          pagesProcessed: data.summary?.pagesProcessed || 0,
          duration: data.summary?.duration_ms || 0,
          durationFormatted: data.summary?.durationFormatted || '0s',
          recordsPerSecond: Math.round((data.summary?.totalProcessed || 0) / ((data.summary?.duration_ms || 1) / 1000)),
          errors: data.summary?.errors || 0,
        },
        statistics: {
          total_received: data.summary?.totalProcessed || 0,
          processed: data.summary?.totalProcessed || 0,
          inserted: data.summary?.totalInserted || 0,
          updated: data.summary?.totalUpdated || 0,
          skipped: 0,
          errors: data.summary?.errors || 0,
          rate_per_second: Math.round((data.summary?.totalProcessed || 0) / ((data.summary?.duration_ms || 1) / 1000)),
        },
      });
      
      toast({
        title: 'Sincronização INCREMENTAL concluída',
        description: `${data.summary?.totalUpdated || 0} atualizados, ${data.summary?.totalInserted || 0} novos (${data.summary?.durationFormatted || '0s'})`,
      });
      
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
      setSyncProgress(null);
      setEta(null);
    }
  }, [toast, getLastSyncTimestamp]);

  const cancelSync = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSyncing(false);
    setSyncProgress(null);
    setEta(null);
    toast({
      title: 'Cancelado',
      description: 'Sincronização cancelada pelo usuário.',
      variant: 'destructive',
    });
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
    syncProgress,
    
    // Actions
    testConnection,
    fetchPreview,
    syncAll,
    syncWithScope,
    syncIncremental,
    cancelSync,
    queryPage,
    getLastSyncTimestamp,
  };
}

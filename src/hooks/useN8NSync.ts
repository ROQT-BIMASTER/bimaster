import { useState, useCallback } from 'react';
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
  summary?: {
    totalProcessed: number;
    pagesProcessed: number;
    duration: number;
    durationFormatted: string;
    recordsPerSecond: number;
    errors: number;
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

export function useN8NSync() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<N8NStatus | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const syncAll = useCallback(async (batchSize = 1000) => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);
    
    toast({
      title: 'Sincronização iniciada',
      description: 'Buscando dados do ERP via N8N...',
    });
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('n8n-contas-receber/sync-all', {
        body: { batchSize },
      });
      
      if (fnError) throw fnError;
      
      setSyncResult(data);
      
      if (data.success) {
        toast({
          title: 'Sincronização concluída',
          description: `${data.summary.totalProcessed.toLocaleString()} registros em ${data.summary.durationFormatted}`,
        });
      } else {
        toast({
          title: 'Sincronização falhou',
          description: data.error || 'Erro desconhecido',
          variant: 'destructive',
        });
      }
      
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
    
    // Actions
    testConnection,
    fetchPreview,
    syncAll,
    queryPage,
  };
}

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export interface SyncResult {
  success: boolean;
  statistics?: {
    total_received: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
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
}

export interface ContasPagarStats {
  totalRecords: number;
  pendentes: number;
  vencidas: number;
  totalValorAberto: number;
  totalValorPago: number;
  lastSync: string | null;
}

export type SyncMode = 'n8n' | 'direct';

export interface ErpCredentials {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

export function useContasPagarSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<ContasPagarStats | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [syncMode, setSyncMode] = useState<SyncMode>('n8n');
  const [erpConnectionStatus, setErpConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');

  // Buscar estatísticas locais do banco de dados
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [
        totalResult,
        pendentesResult,
        vencidasResult,
        valoresResult,
        lastSyncResult
      ] = await Promise.all([
        // Total de registros
        supabase.from('contas_pagar').select('id', { count: 'exact', head: true }),
        
        // Pendentes (valor_aberto > 0 e não vencidas)
        supabase.from('contas_pagar')
          .select('id', { count: 'exact', head: true })
          .gt('valor_aberto', 0)
          .gte('data_vencimento', today),
        
        // Vencidas (valor_aberto > 0 e vencidas)
        supabase.from('contas_pagar')
          .select('id', { count: 'exact', head: true })
          .gt('valor_aberto', 0)
          .lt('data_vencimento', today),
        
        // Somar valores
        supabase.from('contas_pagar')
          .select('valor_aberto, valor_pago'),
        
        // Última sincronização
        supabase.from('sync_control')
          .select('*')
          .eq('entidade', 'contas_pagar')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
      ]);

      // Calcular totais de valores
      let totalValorAberto = 0;
      let totalValorPago = 0;
      if (valoresResult.data) {
        valoresResult.data.forEach(conta => {
          totalValorAberto += conta.valor_aberto || 0;
          totalValorPago += conta.valor_pago || 0;
        });
      }

      setStats({
        totalRecords: totalResult.count || 0,
        pendentes: pendentesResult.count || 0,
        vencidas: vencidasResult.count || 0,
        totalValorAberto,
        totalValorPago,
        lastSync: lastSyncResult.data?.ultima_sync || null
      });

    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
      toast({
        title: 'Erro',
        description: 'Falha ao buscar estatísticas de contas a pagar',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Buscar histórico de sincronizações
  const fetchSyncHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .eq('entidade', 'contas_pagar')
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
        erro_mensagem: item.erro_mensagem || undefined
      })) || []);

    } catch (err) {
      console.error('Erro ao buscar histórico de sync:', err);
    }
  }, []);

  // Testar conexão verificando dados no banco
  const testConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      // Testa conexão verificando se há registros na tabela
      const { count, error } = await supabase
        .from('contas_pagar')
        .select('id', { count: 'exact', head: true });
      
      if (error) throw error;

      toast({
        title: 'Conexão OK',
        description: `Banco de dados acessível. ${count || 0} registros encontrados.`,
      });

      return { connected: true, count };
    } catch (err) {
      console.error('Erro ao testar conexão:', err);
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

  // Testar conexão direta com ERP
  const testErpConnection = useCallback(async () => {
    setErpConnectionStatus('checking');
    try {
      const { data, error } = await supabase.functions.invoke('contas-pagar-api', {
        body: { action: 'test-erp-connection' }
      });
      
      if (error) throw error;

      if (data?.connected) {
        setErpConnectionStatus('connected');
        toast({
          title: 'Conexão ERP OK',
          description: `Conectado ao SQL Server: ${data.version || 'versão desconhecida'}`,
        });
        return { connected: true, data };
      } else {
        throw new Error(data?.error || 'Falha na conexão');
      }
    } catch (err) {
      console.error('Erro ao testar conexão ERP:', err);
      setErpConnectionStatus('error');
      toast({
        title: 'Erro de Conexão ERP',
        description: 'Falha ao conectar com o SQL Server. Verifique as credenciais.',
        variant: 'destructive',
      });
      return { connected: false, error: err };
    }
  }, [toast]);

  // Sincronização direta via API REST
  const syncDirect = useCallback(async (options?: { anoMinimo?: number; empresaId?: number }) => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('contas-pagar-api', {
        body: { 
          action: 'sync-direct',
          anoMinimo: options?.anoMinimo || 2020,
          empresaId: options?.empresaId
        }
      });
      
      if (error) throw error;

      setLastSyncResult({
        success: true,
        statistics: data?.statistics,
        duration_ms: data?.duration_ms,
        message: data?.message
      });

      toast({
        title: 'Sincronização Concluída',
        description: `${data?.statistics?.processed || 0} registros processados em ${((data?.duration_ms || 0) / 1000).toFixed(1)}s`,
      });

      // Invalidar cache do React Query
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-table'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-calendario'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-dre-view'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos-dre'] });

      // Atualizar estatísticas e histórico
      await Promise.all([fetchStats(), fetchSyncHistory()]);

      return data;
    } catch (err) {
      console.error('Erro na sincronização direta:', err);
      setLastSyncResult({
        success: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido'
      });
      toast({
        title: 'Erro na Sincronização',
        description: 'Falha ao sincronizar via API direta',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [toast, fetchStats, fetchSyncHistory]);

  // Buscar preview dos dados
  const fetchPreview = useCallback(async (limit: number = 10) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contas_pagar')
        .select('*')
        .order('data_vencimento', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data;
    } catch (err) {
      console.error('Erro ao buscar preview:', err);
      toast({
        title: 'Erro',
        description: 'Falha ao buscar preview dos dados',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Refresh de todas as estatísticas
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchStats(),
      fetchSyncHistory()
    ]);
  }, [fetchStats, fetchSyncHistory]);

  return {
    isLoading,
    isSyncing,
    stats,
    syncHistory,
    lastSyncResult,
    syncMode,
    setSyncMode,
    erpConnectionStatus,
    fetchStats,
    fetchSyncHistory,
    testConnection,
    testErpConnection,
    syncDirect,
    fetchPreview,
    refreshAll,
  };
}

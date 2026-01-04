import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

export function useContasPagarSync() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<ContasPagarStats | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

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

  // Testar conexão com a API de Contas a Pagar
  const testConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('contas-pagar-api/stats');
      
      if (error) throw error;

      toast({
        title: 'Conexão OK',
        description: 'API de Contas a Pagar está funcionando',
      });

      return { connected: true, data };
    } catch (err) {
      console.error('Erro ao testar conexão:', err);
      toast({
        title: 'Erro de Conexão',
        description: 'Falha ao conectar com a API de Contas a Pagar',
        variant: 'destructive',
      });
      return { connected: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

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
    stats,
    syncHistory,
    lastSyncResult,
    fetchStats,
    fetchSyncHistory,
    testConnection,
    fetchPreview,
    refreshAll,
  };
}

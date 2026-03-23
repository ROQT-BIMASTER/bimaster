import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DataSourceConfig {
  id: string;
  source_type: 'n8n' | 'erp_api' | 'both';
  n8n_enabled: boolean;
  erp_api_enabled: boolean;
  auto_sync_interval_minutes: number;
  transition_date: string | null;
  updated_by: string | null;
  updated_at: string;
  notes: string | null;
}

const QUERY_KEY = ['ap-data-source-config'];

export function useDataSourceConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ap_data_source_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data as DataSourceConfig;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<DataSourceConfig>) => {
      if (!config?.id) throw new Error('Config não encontrada');
      const { error } = await (supabase as any)
        .from('ap_data_source_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Configuração de fonte de dados atualizada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    config,
    isLoading,
    n8nEnabled: config?.n8n_enabled ?? true,
    erpApiEnabled: config?.erp_api_enabled ?? false,
    sourceType: config?.source_type ?? 'both',
    updateConfig: updateMutation.mutate,
    isSaving: updateMutation.isPending,
  };
}

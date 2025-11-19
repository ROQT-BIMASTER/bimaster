import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { withRetry } from '@/lib/utils/supabase-retry';

/**
 * Hook personalizado para queries do Supabase com retry automático
 */
export function useSupabaseQuery<T>(
  queryKey: any[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn: () => withRetry(queryFn, queryKey[0] as string),
    retry: false, // Desabilitar retry do React Query, pois já temos nosso próprio
    staleTime: 30000, // 30 segundos (reduzido de 60s)
    gcTime: 5 * 60 * 1000, // 5 minutos (reduzido de 10)
    refetchOnWindowFocus: false, // Não refetch ao focar na janela
    refetchOnReconnect: true, // Refetch quando reconectar
    refetchInterval: false, // Desabilitar polling automático
    ...options,
  });
}

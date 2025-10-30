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
    staleTime: 30000, // Dados ficam frescos por 30 segundos
    gcTime: 5 * 60 * 1000, // Cache por 5 minutos
    refetchOnWindowFocus: false, // Não refetch ao focar na janela
    refetchOnReconnect: true, // Refetch quando reconectar
    ...options,
  });
}

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
    staleTime: 60000, // Dados ficam frescos por 60 segundos (aumentado)
    gcTime: 10 * 60 * 1000, // Cache por 10 minutos (aumentado)
    refetchOnWindowFocus: false, // Não refetch ao focar na janela
    refetchOnReconnect: true, // Refetch quando reconectar
    refetchInterval: false, // Desabilitar polling automático
    ...options,
  });
}

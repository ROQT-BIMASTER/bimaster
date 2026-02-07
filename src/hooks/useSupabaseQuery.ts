import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { withRetry } from '@/lib/utils/supabase-retry';

/**
 * Hook personalizado para queries do Supabase com retry automático
 * Configurações otimizadas para melhor experiência do usuário
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
    staleTime: 5 * 60 * 1000, // 5 minutos - alinhado com QueryClient global
    gcTime: 10 * 60 * 1000, // 10 minutos - alinhado com QueryClient global
    refetchOnWindowFocus: true, // Recarrega ao focar na janela
    refetchOnReconnect: true, // Refetch quando reconectar
    refetchInterval: false, // Desabilitar polling automático
    ...options,
  });
}

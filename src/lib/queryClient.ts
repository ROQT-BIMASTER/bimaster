/**
 * Cliente compartilhado do React Query.
 *
 * Defaults globais sensatos para SPA com muita navegação:
 * - staleTime de 5 min: queries não refazem fetch ao revisitar a mesma página
 * - gcTime de 10 min: cache permanece após desmonte para retorno instantâneo
 * - refetchOnWindowFocus desligado: evita reload visual a cada troca de aba
 * - refetchOnReconnect desligado: optimistic updates ja cobrem reconexão
 * - retry: 1 (rede instável é tratada via toast nas mutations)
 *
 * Hooks específicos podem sobrescrever esses defaults quando precisarem
 * de comportamento mais agressivo (e.g. dashboards realtime com staleTime: 0).
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

import { useMutation, useQueryClient, MutationOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

interface MutationWithTimeoutOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  timeout?: number;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  invalidateKeys?: string[][];
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Hook para mutations com timeout automático e invalidação de cache
 * Garante que operações não fiquem travadas indefinidamente
 */
export function useMutationWithTimeout<TData = unknown, TVariables = void>({
  mutationFn,
  timeout = 15000,
  onSuccess,
  onError,
  invalidateKeys = [],
  successMessage,
  errorMessage = 'Erro ao processar operação',
}: MutationWithTimeoutOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      // Criar promise de timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error('Timeout: a operação demorou demais. Tente novamente.'));
        }, timeout);
      });

      // Race entre a operação e o timeout
      return Promise.race([
        mutationFn(variables),
        timeoutPromise,
      ]);
    },
    onSuccess: (data, variables) => {
      // Invalidar cache automaticamente
      if (invalidateKeys.length > 0) {
        invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }

      // Mostrar toast de sucesso se configurado
      if (successMessage) {
        toast.success(successMessage);
      }

      // Callback customizado
      if (onSuccess) {
        onSuccess(data, variables);
      }
    },
    onError: (error: Error, variables) => {
      console.error('[MutationTimeout] Erro:', error);
      
      // Mostrar toast de erro
      const message = error.message || errorMessage;
      toast.error(message);

      // Callback customizado
      if (onError) {
        onError(error, variables);
      }
    },
  });
}

/**
 * Wrapper para executar uma função com timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number = 15000,
  operationName: string = 'Operação'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`Timeout: ${operationName} demorou demais.`));
    }, timeout);
  });

  return Promise.race([fn(), timeoutPromise]);
}

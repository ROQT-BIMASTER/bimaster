import { toast } from "sonner";

/**
 * Configurações de retry para requisições
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
};

/**
 * Verifica se o erro é relacionado à rede
 */
function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  
  return (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('connection') ||
    errorCode === 'PGRST301' || // timeout
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ETIMEDOUT' ||
    !navigator.onLine
  );
}

/**
 * Aguarda um tempo antes de tentar novamente
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrapper para executar queries do Supabase com retry automático
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'Operação'
): Promise<T> {
  let lastError: any;
  let currentDelay = RETRY_CONFIG.initialDelay;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Verificar se está online antes de tentar
      if (!navigator.onLine && attempt === 0) {
        throw new Error('Você está offline');
      }
      
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 30000)
        )
      ]);
      
      // Se chegou aqui, operação foi bem-sucedida
      if (attempt > 0) {
        toast.dismiss(`retry-${operationName}`);
        toast.success(`Conexão restabelecida`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Se não é erro de rede ou chegou no limite de tentativas, lançar erro
      if (!isNetworkError(error) || attempt === RETRY_CONFIG.maxRetries) {
        if (attempt > 0) {
          toast.dismiss(`retry-${operationName}`);
        }
        throw error;
      }
      
      // Mostrar toast apenas na primeira tentativa
      if (attempt === 0) {
        toast.loading(`Conexão instável, reconectando... (${attempt + 1}/${RETRY_CONFIG.maxRetries})`, {
          id: `retry-${operationName}`,
        });
      } else {
        toast.loading(`Tentando novamente... (${attempt + 1}/${RETRY_CONFIG.maxRetries})`, {
          id: `retry-${operationName}`,
        });
      }
      
      // Aguardar antes de tentar novamente com backoff exponencial
      await delay(currentDelay);
      currentDelay = Math.min(
        currentDelay * RETRY_CONFIG.backoffFactor,
        RETRY_CONFIG.maxDelay
      );
    }
  }
  
  // Se chegou aqui, todas as tentativas falharam
  toast.dismiss(`retry-${operationName}`);
  throw lastError;
}

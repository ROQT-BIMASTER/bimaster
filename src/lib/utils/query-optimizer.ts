/**
 * Utilitários para otimização de queries do Supabase
 * Foca em performance para dispositivos móveis
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Cache de queries com TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_CACHE_SIZE = 50; // Limitar tamanho do cache

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    // Se cache está cheio, remover entradas antigas
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0]?.[0];
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }
}

export const queryCache = new QueryCache();

/**
 * Gera uma chave única para cache baseada nos parâmetros da query
 */
export function generateCacheKey(
  table: string,
  params: Record<string, any>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  return `${table}::${sortedParams}`;
}

/**
 * Executa query com cache
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Verificar cache primeiro
  const cached = queryCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Executar query
  const result = await queryFn();
  
  // Salvar no cache
  queryCache.set(key, result, ttl);
  
  return result;
}

/**
 * Otimiza queries de contagem usando head: true
 */
export async function optimizedCount(
  client: SupabaseClient,
  table: string,
  filters?: Record<string, any>
): Promise<number> {
  let query = client.from(table).select('*', { count: 'exact', head: true });

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
  }

  const { count, error } = await query;
  
  if (error) {
    console.error('Error counting:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Batch de queries em paralelo com limite de concorrência
 */
export async function batchQueries<T>(
  queries: (() => Promise<T>)[],
  concurrency: number = 3
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(q => q()));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Debounce para buscas
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle para scroll events
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Otimiza select para trazer apenas campos necessários
 */
export function optimizedSelect(fields: string[]): string {
  // Sempre incluir id para identificação
  const uniqueFields = ['id', ...fields.filter(f => f !== 'id')];
  return uniqueFields.join(',');
}

/**
 * Detecta se está em dispositivo móvel
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Retorna tamanho de página otimizado baseado no dispositivo
 */
export function getOptimizedPageSize(): number {
  if (isMobileDevice()) {
    return 20; // Menos itens em mobile
  }
  return 50; // Mais itens em desktop
}

/**
 * Limpa cache em baixa memória
 */
export function setupMemoryWarning(): void {
  if ('memory' in performance) {
    const checkMemory = () => {
      // @ts-ignore
      const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
      const usageRatio = usedJSHeapSize / jsHeapSizeLimit;
      
      // Se uso de memória > 80%, limpar cache
      if (usageRatio > 0.8) {
        console.warn('High memory usage detected, clearing cache');
        queryCache.clear();
      }
    };

    // Verificar a cada 30 segundos
    setInterval(checkMemory, 30000);
  }
}

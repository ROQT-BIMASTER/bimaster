import { supabase } from '@/integrations/supabase/client';

/**
 * Busca TODOS os registros de uma tabela, contornando o limite padrão de 1000 linhas do PostgREST.
 * Faz paginação automática em lotes.
 *
 * @param tableName - Nome da tabela no Supabase
 * @param select - Colunas a selecionar (padrão: '*')
 * @param buildQuery - Callback opcional para adicionar filtros (.eq, .gt, .order, etc.) à query base
 * @param batchSize - Tamanho de cada lote (padrão: 1000)
 * @returns Array com todos os registros
 */
export async function fetchAllRows<T = any>(
  tableName: string,
  select: string = '*',
  buildQuery?: (query: any) => any,
  batchSize: number = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(tableName as any)
      .select(select)
      .range(offset, offset + batchSize - 1);

    // Apply custom filters/ordering
    if (buildQuery) {
      query = buildQuery(query);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...(data as T[]));
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

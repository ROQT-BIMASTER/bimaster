import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

interface PaginatedQueryOptions<T> {
  table: string;
  select?: string;
  pageSize?: number;
  orderBy?: { column: string; ascending?: boolean };
  filters?: Record<string, any>;
  enabled?: boolean;
}

interface PaginatedQueryResult<T> {
  data: T[];
  loading: boolean;
  error: PostgrestError | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  totalCount: number | null;
}

/**
 * Hook para queries paginadas com infinite scroll
 * Otimizado para performance em dispositivos móveis
 */
export function usePaginatedQuery<T = any>(
  options: PaginatedQueryOptions<T>
): PaginatedQueryResult<T> {
  const {
    table,
    select = '*',
    pageSize = 50,
    orderBy = { column: 'created_at', ascending: false },
    filters = {},
    enabled = true,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const fetchPage = useCallback(
    async (pageNumber: number, append: boolean = true) => {
      if (!enabled) return;

      try {
        setLoading(true);
        setError(null);

        // Build query
        let query: any = supabase
          .from(table as any)
          .select(select, { count: 'exact' })
          .order(orderBy.column, { ascending: orderBy.ascending ?? false })
          .range(pageNumber * pageSize, (pageNumber + 1) * pageSize - 1);

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
              query = query.in(key, value);
            } else {
              query = query.eq(key, value);
            }
          }
        });

        const { data: newData, error: queryError, count } = await query;

        if (queryError) throw queryError;

        setTotalCount(count);
        setHasMore((newData?.length ?? 0) === pageSize);

        if (append) {
          setData((prev) => [...prev, ...(newData as T[] || [])]);
        } else {
          setData(newData as T[] || []);
        }
      } catch (err) {
        console.error('Error fetching paginated data:', err);
        setError(err as PostgrestError);
      } finally {
        setLoading(false);
      }
    },
    [table, select, pageSize, orderBy, filters, enabled]
  );

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      await fetchPage(nextPage, true);
    }
  }, [page, loading, hasMore, fetchPage]);

  const refresh = useCallback(async () => {
    setPage(0);
    setData([]);
    await fetchPage(0, false);
  }, [fetchPage]);

  // Serialize to prevent infinite loops from object reference changes
  const filtersKey = JSON.stringify(filters);
  const orderByKey = JSON.stringify(orderBy);

  useEffect(() => {
    if (enabled) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filtersKey, orderByKey, enabled]);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    totalCount,
  };
}

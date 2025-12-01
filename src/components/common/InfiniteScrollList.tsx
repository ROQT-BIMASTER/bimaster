import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onLoadMore: () => void;
  loading: boolean;
  hasMore: boolean;
  threshold?: number;
  emptyMessage?: string;
  loadingMessage?: string;
}

/**
 * Lista com scroll infinito otimizada para mobile
 * Carrega mais itens automaticamente ao chegar no fim
 */
export function InfiniteScrollList<T extends { id: string }>({
  items,
  renderItem,
  onLoadMore,
  loading,
  hasMore,
  threshold = 200,
  emptyMessage = 'Nenhum item encontrado',
  loadingMessage = 'Carregando...',
}: InfiniteScrollListProps<T>) {
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Se o elemento sentinel está visível e não está carregando
        if (entries[0].isIntersecting && !loading && hasMore) {
          onLoadMore();
        }
      },
      {
        threshold: 0,
        rootMargin: `${threshold}px`,
      }
    );

    const target = observerTarget.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [loading, hasMore, onLoadMore, threshold]);

  if (items.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item.id}>{renderItem(item, index)}</div>
      ))}

      {/* Sentinel element for intersection observer */}
      <div ref={observerTarget} className="h-4" />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm text-muted-foreground">{loadingMessage}</span>
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Todos os itens foram carregados
        </div>
      )}
    </div>
  );
}

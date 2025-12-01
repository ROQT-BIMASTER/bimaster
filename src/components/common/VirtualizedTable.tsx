import { useEffect, useRef, useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  width?: string;
}

interface VirtualizedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowHeight?: number;
  overscan?: number;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  emptyMessage?: string;
}

/**
 * Tabela virtualizada para grandes volumes de dados
 * Renderiza apenas as linhas visíveis na tela
 */
export function VirtualizedTable<T extends { id: string }>({
  data,
  columns,
  rowHeight = 60,
  overscan = 5,
  loading = false,
  onLoadMore,
  hasMore = false,
  emptyMessage = 'Nenhum item encontrado',
}: VirtualizedTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calcular itens visíveis
  const { visibleStart, visibleEnd, totalHeight, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / rowHeight);
    const end = Math.min(data.length, start + visibleCount + overscan * 2);

    return {
      visibleStart: start,
      visibleEnd: end,
      totalHeight: data.length * rowHeight,
      offsetY: start * rowHeight,
    };
  }, [scrollTop, containerHeight, data.length, rowHeight, overscan]);

  const visibleData = useMemo(
    () => data.slice(visibleStart, visibleEnd),
    [data, visibleStart, visibleEnd]
  );

  // Atualizar altura do container
  useEffect(() => {
    if (!containerRef.current) return;

    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Scroll handler com throttle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number;
    const handleScroll = () => {
      rafId = requestAnimationFrame(() => {
        setScrollTop(container.scrollTop);

        // Load more quando próximo do fim
        if (
          onLoadMore &&
          hasMore &&
          !loading &&
          container.scrollTop + container.clientHeight >= totalHeight - rowHeight * 3
        ) {
          onLoadMore();
        }
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, [onLoadMore, hasMore, loading, totalHeight, rowHeight]);

  if (data.length === 0 && !loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto border rounded-lg"
      style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} style={{ width: column.width }}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      </Table>

      <div style={{ height: totalHeight, position: 'relative' }}>
        <Table>
          <TableBody style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleData.map((item) => (
              <TableRow key={item.id}>
                {columns.map((column) => (
                  <TableCell key={column.key} style={{ width: column.width, height: rowHeight }}>
                    {column.render(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            
            {loading && (
              <TableRow>
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && !loading && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Role para carregar mais...
        </div>
      )}
    </div>
  );
}

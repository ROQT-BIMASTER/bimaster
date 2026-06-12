import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** ms epoch retornado por React Query (`dataUpdatedAt`). */
  dataUpdatedAt: number | undefined;
  /** Quando true, mostra ícone girando discreto. */
  isFetching?: boolean;
  className?: string;
}

/**
 * Indicador discreto "Atualizado há Ns" para telas com refetch silencioso.
 * Atualiza o texto a cada 1s sem causar reflow nos KPIs ao redor (tabular-nums).
 */
export function UpdatedAtBadge({ dataUpdatedAt, isFetching, className }: Props) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!dataUpdatedAt) return null;
  const ageSec = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000));
  const label =
    ageSec < 5 ? 'agora' :
    ageSec < 60 ? `há ${ageSec}s` :
    ageSec < 3600 ? `há ${Math.floor(ageSec / 60)}min` :
    `há ${Math.floor(ageSec / 3600)}h`;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums',
        className,
      )}
      title={`Atualizado ${new Date(dataUpdatedAt).toLocaleTimeString('pt-BR')}. Refresh automático a cada 30s.`}
    >
      <RefreshCw className={cn('h-3 w-3', isFetching && 'animate-spin')} />
      <span>Atualizado {label}</span>
    </div>
  );
}

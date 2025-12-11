/**
 * Indicador visual de status offline e sincronização
 * Exibe badge fixo no canto inferior com status de conexão
 */

import React from 'react';
import { Wifi, WifiOff, CloudOff, RefreshCw, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  showAlways?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ 
  className,
  showAlways = false 
}) => {
  const { isOnline, pendingSyncCount, isSyncing, syncProgress, triggerSync } = useOfflineStatus();

  // Se está online e não tem pendências, não mostrar (a menos que showAlways)
  if (isOnline && pendingSyncCount === 0 && !isSyncing && !showAlways) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-50 flex items-center gap-2',
        'bg-background/95 backdrop-blur-sm border rounded-full px-3 py-2 shadow-lg',
        !isOnline && 'border-destructive/50 bg-destructive/10',
        isOnline && pendingSyncCount > 0 && 'border-warning/50 bg-warning/10',
        isOnline && pendingSyncCount === 0 && 'border-success/50 bg-success/10',
        className
      )}
    >
      {/* Ícone de status */}
      {!isOnline ? (
        <WifiOff className="h-4 w-4 text-destructive" />
      ) : isSyncing ? (
        <RefreshCw className="h-4 w-4 text-primary animate-spin" />
      ) : pendingSyncCount > 0 ? (
        <CloudOff className="h-4 w-4 text-warning" />
      ) : (
        <Wifi className="h-4 w-4 text-success" />
      )}

      {/* Texto de status */}
      <span className="text-xs font-medium">
        {!isOnline ? (
          'Offline'
        ) : isSyncing ? (
          syncProgress ? (
            `Sincronizando ${syncProgress.synced}/${syncProgress.total}...`
          ) : (
            'Sincronizando...'
          )
        ) : pendingSyncCount > 0 ? (
          `${pendingSyncCount} pendente(s)`
        ) : (
          'Sincronizado'
        )}
      </span>

      {/* Badge de contagem */}
      {pendingSyncCount > 0 && !isSyncing && (
        <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
          {pendingSyncCount}
        </Badge>
      )}

      {/* Botão de sincronização manual */}
      {isOnline && pendingSyncCount > 0 && !isSyncing && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full"
          onClick={triggerSync}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

/**
 * Indicador compacto para uso em headers
 */
export const OfflineStatusBadge: React.FC<{ className?: string }> = ({ className }) => {
  const { isOnline, pendingSyncCount, isSyncing, triggerSync } = useOfflineStatus();

  return (
    <button
      onClick={isOnline && pendingSyncCount > 0 ? triggerSync : undefined}
      disabled={!isOnline || isSyncing}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors',
        !isOnline && 'bg-destructive/20 text-destructive',
        isOnline && pendingSyncCount > 0 && 'bg-warning/20 text-warning hover:bg-warning/30 cursor-pointer',
        isOnline && pendingSyncCount === 0 && 'bg-success/20 text-success',
        isSyncing && 'opacity-70',
        className
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Sincronizando...</span>
        </>
      ) : pendingSyncCount > 0 ? (
        <>
          <AlertTriangle className="h-3 w-3" />
          <span>{pendingSyncCount} pendente(s)</span>
        </>
      ) : (
        <>
          <Check className="h-3 w-3" />
          <span>Sincronizado</span>
        </>
      )}
    </button>
  );
};

export default OfflineIndicator;

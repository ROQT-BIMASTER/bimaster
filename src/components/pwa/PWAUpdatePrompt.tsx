import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWA } from '@/hooks/usePWA';

export function PWAUpdatePrompt() {
  const { needRefresh, updateServiceWorker } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Reset dismissed quando uma nova atualização estiver disponível
  useEffect(() => {
    if (needRefresh) {
      setDismissed(false);
    }
  }, [needRefresh]);

  if (!needRefresh || dismissed) {
    return null;
  }

  const handleUpdate = () => {
    setIsUpdating(true);
    updateServiceWorker();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <Card className="p-4 shadow-xl border-primary/50 bg-card/95 backdrop-blur-sm max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-full bg-primary/10">
            <RefreshCw className={`h-5 w-5 text-primary ${isUpdating ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Nova versão disponível!</p>
            <p className="text-xs text-muted-foreground mt-1">
              Uma atualização foi encontrada. Atualize para obter melhorias e correções.
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={handleUpdate}
                disabled={isUpdating}
                className="gap-1.5"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  'Atualizar agora'
                )}
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setDismissed(true)}
                disabled={isUpdating}
              >
                Depois
              </Button>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 flex-shrink-0"
            onClick={() => setDismissed(true)}
            disabled={isUpdating}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

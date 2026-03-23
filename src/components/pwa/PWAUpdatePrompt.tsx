import { useEffect, useState } from 'react';
import { CheckCircle, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWA } from '@/contexts/PWAContext';

export function PWAUpdatePrompt() {
  const { wasUpdated, needRefresh, appVersion, dismissUpdateNotice, updateServiceWorker, forceUpdate } = usePWA();
  const [showUpdated, setShowUpdated] = useState(false);

  // Mostrar notificação quando o app foi atualizado
  useEffect(() => {
    if (wasUpdated) {
      setShowUpdated(true);
      const timer = setTimeout(() => {
        setShowUpdated(false);
        dismissUpdateNotice();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [wasUpdated, dismissUpdateNotice]);

  const handleDismissUpdated = () => {
    setShowUpdated(false);
    dismissUpdateNotice();
  };

  const handleApplyUpdate = () => {
    updateServiceWorker();
  };

  const handleDismissRefresh = () => {
    dismissUpdateNotice();
  };

  // Prompt de confirmação para nova versão disponível (PRIORITÁRIO)
  if (needRefresh) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 animate-fade-in">
        <Card className="p-4 shadow-xl border-primary/50 bg-card/95 backdrop-blur-sm max-w-sm ml-auto">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-full bg-primary/10">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Nova versão disponível</p>
              <p className="text-xs text-muted-foreground mt-1">
                Uma atualização está pronta. Deseja aplicar agora?
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleApplyUpdate}
                  className="text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Atualizar agora
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismissRefresh}
                  className="text-xs"
                >
                  Depois
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Notificação de que o app foi atualizado com sucesso
  if (!showUpdated) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <Card className="p-4 shadow-xl border-green-500/50 bg-card/95 backdrop-blur-sm max-w-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-full bg-green-500/10">
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">App atualizado!</p>
            <p className="text-xs text-muted-foreground mt-1">
              Versão {appVersion} instalada. Você está na versão mais recente.
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleDismissUpdated}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

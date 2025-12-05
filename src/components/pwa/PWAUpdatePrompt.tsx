import { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWA } from '@/contexts/PWAContext';

export function PWAUpdatePrompt() {
  const { wasUpdated, appVersion, dismissUpdateNotice } = usePWA();
  const [visible, setVisible] = useState(false);

  // Mostrar notificação quando o app foi atualizado
  useEffect(() => {
    if (wasUpdated) {
      setVisible(true);
      // Auto-dismiss após 8 segundos
      const timer = setTimeout(() => {
        setVisible(false);
        dismissUpdateNotice();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [wasUpdated, dismissUpdateNotice]);

  if (!visible) {
    return null;
  }

  const handleDismiss = () => {
    setVisible(false);
    dismissUpdateNotice();
  };

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
              Versão {appVersion} instalada automaticamente. 
              Você está usando a versão mais recente.
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

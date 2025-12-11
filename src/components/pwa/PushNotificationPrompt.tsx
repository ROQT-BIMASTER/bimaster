/**
 * Componente para solicitar permissão de notificações push
 */

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { cn } from '@/lib/utils';

interface PushNotificationPromptProps {
  className?: string;
  onDismiss?: () => void;
}

export const PushNotificationPrompt: React.FC<PushNotificationPromptProps> = ({
  className,
  onDismiss
}) => {
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verificar se já foi dispensado anteriormente
  useEffect(() => {
    const dismissed = localStorage.getItem('push_notification_dismissed');
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  // Não mostrar se não suportado, já permitido, negado ou dispensado
  if (!isSupported || permission !== 'default' || isDismissed) {
    return null;
  }

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      await requestPermission();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('push_notification_dismissed', 'true');
    onDismiss?.();
  };

  return (
    <Card className={cn(
      'fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50',
      'border-primary/20 shadow-xl animate-in slide-in-from-bottom-4',
      className
    )}>
      <CardHeader className="pb-2 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-full">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-base">Ativar notificações</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="text-sm">
          Receba alertas sobre visitas pendentes, metas e aprovações importantes.
        </CardDescription>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleEnable}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Ativando...' : 'Ativar'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
          >
            Depois
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Botão para ativar/desativar notificações (para uso em configurações)
 */
export const NotificationToggleButton: React.FC<{ className?: string }> = ({ className }) => {
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const [isLoading, setIsLoading] = useState(false);

  if (!isSupported) {
    return (
      <Button variant="outline" disabled className={className}>
        <BellOff className="h-4 w-4 mr-2" />
        Não suportado
      </Button>
    );
  }

  const handleClick = async () => {
    if (permission === 'granted') {
      // Não há como "desativar" programaticamente, informar o usuário
      alert('Para desativar notificações, acesse as configurações do seu navegador.');
      return;
    }

    setIsLoading(true);
    try {
      await requestPermission();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={permission === 'granted' ? 'secondary' : 'outline'}
      onClick={handleClick}
      disabled={isLoading || permission === 'denied'}
      className={className}
    >
      {permission === 'granted' ? (
        <>
          <Bell className="h-4 w-4 mr-2" />
          Notificações ativas
        </>
      ) : permission === 'denied' ? (
        <>
          <BellOff className="h-4 w-4 mr-2" />
          Bloqueado pelo navegador
        </>
      ) : (
        <>
          <Bell className="h-4 w-4 mr-2" />
          {isLoading ? 'Ativando...' : 'Ativar notificações'}
        </>
      )}
    </Button>
  );
};

export default PushNotificationPrompt;

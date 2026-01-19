import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  FileText, 
  AlertTriangle, 
  Loader2, 
  Play,
  CheckCircle,
  XCircle,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface N8NTabContentProps {
  stats: {
    lastSync?: string;
    totalRecords?: number;
  } | null;
  isSyncing: boolean;
  onRefresh: () => void;
}

export function N8NTabContent({ stats, isSyncing, onRefresh }: N8NTabContentProps) {
  const { toast } = useToast();
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{
    success: boolean;
    message: string;
    lastSyncDate?: string;
  } | null>(null);

  const handleTriggerN8N = async () => {
    setIsTriggering(true);
    setTriggerResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('contas-pagar-api/trigger-n8n', {
        method: 'POST',
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : undefined
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      
      setTriggerResult({
        success: data.success,
        message: data.message || data.error || 'Resposta inesperada',
        lastSyncDate: data.lastSyncDate
      });

      if (data.success) {
        toast({
          title: 'Sincronização Disparada',
          description: 'O workflow N8N foi iniciado. Aguarde alguns segundos e atualize.',
        });
        
        // Atualizar dados após um delay
        setTimeout(() => {
          onRefresh();
        }, 5000);
      } else {
        toast({
          title: 'Erro ao Disparar',
          description: data.error || data.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setTriggerResult({
        success: false,
        message: errorMessage
      });
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Sincronização via N8N
        </CardTitle>
        <CardDescription>
          Dispare a sincronização manualmente ou aguarde a execução automática
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status da Última Sync */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Última Sincronização</p>
                <p className="text-sm text-muted-foreground">
                  {stats?.lastSync 
                    ? format(new Date(stats.lastSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : 'Nenhuma sync registrada'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{stats?.totalRecords?.toLocaleString() || 0}</p>
              <p className="text-xs text-muted-foreground">registros</p>
            </div>
          </div>
        </div>

        {/* Botão de Sincronização */}
        <Button 
          className="w-full" 
          onClick={handleTriggerN8N}
          disabled={isTriggering || isSyncing}
        >
          {isTriggering ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Disparando N8N...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Sincronizar Agora via N8N
            </>
          )}
        </Button>

        {/* Resultado do Trigger */}
        {triggerResult && (
          <div className={`p-4 rounded-lg ${triggerResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
            <div className="flex items-center gap-2 mb-2">
              {triggerResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                {triggerResult.success ? 'Workflow Disparado' : 'Erro ao Disparar'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{triggerResult.message}</p>
            {triggerResult.lastSyncDate && (
              <p className="text-xs text-muted-foreground mt-1">
                Buscando dados a partir de: {triggerResult.lastSyncDate}
              </p>
            )}
          </div>
        )}

        {/* Endpoints de Referência */}
        <div className="p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Endpoints Disponíveis</h4>
          <div className="space-y-2 text-sm">
            <div>
              <code className="bg-background px-2 py-1 rounded text-xs">GET /last-sync</code>
              <span className="text-muted-foreground ml-2">- Retorna data da última sync</span>
            </div>
            <div>
              <code className="bg-background px-2 py-1 rounded text-xs">POST /sync</code>
              <span className="text-muted-foreground ml-2">- Recebe dados do N8N</span>
            </div>
            <div>
              <code className="bg-background px-2 py-1 rounded text-xs">POST /bulk-sync</code>
              <span className="text-muted-foreground ml-2">- Sync em massa otimizada</span>
            </div>
          </div>
        </div>

        {/* Aviso */}
        <div className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-700">Configuração</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Para usar o botão "Sincronizar Agora", configure o secret{' '}
                <code className="bg-background px-1 rounded text-xs">N8N_CONTAS_PAGAR_WEBHOOK</code>{' '}
                com a URL do webhook do N8N.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

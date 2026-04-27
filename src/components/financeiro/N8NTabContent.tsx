import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Database,
  Loader2,
  Play,
  CheckCircle,
  XCircle,
  Calendar,
  Activity,
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

type TriggerMode = 'incremental' | 'full';

interface TriggerResult {
  success: boolean;
  message: string;
  totalRows?: number;
  upserted?: number;
  durationMs?: number;
}

export function N8NTabContent({ stats, isSyncing, onRefresh }: N8NTabContentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [triggering, setTriggering] = useState<TriggerMode | null>(null);
  const [result, setResult] = useState<TriggerResult | null>(null);

  const runSync = async (mode: TriggerMode) => {
    setTriggering(mode);
    setResult(null);

    const path = mode === 'full' ? 'sync-contas-pagar-full' : 'sync-contas-pagar-incremental';

    try {
      const response = await supabase.functions.invoke('erp-sync-engine', {
        method: 'POST',
        body: { path },
      });

      if (response.error) throw new Error(response.error.message);
      const data = response.data ?? {};

      const success = data.success !== false;
      const totalRows = data.totalRows ?? 0;
      const upserted = data.upserted ?? 0;
      const durationMs = data.meta?.duration_ms;

      setResult({
        success,
        message: success
          ? `${totalRows} registros lidos do ERP, ${upserted} atualizados.`
          : data.error || 'Falha na sincronização.',
        totalRows,
        upserted,
        durationMs,
      });

      if (success) {
        toast({
          title: 'Sincronização concluída',
          description: `${upserted} registros atualizados em ${durationMs ? `${(durationMs / 1000).toFixed(1)}s` : 'instantes'}.`,
        });

        [
          'contas-pagar',
          'contas-pagar-dashboard',
          'contas-pagar-table',
          'contas-pagar-dre-view',
          'contas-pagar-calendario',
          'lancamentos-dre',
          'sync-metrics',
        ].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

        onRefresh();
      } else {
        toast({
          title: 'Falha na sincronização',
          description: data.error || 'Verifique os logs do ERP Engine.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      setResult({ success: false, message: msg });
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setTriggering(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Sincronização ERP — Contas a Pagar
        </CardTitle>
        <CardDescription>
          Pipeline direto com o ERP. Execução automática a cada 30 minutos (incremental) e varredura completa diária às 04h.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Última sincronização</p>
                <p className="text-sm text-muted-foreground">
                  {stats?.lastSync
                    ? format(new Date(stats.lastSync), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : 'Nenhuma execução registrada'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{stats?.totalRecords?.toLocaleString() || 0}</p>
              <p className="text-xs text-muted-foreground">registros</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={() => runSync('incremental')}
            disabled={triggering !== null || isSyncing}
          >
            {triggering === 'incremental' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sincronizando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Sincronizar Agora (Incremental)
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => runSync('full')}
            disabled={triggering !== null || isSyncing}
          >
            {triggering === 'full' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Varrendo todas as empresas...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4 mr-2" />
                Varredura Completa
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className={`p-4 rounded-lg ${result.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                {result.success ? 'Sincronização concluída' : 'Falha na sincronização'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{result.message}</p>
            {result.success && result.durationMs !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                Duração: {(result.durationMs / 1000).toFixed(2)}s
                {result.totalRows ? ` • ${Math.round((result.totalRows / result.durationMs) * 1000)} rows/s` : ''}
              </p>
            )}
          </div>
        )}

        <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
          As métricas detalhadas (taxa de sucesso, throughput, duração, deadlocks) ficam disponíveis na aba <strong>ERP Engine → Métricas</strong>, filtrando pela entidade <code className="bg-background px-1.5 py-0.5 rounded text-xs">contas_pagar</code> ou <code className="bg-background px-1.5 py-0.5 rounded text-xs">contas_pagar_incremental</code>.
        </div>
      </CardContent>
    </Card>
  );
}

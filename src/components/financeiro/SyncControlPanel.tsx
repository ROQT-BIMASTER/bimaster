import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Pause, 
  StopCircle, 
  RefreshCw, 
  Database, 
  Clock, 
  Zap,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Settings,
  Activity,
  Calendar
} from 'lucide-react';

export type SyncScope = '2025' | '2024+' | 'full';

interface SyncConfig {
  scope: SyncScope;
  batchSize: number;
  pageDelay: number;
}

interface DatabaseHealth {
  healthy: boolean;
  responseTime: number;
  message?: string;
}

interface SyncStatus {
  isRunning: boolean;
  currentPage: number;
  recordsProcessed: number;
  startTime: number | null;
  eta: string | null;
  syncSessionId: string | null;
  trackingId: string | null;
}

interface LocalStats {
  totalRecords: number;
  records2025: number;
  records2024Plus: number;
}

export function SyncControlPanel() {
  const { toast } = useToast();
  
  const [config, setConfig] = useState<SyncConfig>({
    scope: '2025',
    batchSize: 500,
    pageDelay: 3,
  });
  
  const [dbHealth, setDbHealth] = useState<DatabaseHealth | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isRunning: false,
    currentPage: 0,
    recordsProcessed: 0,
    startTime: null,
    eta: null,
    syncSessionId: null,
    trackingId: null,
  });
  
  const [localStats, setLocalStats] = useState<LocalStats>({
    totalRecords: 0,
    records2025: 0,
    records2024Plus: 0,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeSyncs, setActiveSyncs] = useState(0);

  // Check database health
  const checkHealth = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('n8n-contas-receber/health');
      
      if (error) throw error;
      
      setDbHealth(data.database);
      setActiveSyncs(data.activeSyncs || 0);
      
      return data;
    } catch (err) {
      console.error('Health check failed:', err);
      setDbHealth({ healthy: false, responseTime: 0, message: 'Failed to check' });
      return null;
    }
  }, []);

  // Fetch local stats
  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('n8n-contas-receber/status');
      
      if (error) throw error;
      
      if (data.local) {
        setLocalStats({
          totalRecords: data.local.totalRecords || 0,
          records2025: data.local.records2025 || 0,
          records2024Plus: data.local.records2024Plus || 0,
        });
      }
      
      if (data.database) {
        setDbHealth(data.database);
      }
      
      setActiveSyncs(data.activeSyncs || 0);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Poll for sync progress
  const pollProgress = useCallback(async () => {
    if (!syncStatus.trackingId) return;
    
    try {
      const { data, error } = await supabase
        .from('sync_tracking')
        .select('records_processed, status, metadata')
        .eq('id', syncStatus.trackingId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        const metadata = data.metadata as Record<string, unknown> | null;
        const processed = data.records_processed || 0;
        const pages = (metadata?.pagesProcessed as number) || 0;
        
        setSyncStatus(prev => ({
          ...prev,
          recordsProcessed: processed,
          currentPage: pages,
          isRunning: data.status === 'running',
        }));
        
        // Calculate ETA
        if (syncStatus.startTime && processed > 0) {
          const elapsed = Date.now() - syncStatus.startTime;
          const rate = processed / (elapsed / 1000);
          const estimatedTotal = getScopeEstimate(config.scope);
          const remaining = Math.max(0, estimatedTotal - processed);
          const remainingSeconds = remaining / rate;
          
          let eta = '';
          if (remainingSeconds < 60) {
            eta = `~${Math.round(remainingSeconds)}s`;
          } else if (remainingSeconds < 3600) {
            eta = `~${Math.round(remainingSeconds / 60)}min`;
          } else {
            eta = `~${Math.round(remainingSeconds / 3600)}h ${Math.round((remainingSeconds % 3600) / 60)}min`;
          }
          
          setSyncStatus(prev => ({ ...prev, eta }));
        }
        
        // Check if completed
        if (data.status !== 'running') {
          setSyncStatus(prev => ({ ...prev, isRunning: false }));
        }
      }
    } catch (err) {
      console.error('Failed to poll progress:', err);
    }
  }, [syncStatus.trackingId, syncStatus.startTime, config.scope]);

  // Get estimated records for scope
  const getScopeEstimate = (scope: SyncScope): number => {
    switch (scope) {
      case '2025': return 40000;
      case '2024+': return 100000;
      case 'full': return 220000;
      default: return 100000;
    }
  };

  // Start sync
  const startSync = async () => {
    if (syncStatus.isRunning) {
      toast({
        title: 'Sync já em andamento',
        description: 'Aguarde a conclusão ou cancele o sync atual.',
        variant: 'destructive',
      });
      return;
    }

    // Check health first
    const health = await checkHealth();
    if (!health?.database?.healthy) {
      toast({
        title: 'Banco indisponível',
        description: 'O banco de dados não está respondendo corretamente. Tente novamente em alguns minutos.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const anoMinimo = config.scope === '2025' ? 2025 : (config.scope === '2024+' ? 2024 : null);
      
      const { data, error } = await supabase.functions.invoke('n8n-contas-receber/sync-start', {
        body: {
          batchSize: config.batchSize,
          scope: config.scope,
          anoMinimo,
        },
      });
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.message || data.error || 'Failed to start sync');
      }
      
      setSyncStatus({
        isRunning: true,
        currentPage: 0,
        recordsProcessed: 0,
        startTime: Date.now(),
        eta: null,
        syncSessionId: data.syncSessionId,
        trackingId: data.trackingId,
      });
      
      toast({
        title: 'Sync Iniciado',
        description: `Sincronização ${config.scope.toUpperCase()} iniciada. Configure o N8N com delay de ${config.pageDelay}s entre páginas.`,
      });
      
    } catch (err: any) {
      toast({
        title: 'Erro ao iniciar sync',
        description: err.message || 'Falha ao iniciar sincronização',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load and polling
  useEffect(() => {
    fetchStats();
    checkHealth();
    
    const healthInterval = setInterval(checkHealth, 30000);
    
    return () => clearInterval(healthInterval);
  }, [fetchStats, checkHealth]);

  // Poll progress when running
  useEffect(() => {
    if (!syncStatus.isRunning || !syncStatus.trackingId) return;
    
    const progressInterval = setInterval(pollProgress, 3000);
    
    return () => clearInterval(progressInterval);
  }, [syncStatus.isRunning, syncStatus.trackingId, pollProgress]);

  const getHealthColor = () => {
    if (!dbHealth) return 'bg-muted';
    if (!dbHealth.healthy) return 'bg-destructive';
    if (dbHealth.responseTime > 1000) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getHealthText = () => {
    if (!dbHealth) return 'Verificando...';
    if (!dbHealth.healthy) return `Indisponível: ${dbHealth.message}`;
    if (dbHealth.responseTime > 1000) return `Lento: ${dbHealth.responseTime}ms`;
    return `OK: ${dbHealth.responseTime}ms`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Health Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Controle de Sincronização</h2>
          <p className="text-sm text-muted-foreground">
            Sincronização segura com proteções anti-sobrecarga
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${getHealthColor()}`} />
            <span className="text-sm">{getHealthText()}</span>
          </div>
          
          <Button variant="outline" size="sm" onClick={checkHealth}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Sync in Progress Alert */}
      {syncStatus.isRunning && (
        <Card className="border-primary bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Sincronização em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={undefined} className="h-2" />
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-background rounded-lg border">
                  <p className="text-2xl font-bold text-primary">
                    {syncStatus.recordsProcessed.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Registros</p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg border">
                  <p className="text-2xl font-bold text-blue-600">
                    {syncStatus.currentPage}
                  </p>
                  <p className="text-xs text-muted-foreground">Páginas</p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg border">
                  <p className="text-2xl font-bold text-orange-600">
                    {syncStatus.startTime 
                      ? `${Math.round((Date.now() - syncStatus.startTime) / 1000)}s`
                      : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">Tempo</p>
                </div>
                <div className="text-center p-3 bg-background rounded-lg border">
                  <p className="text-2xl font-bold text-green-600">
                    {syncStatus.eta || '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">ETA</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scope Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${config.scope === '2025' ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
          onClick={() => setConfig(prev => ({ ...prev, scope: '2025' }))}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-green-500" />
              Dados 2025
            </CardTitle>
            <CardDescription>Recomendado para início</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-3xl font-bold">{localStats.records2025.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">registros locais</p>
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                ~40k registros ERP
              </Badge>
              <p className="text-xs text-muted-foreground">
                Estimativa: 3-5 minutos
              </p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${config.scope === '2024+' ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
          onClick={() => setConfig(prev => ({ ...prev, scope: '2024+' }))}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Dados 2024+
            </CardTitle>
            <CardDescription>Últimos 2 anos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-3xl font-bold">{localStats.records2024Plus.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">registros locais</p>
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                ~100k registros ERP
              </Badge>
              <p className="text-xs text-muted-foreground">
                Estimativa: 10-15 minutos
              </p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${config.scope === 'full' ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
          onClick={() => setConfig(prev => ({ ...prev, scope: 'full' }))}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-orange-500" />
              Full Sync
            </CardTitle>
            <CardDescription>Todos os dados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-3xl font-bold">{localStats.totalRecords.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">registros locais</p>
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">
                ~220k registros ERP
              </Badge>
              <p className="text-xs text-muted-foreground">
                Estimativa: 30-45 minutos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações
          </CardTitle>
          <CardDescription>
            Ajuste os parâmetros de sincronização (valores seguros pré-definidos)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Batch Size (registros por página)</label>
              <Select 
                value={String(config.batchSize)} 
                onValueChange={(v) => setConfig(prev => ({ ...prev, batchSize: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="250">250 (mais seguro)</SelectItem>
                  <SelectItem value="500">500 (recomendado)</SelectItem>
                  <SelectItem value="750">750</SelectItem>
                  <SelectItem value="1000">1000 (máximo)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Menor = mais seguro, maior = mais rápido
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Delay entre páginas: {config.pageDelay}s</label>
              <Slider
                value={[config.pageDelay]}
                onValueChange={([v]) => setConfig(prev => ({ ...prev, pageDelay: v }))}
                min={2}
                max={5}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Delay obrigatório entre páginas (mínimo 2s, recomendado 3s)
              </p>
            </div>
          </div>

          {/* Protections Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Proteções Ativas
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Máximo 1 sync simultâneo</li>
              <li>• Verificação de saúde do banco a cada 3 páginas</li>
              <li>• Circuit breaker: pausa automática se banco lento (&gt;5s)</li>
              <li>• Rate limit: 20 requests/minuto</li>
              <li>• Retry automático com backoff exponencial</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span>Syncs ativos: {activeSyncs}/{1}</span>
        </div>

        <div className="flex gap-3">
          {syncStatus.isRunning ? (
            <Button variant="destructive" disabled>
              <StopCircle className="h-4 w-4 mr-2" />
              Sync em Andamento
            </Button>
          ) : (
            <Button 
              onClick={startSync} 
              disabled={isLoading || !dbHealth?.healthy}
              className="min-w-[200px]"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Iniciar Sync {config.scope.toUpperCase()}
            </Button>
          )}
        </div>
      </div>

      {/* N8N Instructions */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Configuração Obrigatória do N8N
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Para que a sincronização funcione corretamente, o workflow N8N <strong>DEVE</strong> ser configurado com:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-background rounded-lg border">
              <h5 className="font-medium mb-2">Split In Batches</h5>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                batchSize: {config.batchSize}
              </code>
            </div>
            
            <div className="p-3 bg-background rounded-lg border">
              <h5 className="font-medium mb-2">Wait Node</h5>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {config.pageDelay} segundos entre páginas
              </code>
            </div>
          </div>

          <div className="p-3 bg-background rounded-lg border">
            <h5 className="font-medium mb-2">Filtro SQL (se suportado)</h5>
            <code className="text-sm bg-muted px-2 py-1 rounded block">
              {config.scope === '2025' 
                ? "WHERE YEAR([Vencimento]) >= 2025"
                : config.scope === '2024+' 
                  ? "WHERE YEAR([Vencimento]) >= 2024"
                  : "-- Sem filtro de ano (todos os registros)"
              }
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

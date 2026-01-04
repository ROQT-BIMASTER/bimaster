import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useN8NSync } from '@/hooks/useN8NSync';
import { SyncControlPanel } from '@/components/financeiro/SyncControlPanel';
import { 
  RefreshCw, Wifi, WifiOff, Play, Eye, Clock, Database, Zap, 
  CheckCircle, XCircle, Loader2, TrendingUp, AlertCircle, 
  History, ArrowUpCircle, StopCircle, Shield
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ContasReceberSyncPage() {
  const {
    isLoading,
    isSyncing,
    status,
    preview,
    syncResult,
    error,
    syncHistory,
    lastSyncTimestamp,
    eta,
    syncProgress,
    testConnection,
    fetchPreview,
    syncAll,
    syncIncremental,
    cancelSync,
    getLastSyncTimestamp,
  } = useN8NSync();

  const [activeSync, setActiveSync] = useState<'full' | 'incremental' | null>(null);

  useEffect(() => {
    testConnection();
    getLastSyncTimestamp('full');
  }, []);

  const handleSyncFull = async () => {
    setActiveSync('full');
    await syncAll(5000); // Batch de 5000 registros - otimizado para 500k+ registros
    setActiveSync(null);
  };

  const handleSyncIncremental = async () => {
    setActiveSync('incremental');
    await syncIncremental();
    setActiveSync(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sincronização com ERP</h1>
            <p className="text-muted-foreground">
              Contas a Receber - Sync seguro com proteções anti-sobrecarga
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => testConnection()}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Testar Conexão
            </Button>
          </div>
        </div>

        {/* Tabs: Painel de Controle vs Modo Legado */}
        <Tabs defaultValue="control-panel" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="control-panel" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Painel Seguro
            </TabsTrigger>
            <TabsTrigger value="legacy" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Modo Rápido
            </TabsTrigger>
          </TabsList>

          <TabsContent value="control-panel" className="mt-6">
            <SyncControlPanel />
          </TabsContent>

          <TabsContent value="legacy" className="mt-6 space-y-6">
            {/* Legacy sync buttons */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Modo Rápido (Legado)
                </CardTitle>
                <CardDescription>
                  Use apenas se o Painel Seguro não estiver funcionando. Risco de sobrecarga.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  {isSyncing ? (
                    <Button variant="destructive" onClick={cancelSync}>
                      <StopCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleSyncIncremental}
                        disabled={!status?.n8n?.connected}
                      >
                        <ArrowUpCircle className="h-4 w-4 mr-2" />
                        Sync Incremental
                      </Button>
                      <Button
                        onClick={handleSyncFull}
                        disabled={!status?.n8n?.connected}
                        variant="secondary"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Sync Full (Legado)
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

        {/* Sync in Progress */}
        {isSyncing && (
          <Card className="border-primary bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Sincronização {activeSync === 'full' ? 'FULL' : 'INCREMENTAL'} em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Progress value={undefined} className="h-2" />
                
                {/* Progress Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-background rounded-lg border">
                    <p className="text-2xl font-bold text-primary">
                      {syncProgress?.recordsProcessed?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Registros Processados</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg border">
                    <p className="text-2xl font-bold text-blue-600">
                      {syncProgress?.currentPage || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Páginas</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg border">
                    <p className="text-2xl font-bold text-orange-600">
                      {syncProgress ? Math.round((Date.now() - syncProgress.startTime) / 1000) : 0}s
                    </p>
                    <p className="text-xs text-muted-foreground">Tempo Decorrido</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg border">
                    <p className="text-2xl font-bold text-green-600">
                      {syncProgress && syncProgress.recordsProcessed > 0 
                        ? Math.round(syncProgress.recordsProcessed / ((Date.now() - syncProgress.startTime) / 1000))
                        : 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Registros/seg</p>
                  </div>
                </div>

                <div className="flex justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processando lote de {syncProgress?.recordsInCurrentBatch || 500} registros...
                  </span>
                  {eta && <span className="font-medium">ETA: {eta}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* N8N Connection */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {status?.n8n?.connected ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                Conexão N8N
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status ? (
                <div className="space-y-2">
                  <Badge variant={status.n8n.connected ? 'default' : 'destructive'}>
                    {status.n8n.connected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                  {status.n8n.responseTime && (
                    <p className="text-sm text-muted-foreground">
                      {status.n8n.responseTime}ms
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Verificando...</p>
              )}
            </CardContent>
          </Card>

          {/* Local Database */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Base Local
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status?.local ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    {status.local.totalRecords.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">registros</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              )}
            </CardContent>
          </Card>

          {/* Last Sync */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Última Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lastSyncTimestamp ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {formatDistanceToNow(new Date(lastSyncTimestamp), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(lastSyncTimestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              ) : status?.local?.lastSync ? (
                <div className="space-y-1">
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(status.local.lastSync), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma</p>
              )}
            </CardContent>
          </Card>

          {/* Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {syncResult?.statistics ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold">
                    {syncResult.statistics.rate_per_second}
                  </p>
                  <p className="text-sm text-muted-foreground">rec/segundo</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">-</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sync Result */}
        {syncResult && (
          <Card className={syncResult.success ? 'border-green-500/50' : 'border-red-500/50'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {syncResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Resultado - {syncResult.mode?.toUpperCase() || 'SYNC'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {syncResult.success && syncResult.statistics ? (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Recebidos</p>
                    <p className="text-xl font-bold">{syncResult.statistics.total_received?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Processados</p>
                    <p className="text-xl font-bold text-green-600">{syncResult.statistics.processed?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Inseridos</p>
                    <p className="text-xl font-bold text-blue-600">{syncResult.statistics.inserted?.toLocaleString() || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Atualizados</p>
                    <p className="text-xl font-bold text-orange-600">{syncResult.statistics.updated?.toLocaleString() || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ignorados</p>
                    <p className="text-xl font-bold text-muted-foreground">{syncResult.statistics.skipped?.toLocaleString() || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Velocidade</p>
                    <p className="text-xl font-bold">{syncResult.statistics.rate_per_second} rec/s</p>
                  </div>
                </div>
              ) : syncResult.success && syncResult.summary ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Registros</p>
                    <p className="text-xl font-bold">{syncResult.summary.totalProcessed.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Páginas</p>
                    <p className="text-xl font-bold">{syncResult.summary.pagesProcessed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duração</p>
                    <p className="text-xl font-bold">{syncResult.summary.durationFormatted}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Velocidade</p>
                    <p className="text-xl font-bold">{syncResult.summary.recordsPerSecond} rec/s</p>
                  </div>
                </div>
              ) : (
                <p className="text-destructive">{syncResult.error}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sync History */}
        {syncHistory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Sincronizações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Processados</TableHead>
                      <TableHead className="text-right">Inseridos</TableHead>
                      <TableHead className="text-right">Atualizados</TableHead>
                      <TableHead className="text-right">Ignorados</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncHistory.slice(0, 10).map((sync) => (
                      <TableRow key={sync.id}>
                        <TableCell>
                          {format(new Date(sync.last_sync_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sync.tipo_sync === 'full' ? 'default' : 'secondary'}>
                            {sync.tipo_sync}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sync.status === 'completed' ? 'default' : sync.status === 'partial' ? 'secondary' : 'destructive'}>
                            {sync.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {sync.records_processed?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {sync.records_inserted?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell className="text-right text-orange-600">
                          {sync.records_updated?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {sync.records_skipped?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {sync.duration_ms ? `${(sync.duration_ms / 1000).toFixed(1)}s` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview dos Dados
                </CardTitle>
                <CardDescription>
                  Visualize os primeiros registros antes de sincronizar
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPreview(10)}
                disabled={isLoading || !status?.n8n?.connected}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                Carregar Preview
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {preview?.preview && preview.preview.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Valor Original</TableHead>
                      <TableHead>Valor Aberto</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.map((record, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {record.cliente_nome || record.cliente_codigo}
                        </TableCell>
                        <TableCell>
                          {record.tipo_documento}-{record.numero_documento}/{record.parcela}
                        </TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(record.valor_original || 0)}
                        </TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(record.valor_aberto || 0)}
                        </TableCell>
                        <TableCell>
                          {record.data_vencimento
                            ? new Date(record.data_vencimento).toLocaleDateString('pt-BR')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={record.status === 'pago' ? 'default' : 'secondary'}>
                            {record.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Clique em "Carregar Preview" para visualizar os dados</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Configuração Otimizada para 1M+ Registros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Sync FULL</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Chunks de 25.000 registros</li>
                  <li>• Timeout: 180s por chunk</li>
                  <li>• Ideal: 1x/dia às 02:00</li>
                  <li>• Tempo: ~15min para 1M</li>
                </ul>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Sync INCREMENTAL</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Apenas registros alterados</li>
                  <li>• Comparação por hash</li>
                  <li>• Ideal: 4x/dia (08h, 14h, 20h)</li>
                  <li>• Economia de ~90% tempo</li>
                </ul>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Performance</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Taxa: ~1.500 rec/segundo</li>
                  <li>• Batch SQL: 10.000 registros</li>
                  <li>• Retry: 5x com backoff</li>
                  <li>• Monitoramento em tempo real</li>
                </ul>
              </div>
            </div>
            
            <div className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-700">Recomendação N8N</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure o workflow N8N com <strong>Split In Batches</strong> de 25.000 registros 
                    e <strong>Wait</strong> de 2 segundos entre chunks. Veja a documentação completa em 
                    <code className="ml-1 text-xs bg-muted px-1 rounded">docs/N8N_WORKFLOW_1M_REGISTROS.md</code>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

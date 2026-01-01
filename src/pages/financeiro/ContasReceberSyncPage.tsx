import { useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useN8NSync } from '@/hooks/useN8NSync';
import { RefreshCw, Wifi, WifiOff, Play, Eye, Clock, Database, Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ContasReceberSyncPage() {
  const {
    isLoading,
    isSyncing,
    status,
    preview,
    syncResult,
    error,
    testConnection,
    fetchPreview,
    syncAll,
  } = useN8NSync();

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sincronização com ERP</h1>
            <p className="text-muted-foreground">
              Contas a Receber via N8N Webhook
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
            <Button
              onClick={() => syncAll()}
              disabled={isSyncing || !status?.n8n?.connected}
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Sincronizar Agora
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      Tempo de resposta: {status.n8n.responseTime}ms
                    </p>
                  )}
                  {status.n8n.error && (
                    <p className="text-sm text-destructive">{status.n8n.error}</p>
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
                <div className="space-y-2">
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
                Última Sincronização
              </CardTitle>
            </CardHeader>
            <CardContent>
              {status?.local?.lastSync ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(status.local.lastSync), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                  <Badge variant={status.local.lastSyncStatus === 'completed' ? 'default' : 'secondary'}>
                    {status.local.lastSyncStatus}
                  </Badge>
                  {status.local.lastSyncRecords && (
                    <p className="text-sm text-muted-foreground">
                      {status.local.lastSyncRecords.toLocaleString()} registros
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma sincronização</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sync Result */}
        {syncResult && (
          <Card className={syncResult.success ? 'border-green-500' : 'border-red-500'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {syncResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                Resultado da Sincronização
              </CardTitle>
            </CardHeader>
            <CardContent>
              {syncResult.success && syncResult.summary ? (
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
              Sobre a Integração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Webhook N8N</h4>
                <code className="text-xs bg-muted p-2 rounded block break-all">
                  {status?.n8n?.webhookUrl || 'https://huggs.app.n8n.cloud/webhook/contas-receber-mcp'}
                </code>
              </div>
              <div>
                <h4 className="font-medium mb-2">Fluxos Ativos</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Agendado:</strong> A cada 40 minutos (automático)</li>
                  <li>• <strong>Manual:</strong> Via botão "Sincronizar Agora"</li>
                </ul>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Performance</h4>
              <p className="text-sm text-muted-foreground">
                Processamento de ~1000 registros por página. Para 1.5M de registros, 
                a sincronização completa leva aproximadamente 25-30 minutos.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useContasPagarSync, SyncMode } from '@/hooks/useContasPagarSync';
import { N8NTabContent } from './N8NTabContent';
import { DataSourceConfigPanel } from './DataSourceConfigPanel';
import { 
  RefreshCw, 
  Database, 
  Clock, 
  CheckCircle,
  XCircle,
  Loader2,
  TrendingDown,
  AlertTriangle,
  Banknote,
  Calendar,
  FileText,
  Activity,
  Server,
  Zap,
  Play,
  Settings
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ContasPagarSyncPanel() {
  const { toast } = useToast();
  const {
    isLoading,
    isSyncing,
    stats,
    syncHistory,
    lastSyncResult,
    syncMode,
    setSyncMode,
    erpConnectionStatus,
    fetchStats,
    fetchSyncHistory,
    testConnection,
    testErpConnection,
    syncDirect,
    refreshAll
  } = useContasPagarSync();

  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [anoMinimo, setAnoMinimo] = useState('2020');

  // Carregar dados iniciais
  useEffect(() => {
    fetchStats();
    fetchSyncHistory();
    testConnection().then(result => {
      setConnectionStatus(result.connected ? 'connected' : 'error');
    });
  }, [fetchStats, fetchSyncHistory, testConnection]);

  const handleRefreshAll = useCallback(async () => {
    await refreshAll();
    toast({
      title: 'Dados Atualizados',
      description: 'Estatísticas de Contas a Pagar atualizadas',
    });
  }, [refreshAll, toast]);

  const handleSyncDirect = async () => {
    await syncDirect({ anoMinimo: parseInt(anoMinimo) });
  };

  // formatCurrency importado de @/lib/formatters

  return (
    <div className="space-y-6">
      {/* Config de Fonte de Dados */}
      <DataSourceConfigPanel />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Sincronização - Contas a Pagar</h2>
          <p className="text-sm text-muted-foreground">
            Monitore a integração com o ERP e visualize estatísticas
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => testConnection().then(r => setConnectionStatus(r.connected ? 'connected' : 'error'))}
            disabled={isLoading}
          >
            {connectionStatus === 'checking' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : connectionStatus === 'connected' ? (
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 mr-2" />
            )}
            Testar Conexão
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Total de Registros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats?.totalRecords.toLocaleString() || '0'}
            </p>
            <p className="text-sm text-muted-foreground">contas sincronizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {stats?.pendentes.toLocaleString() || '0'}
            </p>
            <p className="text-sm text-muted-foreground">a vencer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Vencidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">
              {stats?.vencidas.toLocaleString() || '0'}
            </p>
            <p className="text-sm text-muted-foreground">em atraso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Última Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.lastSync ? (
              <div>
                <p className="text-lg font-medium">
                  {formatDistanceToNow(new Date(stats.lastSync), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(stats.lastSync), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma sync registrada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cards de Valores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-orange-500" />
              Total em Aberto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(stats?.totalValorAberto || 0)}
            </p>
            <p className="text-sm text-muted-foreground">valor a pagar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Banknote className="h-4 w-4 text-green-500" />
              Total Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(stats?.totalValorPago || 0)}
            </p>
            <p className="text-sm text-muted-foreground">já quitado</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Modo de Sincronização */}
      <Tabs value={syncMode} onValueChange={(v) => setSyncMode(v as SyncMode)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="n8n" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            N8N (Webhook)
          </TabsTrigger>
          <TabsTrigger value="direct" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            API Direta
          </TabsTrigger>
        </TabsList>

        {/* Tab N8N */}
        <TabsContent value="n8n" className="space-y-4">
          <N8NTabContent 
            stats={stats}
            isSyncing={isSyncing}
            onRefresh={handleRefreshAll}
          />
        </TabsContent>

        {/* Tab API Direta */}
        <TabsContent value="direct" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Sincronização Direta com ERP
              </CardTitle>
              <CardDescription>
                Conecte diretamente ao SQL Server do ERP para sincronizar dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status da Conexão ERP */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Conexão SQL Server</p>
                    <p className="text-sm text-muted-foreground">
                      {erpConnectionStatus === 'connected' ? 'Conectado ao ERP' : 
                       erpConnectionStatus === 'checking' ? 'Verificando...' :
                       erpConnectionStatus === 'error' ? 'Erro na conexão' :
                       'Não testado'}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={testErpConnection}
                  disabled={erpConnectionStatus === 'checking'}
                >
                  {erpConnectionStatus === 'checking' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : erpConnectionStatus === 'connected' ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  ) : erpConnectionStatus === 'error' ? (
                    <XCircle className="h-4 w-4 text-red-500 mr-2" />
                  ) : (
                    <Server className="h-4 w-4 mr-2" />
                  )}
                  Testar ERP
                </Button>
              </div>

              {/* Configurações de Sync */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="anoMinimo">Ano Mínimo</Label>
                  <Input
                    id="anoMinimo"
                    type="number"
                    value={anoMinimo}
                    onChange={(e) => setAnoMinimo(e.target.value)}
                    placeholder="2020"
                    min="2010"
                    max={new Date().getFullYear()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sincroniza apenas dados a partir deste ano
                  </p>
                </div>
              </div>

              {/* Botão de Sincronização */}
              <Button 
                className="w-full" 
                onClick={handleSyncDirect}
                disabled={isSyncing || erpConnectionStatus !== 'connected'}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Sincronizar Agora
                  </>
                )}
              </Button>

              {/* Resultado da Última Sync */}
              {lastSyncResult && (
                <div className={`p-4 rounded-lg ${lastSyncResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {lastSyncResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium">
                      {lastSyncResult.success ? 'Sincronização Concluída' : 'Erro na Sincronização'}
                    </span>
                  </div>
                  {lastSyncResult.statistics && (
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Processados:</span>
                        <span className="ml-1 font-medium">{lastSyncResult.statistics.inserted || lastSyncResult.statistics.updated || 0}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Erros:</span>
                        <span className="ml-1 font-medium">{lastSyncResult.statistics.errors}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duração:</span>
                        <span className="ml-1 font-medium">{((lastSyncResult.duration_ms || 0) / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
                  )}
                  {lastSyncResult.error && (
                    <p className="text-sm text-red-600 mt-2">{lastSyncResult.error}</p>
                  )}
                </div>
              )}

              {/* Instruções */}
              <div className="p-4 border border-blue-500/30 bg-blue-500/10 rounded-lg">
                <div className="flex items-start gap-2">
                  <Settings className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-700">Configuração Necessária</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Para usar a API direta, configure os secrets do ERP no backend:
                    </p>
                    <ul className="text-xs text-muted-foreground mt-2 list-disc list-inside space-y-1">
                      <li>ERP_SQL_SERVER (host:porta)</li>
                      <li>ERP_SQL_DATABASE</li>
                      <li>ERP_SQL_USER</li>
                      <li>ERP_SQL_PASSWORD</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Histórico de Sincronizações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Histórico de Sincronizações
          </CardTitle>
          <CardDescription>
            Últimas sincronizações recebidas ({syncMode === 'n8n' ? 'N8N' : 'API Direta'})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syncHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Inseridos</TableHead>
                    <TableHead className="text-right">Atualizados</TableHead>
                    <TableHead className="text-right">Ignorados</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncHistory.map((sync) => (
                    <TableRow key={sync.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {format(new Date(sync.ultima_sync), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sync.ultima_sync), "HH:mm:ss", { locale: ptBR })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            sync.status === 'success' || sync.status === 'complete' ? 'default' : 
                            sync.status === 'partial' ? 'secondary' : 
                            'destructive'
                          }
                        >
                          {sync.status === 'success' || sync.status === 'complete' ? 'Sucesso' : 
                           sync.status === 'partial' ? 'Parcial' : 
                           'Erro'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {sync.total_registros.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        +{sync.registros_inseridos.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        ~{sync.registros_atualizados.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {sync.registros_ignorados.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {sync.duracao_ms ? `${(sync.duracao_ms / 1000).toFixed(1)}s` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma sincronização registrada ainda</p>
              <p className="text-sm">Configure o workflow N8N ou use a API direta</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

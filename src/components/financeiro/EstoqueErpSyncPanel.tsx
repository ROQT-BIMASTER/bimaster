import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useEstoqueErpSync } from '@/hooks/useEstoqueErpSync';
import {
  RefreshCw, Database, Clock, CheckCircle, XCircle, Loader2,
  AlertTriangle, Package, Calendar, Activity, Server, Play, Timer, Boxes,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function EstoqueErpSyncPanel() {
  const { toast } = useToast();
  const {
    isLoading, isSyncing, stats, syncHistory, lastSyncResult,
    erpConnectionStatus, syncProgress,
    fetchStats, fetchSyncHistory, testConnection, testErpConnection,
    syncFull, syncByEmpresa, refreshAll, resetProgress,
  } = useEstoqueErpSync();

  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [empresaId, setEmpresaId] = useState('');

  useEffect(() => {
    fetchStats();
    fetchSyncHistory();
    testConnection().then(r => setConnectionStatus(r.connected ? 'connected' : 'error'));
  }, [fetchStats, fetchSyncHistory, testConnection]);

  const handleRefreshAll = useCallback(async () => {
    await refreshAll();
    toast({ title: 'Dados Atualizados', description: 'Estatísticas atualizadas' });
  }, [refreshAll, toast]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60); const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Sincronização — Estoque Distribuidoras</h2>
          <p className="text-sm text-muted-foreground">
            Engine direta SQL Server (Cust_EstoqueDistribuidora) → Banco de dados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => testConnection().then(r => setConnectionStatus(r.connected ? 'connected' : 'error'))} disabled={isLoading}>
            {connectionStatus === 'connected' ? <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> : connectionStatus === 'error' ? <XCircle className="h-4 w-4 text-red-500 mr-2" /> : <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Testar Conexão
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" />Total de SKUs</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalSkus.toLocaleString() || '0'}</p>
            <p className="text-sm text-muted-foreground">posições de estoque</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Database className="h-4 w-4" />Distribuidoras</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.distribuidorasAtivas.toLocaleString() || '0'}</p>
            <p className="text-sm text-muted-foreground">com posições</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />SKUs Zerados</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{stats?.skusZerados.toLocaleString() || '0'}</p>
            <p className="text-sm text-muted-foreground">sem saldo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Package className="h-4 w-4 text-green-500" />Valor Total Custo</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats?.valorTotalCusto || 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Motor de Sincronização (ERP → Banco)</CardTitle>
          <CardDescription>Sync direta via SQL Server — paginada por distribuidora (Empresa_Par)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Conexão SQL Server</p>
                <p className="text-sm text-muted-foreground">
                  {erpConnectionStatus === 'connected' ? 'Conectado ao ERP' : erpConnectionStatus === 'checking' ? 'Verificando...' : erpConnectionStatus === 'error' ? 'Erro na conexão' : 'Não testado'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={testErpConnection} disabled={erpConnectionStatus === 'checking'}>
              {erpConnectionStatus === 'checking' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : erpConnectionStatus === 'connected' ? <CheckCircle className="h-4 w-4 text-green-500 mr-2" /> : <Server className="h-4 w-4 mr-2" />}
              Testar ERP
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button onClick={() => syncFull()} disabled={isSyncing} className="w-full">
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Sync Full (Todas Distribuidoras)
            </Button>
            <div className="flex gap-2">
              <Input placeholder="ID Distribuidora (Empresa_Par)" value={empresaId} onChange={e => setEmpresaId(e.target.value)} />
              <Button onClick={() => empresaId && syncByEmpresa(Number(empresaId))} disabled={isSyncing || !empresaId} variant="outline">
                <Play className="h-4 w-4 mr-2" />
                Sync Distribuidora
              </Button>
            </div>
          </div>

          {syncProgress.isActive && (
            <div className="p-4 rounded-lg border bg-blue-500/10 border-blue-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="font-medium">{syncProgress.message}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1"><Timer className="h-3 w-3" /><span>{formatElapsed(syncProgress.elapsedSeconds)}</span></div>
              </div>
            </div>
          )}

          {lastSyncResult && !syncProgress.isActive && (
            <div className={`p-4 rounded-lg ${lastSyncResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                {lastSyncResult.success ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                <span className="font-medium">{lastSyncResult.success ? 'Sincronização Concluída' : 'Erro na Sincronização'}</span>
                <Button variant="ghost" size="sm" onClick={resetProgress} className="ml-auto"><XCircle className="h-4 w-4" /></Button>
              </div>
              {lastSyncResult.success && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Total:</span> <span className="font-medium">{lastSyncResult.totalRows?.toLocaleString() || 0}</span></div>
                  <div><span className="text-muted-foreground">Upserted:</span> <span className="font-medium">{lastSyncResult.upserted?.toLocaleString() || 0}</span></div>
                  <div><span className="text-muted-foreground">Mensagem:</span> <span className="font-medium">{lastSyncResult.message}</span></div>
                </div>
              )}
              {lastSyncResult.error && <p className="text-sm text-red-600 mt-2">{lastSyncResult.error}</p>}
            </div>
          )}

          {stats?.lastSync && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Última sync: {formatDistanceToNow(new Date(stats.lastSync), { addSuffix: true, locale: ptBR })} ({format(new Date(stats.lastSync), 'dd/MM/yyyy HH:mm', { locale: ptBR })})
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Histórico de Sincronizações</CardTitle>
          <CardDescription>Últimas execuções via ERP Sync Engine — Estoque</CardDescription>
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
                    <TableHead className="text-right">Upserted</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncHistory.map((sync) => (
                    <TableRow key={sync.id}>
                      <TableCell>
                        <p className="font-medium">{format(new Date(sync.ultima_sync), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(sync.ultima_sync), 'HH:mm:ss', { locale: ptBR })}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sync.status === 'success' ? 'default' : sync.status === 'partial' ? 'secondary' : 'destructive'}>
                          {sync.status === 'success' ? 'Sucesso' : sync.status === 'partial' ? 'Parcial' : 'Erro'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{sync.total_registros.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600">+{sync.registros_inseridos.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{sync.duracao_ms ? `${(sync.duracao_ms / 1000).toFixed(1)}s` : '-'}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={sync.erro_mensagem || ''}>{sync.erro_mensagem || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma sincronização registrada ainda</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

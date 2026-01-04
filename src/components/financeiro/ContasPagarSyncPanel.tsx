import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  Activity
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContasPagarStats {
  totalRecords: number;
  pendentes: number;
  vencidas: number;
  totalValorAberto: number;
  totalValorPago: number;
  lastSync: string | null;
}

interface SyncHistory {
  id: string;
  ultima_sync: string;
  total_registros: number;
  registros_inseridos: number;
  registros_atualizados: number;
  registros_ignorados: number;
  duracao_ms: number;
  status: string;
  erro_mensagem?: string;
}

export function ContasPagarSyncPanel() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<ContasPagarStats | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  // Buscar estatísticas
  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [
        totalResult,
        pendentesResult,
        vencidasResult,
        valoresResult,
        lastSyncResult
      ] = await Promise.all([
        supabase.from('contas_pagar').select('id', { count: 'exact', head: true }),
        supabase.from('contas_pagar')
          .select('id', { count: 'exact', head: true })
          .gt('valor_aberto', 0)
          .gte('data_vencimento', today),
        supabase.from('contas_pagar')
          .select('id', { count: 'exact', head: true })
          .gt('valor_aberto', 0)
          .lt('data_vencimento', today),
        supabase.from('contas_pagar')
          .select('valor_aberto, valor_pago')
          .limit(10000), // Limitar para performance
        supabase.from('sync_control')
          .select('*')
          .eq('entidade', 'contas_pagar')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
      ]);

      let totalValorAberto = 0;
      let totalValorPago = 0;
      if (valoresResult.data) {
        valoresResult.data.forEach(conta => {
          totalValorAberto += conta.valor_aberto || 0;
          totalValorPago += conta.valor_pago || 0;
        });
      }

      setStats({
        totalRecords: totalResult.count || 0,
        pendentes: pendentesResult.count || 0,
        vencidas: vencidasResult.count || 0,
        totalValorAberto,
        totalValorPago,
        lastSync: lastSyncResult.data?.ultima_sync || null
      });

      setConnectionStatus('connected');
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
      setConnectionStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Buscar histórico de sincronizações
  const fetchSyncHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('sync_control')
        .select('*')
        .eq('entidade', 'contas_pagar')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setSyncHistory(data?.map(item => ({
        id: item.id,
        ultima_sync: item.ultima_sync,
        total_registros: item.total_registros || 0,
        registros_inseridos: item.registros_inseridos || 0,
        registros_atualizados: item.registros_atualizados || 0,
        registros_ignorados: item.registros_ignorados || 0,
        duracao_ms: item.duracao_ms || 0,
        status: item.status || 'unknown',
        erro_mensagem: item.erro_mensagem || undefined
      })) || []);

    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    }
  }, []);

  // Testar conexão
  const testConnection = useCallback(async () => {
    setConnectionStatus('checking');
    try {
      const { data, error } = await supabase.functions.invoke('contas-pagar-api/stats');
      
      if (error) throw error;

      setConnectionStatus('connected');
      toast({
        title: 'Conexão OK',
        description: 'API de sincronização funcionando corretamente',
      });

      // Atualizar histórico com dados da API se disponível
      if (data?.data) {
        setSyncHistory(data.data.map((item: any) => ({
          id: item.id,
          ultima_sync: item.ultima_sync,
          total_registros: item.total_registros || 0,
          registros_inseridos: item.registros_inseridos || 0,
          registros_atualizados: item.registros_atualizados || 0,
          registros_ignorados: item.registros_ignorados || 0,
          duracao_ms: item.duracao_ms || 0,
          status: item.status || 'unknown',
          erro_mensagem: item.erro_mensagem || undefined
        })));
      }

    } catch (err) {
      console.error('Erro ao testar conexão:', err);
      setConnectionStatus('error');
      toast({
        title: 'Erro de Conexão',
        description: 'Falha ao conectar com a API de sincronização',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Refresh de tudo
  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchStats(),
      fetchSyncHistory()
    ]);
    setIsLoading(false);
    
    toast({
      title: 'Dados Atualizados',
      description: 'Estatísticas de Contas a Pagar atualizadas',
    });
  }, [fetchStats, fetchSyncHistory, toast]);

  // Carregar dados iniciais
  useEffect(() => {
    fetchStats();
    fetchSyncHistory();
  }, [fetchStats, fetchSyncHistory]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
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
            onClick={testConnection}
            disabled={isLoading}
          >
            {connectionStatus === 'checking' ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : connectionStatus === 'connected' ? (
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 mr-2" />
            )}
            Testar API
          </Button>
          
          <Button variant="outline" size="sm" onClick={refreshAll} disabled={isLoading}>
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
        {/* Total de Registros */}
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

        {/* Contas Pendentes */}
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

        {/* Contas Vencidas */}
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

        {/* Última Sincronização */}
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

      {/* Histórico de Sincronizações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Histórico de Sincronizações
          </CardTitle>
          <CardDescription>
            Últimas sincronizações recebidas do N8N/ERP
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
                            sync.status === 'success' ? 'default' : 
                            sync.status === 'partial' ? 'secondary' : 
                            'destructive'
                          }
                        >
                          {sync.status === 'success' ? 'Sucesso' : 
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
              <p className="text-sm">Configure o workflow N8N para enviar dados</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info sobre configuração N8N */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Configuração do N8N
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Endpoint de Sincronização</h4>
            <code className="text-sm bg-background px-2 py-1 rounded block overflow-x-auto">
              POST /functions/v1/contas-pagar-api/sync
            </code>
            <p className="text-sm text-muted-foreground mt-2">
              Header: <code className="bg-background px-1 rounded">x-api-key: [N8N_API_KEY]</code>
            </p>
          </div>
          
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Payload Esperado</h4>
            <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
{`{
  "contas": [
    {
      "ID Empresa": 1,
      "Empresa": "Nome Empresa",
      "Tipo": "NF",
      "Nota": "12345",
      "Seq": 1,
      "Código": "FORN001",
      "Cliente": "Fornecedor",
      "Valor_Trc": 1000.00,
      "Valor em Aberto": 500.00,
      "Emissão": "2025-01-01",
      "Vencimento": "2025-02-01"
    }
  ]
}`}
            </pre>
          </div>

          <div className="p-4 border border-amber-500/30 bg-amber-500/10 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-700">Importante</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  O N8N envia os dados automaticamente para este endpoint. 
                  Este painel apenas monitora as sincronizações recebidas.
                  Para disparar uma nova sync, execute o workflow no N8N.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mail, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Settings,
  Send,
  BarChart3,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FilaItem {
  id: string;
  cliente_codigo: string;
  cliente_nome: string;
  cliente_email: string;
  canal: string;
  status: string;
  template_nome: string;
  agendado_para: string;
  tentativas: number;
  erro_mensagem: string;
  created_at: string;
}

interface Stats {
  fila: {
    total: number;
    pendente: number;
    processando: number;
    enviado: number;
    erro: number;
    por_canal: {
      email: number;
      whatsapp: number;
      sms: number;
    };
  };
  enviados: {
    hoje: number;
    semana: number;
  };
}

export function CobrancaAutomaticaPanel() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('fila');

  // Fetch queue items
  const { data: filaItems, isLoading: loadingFila } = useQuery({
    queryKey: ['fila-cobrancas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fila_cobrancas')
        .select('*')
        .order('prioridade', { ascending: false })
        .order('agendado_para', { ascending: true })
        .limit(100);
      
      if (error) throw error;
      return data as FilaItem[];
    },
    refetchInterval: 30000,
  });

  // Fetch stats via edge function
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['cobranca-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('cobranca-automation-api/stats');
      if (error) throw error;
      return data as Stats;
    },
    refetchInterval: 60000,
  });

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['templates-cobranca'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates_cobranca')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch rules
  const { data: regras } = useQuery({
    queryKey: ['regras-cobranca'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regras_cobranca')
        .select('*')
        .order('prioridade');
      
      if (error) throw error;
      return data;
    },
  });

  // Process queue mutation
  const processarFila = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cobranca-automation-api/processar-fila', {
        method: 'POST',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Processados: ${data.enviados} enviados, ${data.erros} erros`);
      queryClient.invalidateQueries({ queryKey: ['fila-cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['cobranca-stats'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao processar fila: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'processando':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Processando</Badge>;
      case 'enviado':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Enviado</Badge>;
      case 'erro':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCanalIcon = (canal: string) => {
    switch (canal) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-500" />;
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-green-500" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      default:
        return <Mail className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Na Fila</p>
                <p className="text-2xl font-bold">{stats?.fila?.pendente || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processando</p>
                <p className="text-2xl font-bold">{stats?.fila?.processando || 0}</p>
              </div>
              <RefreshCw className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Enviados Hoje</p>
                <p className="text-2xl font-bold">{stats?.enviados?.hoje || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com Erro</p>
                <p className="text-2xl font-bold">{stats?.fila?.erro || 0}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button 
          onClick={() => processarFila.mutate()}
          disabled={processarFila.isPending}
        >
          {processarFila.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Play className="w-4 h-4 mr-2" />
          )}
          Processar Fila de Emails
        </Button>
        <Button 
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['fila-cobrancas'] });
            queryClient.invalidateQueries({ queryKey: ['cobranca-stats'] });
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="fila" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Fila ({filaItems?.filter(i => i.status === 'pendente').length || 0})
          </TabsTrigger>
          <TabsTrigger value="enviados" className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Enviados
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="regras" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Regras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fila" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Fila de Cobranças
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {loadingFila ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filaItems?.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum item na fila
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filaItems?.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getCanalIcon(item.canal)}
                          <div>
                            <p className="font-medium">{item.cliente_nome || item.cliente_codigo}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.template_nome || 'Mensagem personalizada'}
                            </p>
                            {item.erro_mensagem && (
                              <p className="text-xs text-red-500 mt-1">{item.erro_mensagem}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">
                              {format(new Date(item.agendado_para), "dd/MM HH:mm", { locale: ptBR })}
                            </p>
                            {item.tentativas > 0 && (
                              <p className="text-xs text-orange-500">
                                {item.tentativas} tentativa(s)
                              </p>
                            )}
                          </div>
                          {getStatusBadge(item.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enviados" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Histórico de Envios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {filaItems?.filter(i => i.status === 'enviado').length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum envio registrado
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filaItems?.filter(i => i.status === 'enviado').map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          {getCanalIcon(item.canal)}
                          <div>
                            <p className="font-medium">{item.cliente_nome || item.cliente_codigo}</p>
                            <p className="text-sm text-muted-foreground">{item.cliente_email}</p>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Templates de Mensagem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {templates?.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhum template cadastrado
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates?.map((template: any) => (
                      <div 
                        key={template.id} 
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getCanalIcon(template.canal)}
                            <span className="font-medium">{template.nome}</span>
                          </div>
                          <Badge variant="outline">{template.canal}</Badge>
                        </div>
                        {template.assunto && (
                          <p className="text-sm text-muted-foreground mb-2">
                            <strong>Assunto:</strong> {template.assunto}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {template.conteudo}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regras" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Regras de Escalonamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {regras?.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    Nenhuma regra cadastrada
                  </div>
                ) : (
                  <div className="space-y-3">
                    {regras?.map((regra: any) => (
                      <div 
                        key={regra.id} 
                        className="p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{regra.nome}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={regra.ativo ? "default" : "secondary"}>
                              {regra.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                            <Badge variant="outline">Prioridade {regra.prioridade}</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{regra.descricao}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2 py-1 bg-muted rounded">
                            {regra.dias_atraso_min}-{regra.dias_atraso_max || '∞'} dias
                          </span>
                          <span className="px-2 py-1 bg-muted rounded">
                            Canal: {regra.canal}
                          </span>
                          <span className="px-2 py-1 bg-muted rounded">
                            A cada {regra.intervalo_dias} dias
                          </span>
                          <span className="px-2 py-1 bg-muted rounded">
                            Max {regra.max_tentativas} tentativas
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, AlertTriangle, Info, CheckCircle, XCircle,
  Clock, ExternalLink, Trash2, BellOff, Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Alert {
  id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  mensagem: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  lido: boolean;
  acao_url: string | null;
  dados: Record<string, unknown> | null;
  created_at: string;
  destinatario: { nome: string } | null;
}

const severidadeConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  info: { label: 'Info', color: 'text-blue-500', bgColor: 'bg-blue-500/10', icon: Info },
  aviso: { label: 'Aviso', color: 'text-amber-500', bgColor: 'bg-amber-500/10', icon: AlertTriangle },
  critico: { label: 'Crítico', color: 'text-red-500', bgColor: 'bg-red-500/10', icon: AlertTriangle },
  sucesso: { label: 'Sucesso', color: 'text-green-500', bgColor: 'bg-green-500/10', icon: CheckCircle },
};

const tipoLabels: Record<string, string> = {
  sla_alerta: 'Alerta SLA',
  sla_vencido: 'SLA Vencido',
  aprovacao_pendente: 'Aprovação Pendente',
  tarefa_bloqueada: 'Tarefa Bloqueada',
  gargalo_detectado: 'Gargalo Detectado',
  prazo_proximo: 'Prazo Próximo',
  tarefa_concluida: 'Tarefa Concluída',
  campanha_iniciada: 'Campanha Iniciada',
};

export function AlertsCenter() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [severidadeFilter, setSeveridadeFilter] = useState<string>('all');

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['marketing-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_alertas')
        .select(`
          *,
          destinatario:profiles!marketing_alertas_destinatario_id_fkey(nome)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as unknown as Alert[];
    }
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_alertas')
        .update({ lido: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-alerts'] });
    }
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('marketing_alertas')
        .update({ lido: true })
        .eq('lido', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-alerts'] });
      toast.success('Todos os alertas foram marcados como lidos');
    }
  });

  const deleteAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_alertas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-alerts'] });
      toast.success('Alerta removido');
    }
  });

  const filteredAlerts = alerts?.filter(alert => {
    if (filter === 'unread' && alert.lido) return false;
    if (filter === 'read' && !alert.lido) return false;
    if (severidadeFilter !== 'all' && alert.severidade !== severidadeFilter) return false;
    return true;
  }) || [];

  const unreadCount = alerts?.filter(a => !a.lido).length || 0;
  const criticalCount = alerts?.filter(a => a.severidade === 'critico' && !a.lido).length || 0;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{alerts?.length || 0}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn(unreadCount > 0 && "border-primary/50")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Não Lidos</p>
                <p className="text-2xl font-bold text-primary">{unreadCount}</p>
              </div>
              <Bell className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn(criticalCount > 0 && "border-red-500/50")}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Críticos</p>
                <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center justify-center">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => markAllAsRead.mutate()}
              disabled={unreadCount === 0}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar Todos como Lidos
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="unread">Não Lidos</SelectItem>
              <SelectItem value="read">Lidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={severidadeFilter} onValueChange={setSeveridadeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="aviso">Aviso</SelectItem>
            <SelectItem value="critico">Crítico</SelectItem>
            <SelectItem value="sucesso">Sucesso</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Central de Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum alerta encontrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map(alert => {
                  const config = severidadeConfig[alert.severidade] || severidadeConfig.info;
                  const Icon = config.icon;
                  
                  return (
                    <div 
                      key={alert.id}
                      className={cn(
                        "p-4 rounded-lg border transition-all",
                        !alert.lido && config.bgColor,
                        !alert.lido && "border-l-4",
                        !alert.lido && alert.severidade === 'critico' && "border-l-red-500",
                        !alert.lido && alert.severidade === 'aviso' && "border-l-amber-500",
                        !alert.lido && alert.severidade === 'info' && "border-l-blue-500",
                        !alert.lido && alert.severidade === 'sucesso' && "border-l-green-500",
                        alert.lido && "opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-full", config.bgColor)}>
                          <Icon className={cn("h-4 w-4", config.color)} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">{alert.titulo}</h4>
                            <Badge variant="outline" className="text-[10px]">
                              {tipoLabels[alert.tipo] || alert.tipo}
                            </Badge>
                            {!alert.lido && (
                              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            )}
                          </div>
                          
                          {alert.mensagem && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {alert.mensagem}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(alert.created_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </div>
                            {alert.entidade_tipo && (
                              <Badge variant="secondary" className="text-[10px]">
                                {alert.entidade_tipo}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {alert.acao_url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => window.open(alert.acao_url!, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {!alert.lido && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => markAsRead.mutate(alert.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteAlert.mutate(alert.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

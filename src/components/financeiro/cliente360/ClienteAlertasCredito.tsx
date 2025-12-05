import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, AlertCircle, Info, CheckCircle2, 
  Clock, X, TrendingDown, CreditCard, Bell
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ClienteAlertasCreditoProps {
  clienteCodigo: string;
  onRefresh?: () => void;
}

export default function ClienteAlertasCredito({ clienteCodigo, onRefresh }: ClienteAlertasCreditoProps) {
  const queryClient = useQueryClient();

  const { data: alertas, isLoading, refetch } = useQuery({
    queryKey: ['cliente-alertas-credito', clienteCodigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes_alertas_credito')
        .select('*')
        .eq('cliente_codigo', clienteCodigo)
        .eq('resolvido', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!clienteCodigo
  });

  const resolverAlertaMutation = useMutation({
    mutationFn: async (alertaId: string) => {
      const { error } = await supabase
        .from('clientes_alertas_credito')
        .update({
          resolvido: true,
          resolvido_em: new Date().toISOString()
        })
        .eq('id', alertaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Alerta resolvido');
      refetch();
      onRefresh?.();
    },
    onError: () => {
      toast.error('Erro ao resolver alerta');
    }
  });

  const getSeveridadeIcon = (severidade: string) => {
    switch (severidade) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeveridadeBadge = (severidade: string) => {
    switch (severidade) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'warning':
        return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">Atenção</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'queda_score':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'limite_excedido':
        return <CreditCard className="h-4 w-4 text-orange-500" />;
      case 'pagamento_atrasado':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas de Crédito
          </CardTitle>
          {alertas && alertas.length > 0 && (
            <Badge variant="destructive">{alertas.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px] pr-4">
          <div className="space-y-3">
            {alertas?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
                <p className="font-medium">Nenhum alerta ativo</p>
                <p className="text-sm">Este cliente está em dia</p>
              </div>
            ) : (
              alertas?.map((alerta) => (
                <div
                  key={alerta.id}
                  className={`p-4 rounded-lg border ${
                    alerta.severidade === 'critical' 
                      ? 'bg-red-500/5 border-red-500/20' 
                      : alerta.severidade === 'warning'
                      ? 'bg-orange-500/5 border-orange-500/20'
                      : 'bg-blue-500/5 border-blue-500/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {getSeveridadeIcon(alerta.severidade || 'info')}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{alerta.titulo}</h4>
                          {getSeveridadeBadge(alerta.severidade || 'info')}
                        </div>
                        <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          {getTipoIcon(alerta.tipo_alerta)}
                          <span>
                            {alerta.created_at 
                              ? format(parseISO(alerta.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => resolverAlertaMutation.mutate(alerta.id)}
                      disabled={resolverAlertaMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

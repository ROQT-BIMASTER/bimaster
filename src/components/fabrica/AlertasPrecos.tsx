import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  Bell, 
  CheckCircle2, 
  Clock, 
  TrendingDown, 
  Calendar,
  XCircle,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AlertasPrecos() {
  const queryClient = useQueryClient();

  const { data: alertas, isLoading } = useQuery({
    queryKey: ["alertas-precos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_alertas_precos")
        .select(`
          *,
          tabela:tabela_id(nome, codigo),
          produto:produto_id(nome, codigo)
        `)
        .eq("resolvido", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const resolverAlertaMutation = useMutation({
    mutationFn: async (alertaId: string) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("fabrica_alertas_precos")
        .update({
          resolvido: true,
          resolvido_em: new Date().toISOString(),
          resolvido_por: user.user?.id,
        })
        .eq("id", alertaId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alerta marcado como resolvido");
      queryClient.invalidateQueries({ queryKey: ["alertas-precos"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao resolver alerta: " + error.message);
    },
  });

  const marcarLidoMutation = useMutation({
    mutationFn: async (alertaId: string) => {
      const { error } = await supabase
        .from("fabrica_alertas_precos")
        .update({ lido: true })
        .eq("id", alertaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-precos"] });
    },
  });

  const getAlertaIcon = (tipo: string) => {
    switch (tipo) {
      case "validade_proxima":
        return <Calendar className="h-4 w-4" />;
      case "margem_baixa":
        return <TrendingDown className="h-4 w-4" />;
      case "preco_defasado":
        return <Clock className="h-4 w-4" />;
      case "variacao_alta":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeveridadeColor = (severidade: string) => {
    switch (severidade) {
      case "critical":
        return "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
      case "warning":
        return "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20";
      default:
        return "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20";
    }
  };

  const getSeveridadeBadge = (severidade: string) => {
    switch (severidade) {
      case "critical":
        return <Badge variant="destructive">Crítico</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500">Atenção</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const alertasNaoLidos = alertas?.filter(a => !a.lido).length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Alertas de Preços</h2>
          {alertasNaoLidos > 0 && (
            <Badge variant="destructive">{alertasNaoLidos} novo(s)</Badge>
          )}
        </div>
      </div>

      {/* Lista de Alertas */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Carregando alertas...
          </CardContent>
        </Card>
      ) : alertas?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
            <p className="text-lg font-medium">Tudo certo!</p>
            <p className="text-muted-foreground">Nenhum alerta pendente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alertas?.map((alerta) => (
            <Card 
              key={alerta.id} 
              className={`border-l-4 ${getSeveridadeColor(alerta.severidade)} ${!alerta.lido ? 'ring-2 ring-primary/20' : ''}`}
              onClick={() => !alerta.lido && marcarLidoMutation.mutate(alerta.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-full ${
                      alerta.severidade === 'critical' ? 'bg-red-100 text-red-600' :
                      alerta.severidade === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {getAlertaIcon(alerta.tipo_alerta)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{alerta.titulo}</h3>
                        {getSeveridadeBadge(alerta.severidade)}
                        {!alerta.lido && <Badge variant="outline" className="text-xs">Novo</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {alerta.mensagem}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {alerta.tabela && (
                          <span>Tabela: <strong>{alerta.tabela.nome}</strong></span>
                        )}
                        {alerta.produto && (
                          <span>Produto: <strong>{alerta.produto.nome}</strong></span>
                        )}
                        <span>
                          {format(new Date(alerta.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        resolverAlertaMutation.mutate(alerta.id);
                      }}
                      disabled={resolverAlertaMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Resolver
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

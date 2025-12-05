import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClienteHistoricoPagamentosProps {
  clienteCodigo: string;
}

export default function ClienteHistoricoPagamentos({ clienteCodigo }: ClienteHistoricoPagamentosProps) {
  const { data: titulos, isLoading } = useQuery({
    queryKey: ['cliente-historico-pagamentos', clienteCodigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_receber')
        .select('*')
        .eq('cliente_codigo', clienteCodigo)
        .order('data_vencimento', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!clienteCodigo
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const getStatusBadge = (status: string, diasAtraso?: number) => {
    switch (status) {
      case 'recebido':
        if (diasAtraso && diasAtraso > 0) {
          return (
            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 gap-1">
              <Clock className="h-3 w-3" />
              Pago c/ atraso
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Pago em dia
          </Badge>
        );
      case 'vencido':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Vencido
          </Badge>
        );
      case 'pendente':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 gap-1">
            <Clock className="h-3 w-3" />
            Pendente
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
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
        <CardTitle className="text-sm">Histórico de Pagamentos</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {titulos?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum título encontrado
              </p>
            ) : (
              titulos?.map((titulo) => (
                <div
                  key={titulo.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {titulo.numero_documento || 'S/N'}
                      </span>
                      {getStatusBadge(titulo.status || '', titulo.dias_atraso)}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>
                        Venc: {titulo.data_vencimento 
                          ? format(parseISO(titulo.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </span>
                      {titulo.data_recebimento && (
                        <span>
                          Pago: {format(parseISO(titulo.data_recebimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      )}
                      {titulo.dias_atraso && titulo.dias_atraso > 0 && (
                        <span className="text-orange-500">
                          {titulo.dias_atraso} dias de atraso
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(titulo.valor_original || 0)}</p>
                    {titulo.valor_aberto && titulo.valor_aberto > 0 && (
                      <p className="text-xs text-red-500">
                        Aberto: {formatCurrency(titulo.valor_aberto)}
                      </p>
                    )}
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

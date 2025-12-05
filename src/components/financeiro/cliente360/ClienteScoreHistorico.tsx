import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

interface ClienteScoreHistoricoProps {
  clienteCodigo: string;
}

export default function ClienteScoreHistorico({ clienteCodigo }: ClienteScoreHistoricoProps) {
  const { data: historico, isLoading } = useQuery({
    queryKey: ['cliente-score-historico', clienteCodigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes_score_historico')
        .select('*')
        .eq('cliente_codigo', clienteCodigo)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!clienteCodigo
  });

  const chartData = historico?.map(item => ({
    data: format(parseISO(item.created_at || ''), 'dd/MM', { locale: ptBR }),
    score: item.score_novo,
    anterior: item.score_anterior
  })) || [];

  const getTendenciaIcon = (anterior: number, novo: number) => {
    const diff = novo - anterior;
    if (diff > 25) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    if (diff < -25) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getMotivoLabel = (motivo: string) => {
    const labels: Record<string, string> = {
      'atualização_automatica': 'Atualização Automática',
      'ajuste_manual': 'Ajuste Manual',
      'pagamento_recebido': 'Pagamento Recebido',
      'novo_atraso': 'Novo Atraso'
    };
    return labels[motivo] || motivo;
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
    <div className="space-y-4">
      {/* Gráfico de Evolução */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Evolução do Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="data" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    domain={[0, 1000]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  {/* Linhas de referência */}
                  <ReferenceLine y={800} stroke="hsl(142.1 76.2% 36.3%)" strokeDasharray="3 3" />
                  <ReferenceLine y={500} stroke="hsl(47.9 95.8% 53.1%)" strokeDasharray="3 3" />
                  <ReferenceLine y={350} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-emerald-500" />
                <span>Excelente (800+)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-yellow-500" />
                <span>Regular (500)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-destructive" />
                <span>Crítico (350)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Alterações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Histórico de Alterações</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {historico?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma alteração de score registrada
                </p>
              ) : (
                historico?.slice().reverse().map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {getTendenciaIcon(item.score_anterior || 0, item.score_novo)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {item.score_anterior || 0} → {item.score_novo}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {item.score_novo - (item.score_anterior || 0) > 0 ? '+' : ''}
                            {item.score_novo - (item.score_anterior || 0)} pts
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {getMotivoLabel(item.motivo || '')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {item.created_at 
                        ? format(parseISO(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                        : '-'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

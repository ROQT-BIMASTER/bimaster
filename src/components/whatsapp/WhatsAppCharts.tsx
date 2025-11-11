import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, TrendingUp, MessageSquareText } from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChartDataPoint {
  date: string;
  conversas: number;
  mensagens: number;
  taxaConversao: number;
  completas: number;
}

interface WhatsAppChartsProps {
  dateRange?: { start: Date; end: Date };
  userId?: string;
}

export function WhatsAppCharts({ dateRange, userId }: WhatsAppChartsProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchChartData();
  }, [dateRange, userId]);

  async function fetchChartData() {
    try {
      setLoading(true);
      
      // Definir período padrão (últimos 30 dias)
      const endDate = dateRange?.end || new Date();
      const startDate = dateRange?.start || subDays(endDate, 30);
      
      // Criar array com todos os dias do período
      const daysInPeriod = eachDayOfInterval({ start: startDate, end: endDate });
      
      // Buscar conversas do período
      let conversationsQuery = supabase
        .from("whatsapp_conversations")
        .select("id, status, created_at, user_id")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (userId) {
        conversationsQuery = conversationsQuery.eq("user_id", userId);
      }

      const { data: conversations, error: convError } = await conversationsQuery;

      if (convError) throw convError;

      // Buscar mensagens do período
      const conversationIds = conversations?.map(c => c.id) || [];
      let messagesData: any[] = [];

      if (conversationIds.length > 0) {
        const { data: messages } = await supabase
          .from("whatsapp_messages")
          .select("id, conversation_id, timestamp, sender")
          .in("conversation_id", conversationIds)
          .gte("timestamp", startDate.toISOString())
          .lte("timestamp", endDate.toISOString());

        messagesData = messages || [];
      }

      // Agrupar dados por dia
      const dataByDay: Record<string, ChartDataPoint> = {};
      
      daysInPeriod.forEach(day => {
        const dayKey = format(day, "dd/MM");
        dataByDay[dayKey] = {
          date: dayKey,
          conversas: 0,
          mensagens: 0,
          taxaConversao: 0,
          completas: 0,
        };
      });

      // Contar conversas por dia
      conversations?.forEach(conv => {
        const dayKey = format(new Date(conv.created_at), "dd/MM");
        if (dataByDay[dayKey]) {
          dataByDay[dayKey].conversas++;
          if (conv.status === "completed") {
            dataByDay[dayKey].completas++;
          }
        }
      });

      // Contar mensagens por dia
      messagesData.forEach(msg => {
        const dayKey = format(new Date(msg.timestamp), "dd/MM");
        if (dataByDay[dayKey]) {
          dataByDay[dayKey].mensagens++;
        }
      });

      // Calcular taxa de conversão
      Object.values(dataByDay).forEach(data => {
        if (data.conversas > 0) {
          data.taxaConversao = Math.round((data.completas / data.conversas) * 100);
        }
      });

      // Converter para array e ordenar por data
      const chartArray = Object.values(dataByDay);
      
      setChartData(chartArray);
    } catch (error: any) {
      console.error("Erro ao carregar dados dos gráficos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os gráficos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico de Volume de Conversas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Volume de Conversas
          </CardTitle>
          <CardDescription>
            Total de conversas iniciadas por dia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar 
                dataKey="conversas" 
                name="Conversas" 
                fill="hsl(var(--primary))" 
                radius={[8, 8, 0, 0]}
              />
              <Bar 
                dataKey="completas" 
                name="Completas" 
                fill="hsl(var(--chart-2))" 
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Taxa de Conversão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Taxa de Conversão
          </CardTitle>
          <CardDescription>
            Percentual de conversas concluídas com sucesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => `${value}%`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="taxaConversao" 
                name="Taxa de Conversão (%)" 
                stroke="hsl(var(--chart-3))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-3))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Volume de Mensagens */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            Volume de Mensagens
          </CardTitle>
          <CardDescription>
            Total de mensagens trocadas por dia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="conversas" 
                name="Conversas" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="mensagens" 
                name="Mensagens" 
                stroke="hsl(var(--chart-4))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-4))', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

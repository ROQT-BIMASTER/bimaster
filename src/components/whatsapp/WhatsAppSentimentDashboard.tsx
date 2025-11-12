import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RefreshCw, Smile, Meh, Frown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
}

interface ConversationWithSentiment {
  id: string;
  phone_number: string;
  status: string;
  sentiment: string | null;
  sentiment_score: number | null;
  sentiment_analyzed_at: string | null;
  created_at: string;
}

const SENTIMENT_COLORS = {
  positive: 'hsl(var(--chart-2))',
  neutral: 'hsl(var(--chart-3))',
  negative: 'hsl(var(--chart-1))',
};

export function WhatsAppSentimentDashboard() {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [sentimentData, setSentimentData] = useState<SentimentData>({ positive: 0, neutral: 0, negative: 0 });
  const [conversations, setConversations] = useState<ConversationWithSentiment[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchSentimentData();
  }, []);

  async function fetchSentimentData() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('id, phone_number, status, sentiment, sentiment_score, sentiment_analyzed_at, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setConversations(data || []);

      // Contar sentimentos
      const counts = { positive: 0, neutral: 0, negative: 0 };
      data?.forEach(conv => {
        if (conv.sentiment === 'positive') counts.positive++;
        else if (conv.sentiment === 'neutral') counts.neutral++;
        else if (conv.sentiment === 'negative') counts.negative++;
      });

      setSentimentData(counts);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados de sentimento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function analyzeAllConversations() {
    try {
      setAnalyzing(true);

      const unanalyzed = conversations.filter(c => !c.sentiment && c.status !== 'active');
      
      if (unanalyzed.length === 0) {
        toast({
          title: "Nenhuma conversa para analisar",
          description: "Todas as conversas completas já foram analisadas",
        });
        return;
      }

      let analyzed = 0;
      for (const conv of unanalyzed) {
        try {
          const { error } = await supabase.functions.invoke('analyze-whatsapp-sentiment', {
            body: { conversationId: conv.id }
          });

          if (!error) analyzed++;
        } catch (err) {
          console.error(`Erro ao analisar conversa ${conv.id}:`, err);
        }
      }

      toast({
        title: "Análise concluída",
        description: `${analyzed} conversas foram analisadas com sucesso`,
      });

      await fetchSentimentData();
    } catch (error: any) {
      console.error('Erro na análise:', error);
      toast({
        title: "Erro",
        description: "Não foi possível analisar as conversas",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  const pieData = [
    { name: 'Positivas', value: sentimentData.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutras', value: sentimentData.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negativas', value: sentimentData.negative, color: SENTIMENT_COLORS.negative },
  ];

  const barData = [
    { sentiment: 'Positivas', count: sentimentData.positive, fill: SENTIMENT_COLORS.positive },
    { sentiment: 'Neutras', count: sentimentData.neutral, fill: SENTIMENT_COLORS.neutral },
    { sentiment: 'Negativas', count: sentimentData.negative, fill: SENTIMENT_COLORS.negative },
  ];

  const totalAnalyzed = sentimentData.positive + sentimentData.neutral + sentimentData.negative;
  const positiveRate = totalAnalyzed > 0 ? ((sentimentData.positive / totalAnalyzed) * 100).toFixed(1) : '0';

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
    <div className="space-y-6">
      {/* Header com ações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Análise de Sentimento IA
              </CardTitle>
              <CardDescription>
                Identificação automática de conversas positivas, neutras e negativas
              </CardDescription>
            </div>
            <Button
              onClick={analyzeAllConversations}
              disabled={analyzing}
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Analisar Conversas
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Analisadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAnalyzed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Smile className="h-4 w-4 text-green-500" />
              Positivas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{sentimentData.positive}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {positiveRate}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Meh className="h-4 w-4 text-yellow-500" />
              Neutras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{sentimentData.neutral}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Frown className="h-4 w-4 text-red-500" />
              Negativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{sentimentData.negative}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Pizza */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Sentimentos</CardTitle>
            <CardDescription>Proporção de cada tipo de sentimento</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Barras */}
        <Card>
          <CardHeader>
            <CardTitle>Comparativo de Sentimentos</CardTitle>
            <CardDescription>Volume por tipo de sentimento</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="sentiment" 
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
                <Bar dataKey="count" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Lista de conversas recentes com sentimento */}
      <Card>
        <CardHeader>
          <CardTitle>Conversas Recentes Analisadas</CardTitle>
          <CardDescription>Últimas conversas com análise de sentimento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {conversations
              .filter(c => c.sentiment)
              .slice(0, 10)
              .map(conv => (
                <div
                  key={conv.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    {conv.sentiment === 'positive' && <Smile className="h-5 w-5 text-green-500" />}
                    {conv.sentiment === 'neutral' && <Meh className="h-5 w-5 text-yellow-500" />}
                    {conv.sentiment === 'negative' && <Frown className="h-5 w-5 text-red-500" />}
                    
                    <div>
                      <div className="font-medium">{conv.phone_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(conv.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        conv.sentiment === 'positive' ? 'default' :
                        conv.sentiment === 'neutral' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {conv.sentiment === 'positive' ? 'Positivo' :
                       conv.sentiment === 'neutral' ? 'Neutro' :
                       'Negativo'}
                    </Badge>
                    
                    {conv.sentiment_score !== null && (
                      <span className="text-sm text-muted-foreground">
                        Score: {conv.sentiment_score.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            
            {conversations.filter(c => c.sentiment).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma conversa analisada ainda. Clique em "Analisar Conversas" para começar.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

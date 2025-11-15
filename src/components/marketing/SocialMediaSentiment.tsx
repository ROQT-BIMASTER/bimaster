import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Smile, Frown, Meh } from "lucide-react";
import { toast } from "sonner";

interface SentimentData {
  platform: string;
  username: string;
  sentiment_score: number | null;
  sentiment_label: string | null;
  created_at: string;
}

export function SocialMediaSentiment() {
  const [sentiments, setSentiments] = useState<SentimentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadSentimentData();
  }, []);

  const loadSentimentData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("social_media_metrics_history")
        .select("platform, username, sentiment_score, sentiment_label, created_at")
        .not("sentiment_score", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setSentiments(data || []);
    } catch (error) {
      console.error("Erro ao carregar sentimentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeSentiment = async () => {
    try {
      setAnalyzing(true);
      const { data: accounts } = await supabase
        .from("social_media_accounts")
        .select("platform, username");

      if (!accounts?.length) {
        toast.error("Configure contas de redes sociais primeiro");
        return;
      }

      // Analisar cada conta
      for (const account of accounts) {
        await supabase.functions.invoke("analyze-whatsapp-sentiment", {
          body: {
            platform: account.platform,
            username: account.username,
          },
        });
      }

      toast.success("Análise de sentimento iniciada!");
      setTimeout(loadSentimentData, 3000);
    } catch (error: any) {
      console.error("Erro ao analisar sentimento:", error);
      toast.error(error.message || "Erro ao analisar sentimento");
    } finally {
      setAnalyzing(false);
    }
  };

  const getSentimentIcon = (label: string | null) => {
    switch (label?.toLowerCase()) {
      case "positive":
      case "positivo":
        return <Smile className="h-5 w-5 text-green-500" />;
      case "negative":
      case "negativo":
        return <Frown className="h-5 w-5 text-red-500" />;
      default:
        return <Meh className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getSentimentColor = (label: string | null) => {
    switch (label?.toLowerCase()) {
      case "positive":
      case "positivo":
        return "bg-green-500";
      case "negative":
      case "negativo":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const averageSentiment =
    sentiments.length > 0
      ? sentiments.reduce((acc, curr) => acc + (curr.sentiment_score || 0), 0) /
        sentiments.length
      : 0;

  const positivePct =
    sentiments.length > 0
      ? (sentiments.filter(
          (s) =>
            s.sentiment_label?.toLowerCase() === "positive" ||
            s.sentiment_label?.toLowerCase() === "positivo"
        ).length /
          sentiments.length) *
        100
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Análise de Sentimento</h3>
        <Button
          onClick={analyzeSentiment}
          disabled={analyzing}
          variant="outline"
          size="sm"
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Analisar Agora
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Sentimento Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {averageSentiment.toFixed(1)}
              </div>
              <Progress value={averageSentiment} className="flex-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Comentários Positivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {positivePct.toFixed(0)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Analisado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentiments.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Análises Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sentiments.map((sentiment, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getSentimentIcon(sentiment.sentiment_label)}
                  <div>
                    <div className="font-medium">
                      {sentiment.platform} - @{sentiment.username}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(sentiment.created_at).toLocaleDateString(
                        "pt-BR"
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Progress
                    value={sentiment.sentiment_score || 0}
                    className="w-24"
                  />
                  <Badge
                    variant="outline"
                    className={getSentimentColor(sentiment.sentiment_label)}
                  >
                    {sentiment.sentiment_label}
                  </Badge>
                </div>
              </div>
            ))}
            {sentiments.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                Nenhuma análise de sentimento disponível.
                <br />
                Clique em "Analisar Agora" para começar.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MarketingInsightsChatProps {
  dashboardType: "looker" | "dashcortex";
  activeDashboards: Array<{ title: string; url: string }>;
}

export const MarketingInsightsChat = ({ dashboardType, activeDashboards }: MarketingInsightsChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const dashboardContext = activeDashboards
        .map(d => `- ${d.title}`)
        .join("\n");

      const contextInfo = `Tipo de dashboard: ${dashboardType === "looker" ? "Instagram (Looker Studio)" : "DashCortex"}
Dashboards ativos:
${dashboardContext}`;

      const { data, error } = await supabase.functions.invoke("marketing-insights", {
        body: {
          question: userMessage,
          dashboardContext: contextInfo
        }
      });

      if (error) throw error;

      if (data?.insight) {
        setMessages(prev => [...prev, { role: "assistant", content: data.insight }]);
      } else {
        throw new Error("Resposta inválida da IA");
      }

    } catch (error: any) {
      console.error("Erro ao gerar insight:", error);
      
      let errorMessage = "Erro ao gerar insight. Tente novamente.";
      
      if (error.message?.includes("429")) {
        errorMessage = "Limite de requisições excedido. Aguarde alguns instantes.";
      } else if (error.message?.includes("402")) {
        errorMessage = "Créditos insuficientes. Adicione créditos ao workspace.";
      }
      
      toast.error(errorMessage);
      setMessages(prev => prev.slice(0, -1)); // Remove user message on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Insights com IA
        </CardTitle>
        <CardDescription>
          Faça perguntas sobre os dashboards e obtenha insights acionáveis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Messages */}
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Pergunte algo como:</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li>"Quais são as principais tendências nos dados?"</li>
                <li>"Como está o desempenho das campanhas?"</li>
                <li>"Que recomendações você sugere?"</li>
              </ul>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg ${
                  msg.role === "user"
                    ? "bg-primary/10 ml-8"
                    : "bg-muted mr-8"
                }`}
              >
                <p className="text-sm font-medium mb-1">
                  {msg.role === "user" ? "Você" : "IA"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Gerando insight...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Faça uma pergunta sobre os dashboards..."
            className="min-h-[80px]"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="self-end"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

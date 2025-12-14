import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, Sparkles, BarChart3, TrendingUp, FileText, PanelRightOpen, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import ReactMarkdown from "react-markdown";
import { AICanvas } from "./AICanvas";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolExecuting?: string;
  isReport?: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8b5cf6', '#ec4899', '#f59e0b'];

const REPORT_TEMPLATES = [
  { label: "Relatório de Vendas", prompt: "Gere um relatório completo de vendas dos últimos 30 dias com gráficos, tabelas comparativas e análise de tendências" },
  { label: "Performance de Equipe", prompt: "Crie um relatório de performance da equipe com ranking, métricas de visitas e produtividade" },
  { label: "Análise Competitiva", prompt: "Gere um relatório de análise competitiva com share de gôndola, preços e posicionamento" },
  { label: "KPIs Executivo", prompt: "Crie um relatório executivo com os principais KPIs, gráficos de evolução e recomendações estratégicas" },
];

export const AIAnalyticsPanel = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou seu analista de dados com **IA Google Gemini Pro**. Posso:\n\n📊 **Gerar relatórios completos** com gráficos e tabelas\n📈 **Analisar tendências** e identificar padrões\n🔍 **Consultar dados** em tempo real\n📋 **Criar documentos** editáveis no Canvas\n\n💡 **Dica:** Peça para **\"gerar relatório\"** e abrirei o Canvas para edição!\n\nO que você gostaria de analisar?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "reports">("chat");
  const [canvasContent, setCanvasContent] = useState<string | null>(null);
  const [canvasTitle, setCanvasTitle] = useState("Relatório IA");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);
    setCurrentTool(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      toast({
        title: "⏱️ Tempo limite excedido",
        description: "A consulta está demorando muito (45s). Tente uma pergunta mais simples.",
        variant: "destructive",
      });
      setIsLoading(false);
    }, 45000); // 45s timeout - mais rápido!

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-analytics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: newMessages,
            userId: user.id,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("⏱️ Rate limit excedido. Aguarde alguns instantes e tente novamente.");
        }
        if (response.status === 402) {
          throw new Error("💳 Créditos insuficientes. Adicione mais créditos em Settings → Workspace → Usage.");
        }
        if (response.status === 500) {
          const errorText = await response.text();
          console.error("Server error:", errorText);
          throw new Error("🔧 Erro no servidor. Tente novamente ou contate o suporte.");
        }
        throw new Error(`❌ Erro ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream não disponível");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              assistantMessage += content;
              setMessages([
                ...newMessages,
                { role: "assistant", content: assistantMessage }
              ]);
            }
          } catch (e) {
            console.error("Error parsing SSE:", e);
          }
        }
      }

      // Check if the response looks like a report and should open Canvas
      const isReportContent = 
        assistantMessage.includes("# ") || 
        assistantMessage.includes("## ") ||
        assistantMessage.includes("```chart") ||
        assistantMessage.length > 1000 ||
        userMessage.toLowerCase().includes("relatório") ||
        userMessage.toLowerCase().includes("relatorio") ||
        userMessage.toLowerCase().includes("report") ||
        userMessage.toLowerCase().includes("canvas");

      if (isReportContent && assistantMessage.length > 500) {
        // Extract title from first heading or use default
        const titleMatch = assistantMessage.match(/^#\s+(.+)$/m);
        setCanvasTitle(titleMatch ? titleMatch[1] : "Relatório Gerado");
        setCanvasContent(assistantMessage);
      }

    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar mensagem",
        variant: "destructive",
      });
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  const generateReport = async (template: typeof REPORT_TEMPLATES[0]) => {
    setInput(template.prompt);
    setActiveTab("chat");
    // Small delay to ensure UI updates
    setTimeout(() => {
      const syntheticInput = template.prompt;
      setInput("");
      
      const newMessages = [...messages, { role: "user" as const, content: syntheticInput }];
      setMessages(newMessages);
      setIsLoading(true);

      // Call the API
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-analytics`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                messages: newMessages,
                userId: user.id,
              }),
            }
          );

          if (!response.ok) throw new Error(`Erro ${response.status}`);

          const reader = response.body?.getReader();
          if (!reader) throw new Error("Stream não disponível");

          const decoder = new TextDecoder();
          let assistantMessage = "";
          
          setMessages([...newMessages, { role: "assistant", content: "" }]);

          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim() || line.startsWith(":")) continue;
              if (!line.startsWith("data: ")) continue;

              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  assistantMessage += content;
                  setMessages([
                    ...newMessages,
                    { role: "assistant", content: assistantMessage }
                  ]);
                }
              } catch (e) {}
            }
          }

          // Auto-open canvas for reports
          setCanvasTitle(template.label);
          setCanvasContent(assistantMessage);
        } catch (error) {
          toast({
            title: "Erro",
            description: error instanceof Error ? error.message : "Erro ao gerar relatório",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      })();
    }, 100);
  };

  const handleCanvasRegenerate = async (instructions: string) => {
    if (!canvasContent) return;
    
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const refineMessages = [
        ...messages,
        { role: "user" as const, content: `Refine o relatório anterior com estas instruções: ${instructions}` }
      ];

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-analytics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: refineMessages,
            userId: user.id,
          }),
        }
      );

      if (!response.ok) throw new Error(`Erro ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Stream não disponível");

      const decoder = new TextDecoder();
      let assistantMessage = "";

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) assistantMessage += content;
          } catch (e) {}
        }
      }

      setCanvasContent(assistantMessage);
      setMessages([...refineMessages, { role: "assistant", content: assistantMessage }]);
      toast({ title: "Relatório refinado", description: "O Canvas foi atualizado com as novas instruções" });
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao refinar",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderChart = (chartConfig: any) => {
    const { type, title, data } = chartConfig;

    const chartComponent = () => {
      switch (type) {
        case "bar":
          return (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="hsl(var(--primary))" />
            </BarChart>
          );
        case "line":
          return (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" />
            </LineChart>
          );
        case "pie":
          return (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {data.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          );
        case "area":
          return (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
            </AreaChart>
          );
        default:
          return null;
      }
    };

    return (
      <Card className="p-4 my-4">
        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          {title}
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          {chartComponent()}
        </ResponsiveContainer>
      </Card>
    );
  };

  const renderMessage = (message: Message) => {
    if (message.role === "user") {
      return (
        <div className="flex justify-end mb-4">
          <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]">
            {message.content}
          </div>
        </div>
      );
    }

    // Processar markdown e extrair gráficos
    const parts = message.content.split(/(```chart[\s\S]*?```)/g);
    
    return (
      <div className="flex justify-start mb-4">
        <div className="bg-muted rounded-lg px-4 py-2 max-w-[80%]">
          {parts.map((part, index) => {
            if (part.startsWith("```chart")) {
              try {
                const jsonStr = part.replace(/```chart\n?/g, "").replace(/```/g, "").trim();
                const chartConfig = JSON.parse(jsonStr);
                return <div key={index}>{renderChart(chartConfig)}</div>;
              } catch (e) {
                console.error("Error parsing chart:", e);
                return null;
              }
            }
            return (
              <div key={index} className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>
                  {part}
                </ReactMarkdown>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const suggestedQuestions = [
    "Mostre o ranking de vendedores este mês",
    "Gere um relatório de KPIs dos últimos 30 dias",
    "Quantas visitas foram realizadas hoje?",
    "Mostre um gráfico de vendas por região",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Canvas Modal */}
      {canvasContent && (
        <AICanvas
          content={canvasContent}
          title={canvasTitle}
          onClose={() => setCanvasContent(null)}
          onRegenerate={handleCanvasRegenerate}
          isLoading={isLoading}
        />
      )}

      <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 p-6 rounded-lg mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Painel de IA Analytics</h2>
              <p className="text-sm text-muted-foreground">
                Google Gemini Pro • Relatórios interativos com Canvas
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <PanelRightOpen className="h-3 w-3" />
            Canvas Ativo
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chat" | "reports")} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat IA
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates de Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="flex-1 mt-0">
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Gerar Relatório com Canvas
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Selecione um template para gerar um relatório completo com gráficos e tabelas. 
              O Canvas será aberto automaticamente para você editar, exportar ou refinar o conteúdo.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {REPORT_TEMPLATES.map((template, index) => (
                <Card 
                  key={index} 
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-2 hover:border-primary/50"
                  onClick={() => generateReport(template)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      {index === 0 && <TrendingUp className="h-5 w-5 text-primary" />}
                      {index === 1 && <BarChart3 className="h-5 w-5 text-primary" />}
                      {index === 2 && <TrendingUp className="h-5 w-5 text-primary" />}
                      {index === 3 && <FileText className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{template.label}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.prompt}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="flex-1 flex flex-col mt-0">
          <Card className="flex-1 flex flex-col">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messages.map((message, index) => (
                <div key={index}>{renderMessage(message)}</div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Analisando com Gemini Pro...</span>
                  </div>
                </div>
              )}

              {messages.length === 1 && (
                <div className="space-y-2 mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Sugestões de perguntas:</p>
                  {suggestedQuestions.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left"
                      onClick={() => setInput(question)}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      {question}
                    </Button>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Peça um relatório, gráfico ou análise de dados..."
                  className="min-h-[60px] resize-none"
                  disabled={isLoading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="h-[60px] w-[60px]"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Peça para "gerar relatório" e o Canvas abrirá automaticamente para edição
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

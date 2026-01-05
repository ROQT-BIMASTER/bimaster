import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Bot, 
  User, 
  Trash2, 
  Square,
  PlayCircle,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  Database,
  Server,
  Shield
} from "lucide-react";
import { useQAAgent, QAMessage } from "@/hooks/useQAAgent";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const quickActions = [
  { label: "Testar Tudo", command: "/testar-tudo", icon: PlayCircle, color: "bg-primary" },
  { label: "Relatório QA", command: "/relatorio", icon: FileText, color: "bg-blue-500" },
  { label: "Ver Problemas", command: "/problemas", icon: AlertTriangle, color: "bg-yellow-500" },
  { label: "Testar Financeiro", command: "/testar financeiro", icon: Database, color: "bg-green-500" },
  { label: "Testar Funções", command: "/testar-funcoes", icon: Server, color: "bg-purple-500" },
  { label: "Verificar Segurança", command: "/testar-seguranca", icon: Shield, color: "bg-red-500" },
];

export function QAAgentChat() {
  const { 
    messages, 
    isLoading, 
    stats, 
    sendMessage, 
    stopGeneration, 
    clearMessages,
    quickTest 
  } = useQAAgent();
  
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  };

  const renderMessage = (message: QAMessage) => {
    const isUser = message.role === "user";
    
    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-3 p-4 rounded-lg",
          isUser ? "bg-muted/50" : "bg-background border"
        )}
      >
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
        )}>
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
              {isUser ? "Você" : "QA Agent"}
            </span>
            <span className="text-xs text-muted-foreground">
              {message.timestamp.toLocaleTimeString()}
            </span>
            {message.isStreaming && (
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
            )}
          </div>
          
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                code: ({ children }) => (
                  <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs">
                    {children}
                  </pre>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="min-w-full border-collapse text-sm">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border px-2 py-1 bg-muted font-medium text-left">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-2 py-1">{children}</td>
                ),
              }}
            >
              {message.content || (message.isStreaming ? "▊" : "")}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Agente de QA</CardTitle>
              <p className="text-xs text-muted-foreground">
                Testador inteligente do sistema
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Estatísticas */}
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="gap-1">
                <Zap className="w-3 h-3" />
                {stats.testsRun}
              </Badge>
              <Badge variant="outline" className="gap-1 text-green-600">
                <CheckCircle className="w-3 h-3" />
                {stats.testsPassed}
              </Badge>
              <Badge variant="outline" className="gap-1 text-red-600">
                <XCircle className="w-3 h-3" />
                {stats.testsFailed}
              </Badge>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={clearMessages}
              disabled={isLoading || messages.length === 0}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {quickActions.map((action) => (
            <Button
              key={action.command}
              variant="outline"
              size="sm"
              onClick={() => quickTest(action.command)}
              disabled={isLoading}
              className="gap-1.5 text-xs"
            >
              <action.icon className="w-3 h-3" />
              {action.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">Olá! Sou o Agente de QA</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Posso testar todas as funcionalidades do sistema, identificar problemas
                e sugerir correções. Use os botões acima ou digite um comando.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <code className="bg-muted px-1 rounded">/testar-tudo</code>
                  <span>Teste completo</span>
                </div>
                <div className="flex items-center gap-1">
                  <code className="bg-muted px-1 rounded">/relatorio</code>
                  <span>Relatório QA</span>
                </div>
                <div className="flex items-center gap-1">
                  <code className="bg-muted px-1 rounded">/problemas</code>
                  <span>Ver issues</span>
                </div>
                <div className="flex items-center gap-1">
                  <code className="bg-muted px-1 rounded">/testar [mod]</code>
                  <span>Testar módulo</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(renderMessage)}
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite um comando ou pergunta..."
              disabled={isLoading}
              className="flex-1"
            />
            {isLoading ? (
              <Button type="button" variant="destructive" onClick={stopGeneration}>
                <Square className="w-4 h-4 mr-1" />
                Parar
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()}>
                <Send className="w-4 h-4 mr-1" />
                Enviar
              </Button>
            )}
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

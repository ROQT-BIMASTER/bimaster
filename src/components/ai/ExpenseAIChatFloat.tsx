import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useExpenseChat } from "@/hooks/useExpenseAI";
import ReactMarkdown from "react-markdown";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
  Bot,
  User,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ExpenseAIChatFloatProps {
  context?: Record<string, unknown>;
  contextLabel?: string;
}

export function ExpenseAIChatFloat({ context = {}, contextLabel }: ExpenseAIChatFloatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const { sendMessage, isLoading } = useExpenseChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    "Qual o total de despesas pendentes?",
    "Quanto já foi gasto?",
    "Quando será o próximo pagamento?",
    "Me dê um resumo das despesas",
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    try {
      const result = await sendMessage(
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        context
      );
      if (result) {
        setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
      }
    } catch {
      // Error handled by hook
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
        size="icon"
      >
        <Sparkles className="h-5 w-5 mr-0.5" />
        <MessageCircle className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] max-h-[600px] bg-card border rounded-xl shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold">Assistente IA</h4>
            {contextLabel && (
              <p className="text-xs text-muted-foreground">{contextLabel}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 max-h-[400px] p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Sparkles className="h-8 w-8 mx-auto text-primary/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Pergunte qualquer coisa sobre as despesas
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Sugestões:</p>
              {suggestions.map((s, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs h-auto py-2 whitespace-normal text-left"
                  onClick={() => handleSend(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                    <User className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 items-center">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Pensando...
                </Badge>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua pergunta..."
            className="text-sm"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

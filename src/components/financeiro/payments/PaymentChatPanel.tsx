import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePaymentMessages, type PaymentMessage } from "@/hooks/usePaymentMessages";
import { Send, Loader2, MessageCircle, Paperclip, Check, CheckCheck, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface PaymentChatPanelProps {
  paymentQueueId: string;
  userType: "solicitante" | "financeiro";
  className?: string;
  compact?: boolean;
}

export function PaymentChatPanel({ paymentQueueId, userType, className, compact = false }: PaymentChatPanelProps) {
  const { messages, isLoading, sendMessage, isSending } = usePaymentMessages(paymentQueueId);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content) return;
    setNewMessage("");
    await sendMessage({ conteudo: content, tipo: userType });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOwnMessage = (msg: PaymentMessage) => msg.usuario_id === currentUserId;
  const isFinanceiroMessage = (msg: PaymentMessage) => msg.tipo === "financeiro";

  return (
    <div className={cn("flex flex-col border rounded-lg bg-muted/20", compact ? "h-[300px]" : "h-[400px]", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-card rounded-t-lg">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Comunicação</span>
        {messages.length > 0 && (
          <Badge variant="secondary" className="text-xs ml-auto">
            {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-2" ref={scrollRef as any}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-8">
            <MessageCircle className="h-8 w-8 opacity-40" />
            <p className="text-xs">Nenhuma mensagem ainda</p>
            <p className="text-xs opacity-60">Inicie uma conversa sobre este pagamento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isRight = isFinanceiroMessage(msg);
              const isOwn = isOwnMessage(msg);
              const readByOthers = (msg.lida_por || []).filter(id => id !== msg.usuario_id).length > 0;

              return (
                <div
                  key={msg.id}
                  className={cn("flex flex-col max-w-[80%]", isRight ? "ml-auto items-end" : "items-start")}
                >
                  {/* Sender name */}
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                    {msg.usuario_nome}
                    {msg.tipo === "financeiro" && (
                      <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-3.5 border-primary/30 text-primary">
                        Financeiro
                      </Badge>
                    )}
                  </span>

                  {/* Bubble */}
                  <div
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm break-words",
                      isRight
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.conteudo}</p>

                    {/* Attachments */}
                    {msg.anexos && msg.anexos.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.anexos.map((a, i) => (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-1.5 text-xs underline",
                              isRight ? "text-primary-foreground/80" : "text-primary"
                            )}
                          >
                            <FileText className="h-3 w-3" />
                            {a.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Time + read receipt */}
                  <div className="flex items-center gap-1 mt-0.5 px-1">
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                    </span>
                    {isOwn && (
                      readByOthers
                        ? <CheckCheck className="h-3 w-3 text-primary" />
                        : <Check className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-2 flex gap-2 items-end bg-card rounded-b-lg">
        <Textarea
          placeholder="Digite sua mensagem..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          className="resize-none min-h-[36px] text-sm"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!newMessage.trim() || isSending}
          className="shrink-0 h-9 w-9"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

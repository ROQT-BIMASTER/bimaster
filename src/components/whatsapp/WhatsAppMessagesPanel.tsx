import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageCircle, User, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  conversation_id: string;
}

interface Conversation {
  id: string;
  phone_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_name: string;
  messages: Message[];
}

interface WhatsAppMessagesPanelProps {
  filters?: {
    status?: string;
    userId?: string;
    dateRange?: { start: Date; end: Date };
  };
}

export function WhatsAppMessagesPanel({ filters }: WhatsAppMessagesPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    
    // Realtime subscription
    const channel = supabase
      .channel('whatsapp-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_conversations'
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages'
        },
        (payload) => {
          // Adicionar nova mensagem em tempo real
          const newMessage = payload.new as Message;
          setConversations(prev => prev.map(conv => {
            if (conv.id === newMessage.conversation_id) {
              return {
                ...conv,
                messages: [...conv.messages, newMessage],
              };
            }
            return conv;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filters]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConversation, conversations]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function fetchConversations() {
    try {
      let conversationsQuery = supabase
        .from("whatsapp_conversations")
        .select(`
          id,
          phone_number,
          status,
          created_at,
          updated_at,
          user_id,
          profiles!whatsapp_conversations_user_id_fkey(nome)
        `)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (filters?.status) {
        conversationsQuery = conversationsQuery.eq("status", filters.status);
      }

      if (filters?.userId) {
        conversationsQuery = conversationsQuery.eq("user_id", filters.userId);
      }

      if (filters?.dateRange) {
        conversationsQuery = conversationsQuery
          .gte("created_at", filters.dateRange.start.toISOString())
          .lte("created_at", filters.dateRange.end.toISOString());
      }

      const { data: conversationsData, error } = await conversationsQuery;

      if (error) throw error;

      // Buscar mensagens para cada conversa
      const conversationsWithMessages = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          const { data: messages } = await supabase
            .from("whatsapp_messages")
            .select("id, sender, content, timestamp, conversation_id")
            .eq("conversation_id", conv.id)
            .order("timestamp", { ascending: true });

          return {
            id: conv.id,
            phone_number: conv.phone_number,
            status: conv.status,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            user_name: (conv as any).profiles?.nome || "Usuário",
            messages: messages || [],
          };
        })
      );

      setConversations(conversationsWithMessages);
      
      // Selecionar primeira conversa automaticamente
      if (conversationsWithMessages.length > 0 && !selectedConversation) {
        setSelectedConversation(conversationsWithMessages[0].id);
      }
    } catch (error: any) {
      console.error("Erro ao carregar conversas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as conversas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive", label: string }> = {
      active: { variant: "default", label: "Ativa" },
      completed: { variant: "secondary", label: "Completa" },
      cancelled: { variant: "destructive", label: "Cancelada" },
    };

    const config = variants[status] || { variant: "default", label: status };

    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  }

  const selectedConv = conversations.find(c => c.id === selectedConversation);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Mensagens em Tempo Real
        </CardTitle>
        <CardDescription>
          Acompanhe as conversas em andamento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
          {/* Lista de Conversas */}
          <ScrollArea className="h-full border rounded-lg">
            <div className="p-2 space-y-2">
              {conversations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma conversa encontrada
                </p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv.id)}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-colors",
                      selectedConversation === conv.id
                        ? "bg-accent border-primary"
                        : "bg-card hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm truncate">{conv.phone_number}</p>
                      {getStatusBadge(conv.status)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.messages[conv.messages.length - 1]?.content || "Sem mensagens"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(conv.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Painel de Mensagens */}
          <div className="md:col-span-2 border rounded-lg flex flex-col">
            {selectedConv ? (
              <>
                {/* Header */}
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{selectedConv.phone_number}</p>
                      <p className="text-sm text-muted-foreground">{selectedConv.user_name}</p>
                    </div>
                    {getStatusBadge(selectedConv.status)}
                  </div>
                </div>

                {/* Mensagens */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {selectedConv.messages.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhuma mensagem ainda
                      </p>
                    ) : (
                      selectedConv.messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-3",
                            message.sender === "bot" ? "flex-row" : "flex-row-reverse"
                          )}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={cn(
                              message.sender === "bot" ? "bg-primary/10" : "bg-secondary/10"
                            )}>
                              {message.sender === "bot" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={cn(
                              "flex-1 max-w-[80%]",
                              message.sender === "bot" ? "text-left" : "text-right"
                            )}
                          >
                            <div
                              className={cn(
                                "inline-block p-3 rounded-lg",
                                message.sender === "bot"
                                  ? "bg-muted"
                                  : "bg-primary text-primary-foreground"
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(message.timestamp), "HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>Selecione uma conversa para ver as mensagens</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

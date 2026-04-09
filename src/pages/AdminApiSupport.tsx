import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, MessageCircle, Sparkles, Send, CheckCircle2, Clock, Filter } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface SupportMessage {
  id: string;
  api_id: string;
  endpoint_path: string;
  user_id: string;
  user_name: string | null;
  message: string;
  is_admin_reply: boolean;
  status: string;
  created_at: string;
  ai_suggested_reply: string | null;
}

export default function AdminApiSupport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["admin-support-messages", filter],
    queryFn: async () => {
      let query = supabase
        .from("api_support_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (filter === "open") query = query.eq("status", "open");
      if (filter === "answered") query = query.eq("status", "answered");

      const { data, error } = await query;
      if (error) throw error;
      return data as SupportMessage[];
    },
  });

  // Group by endpoint
  const threads = messages.reduce((acc, msg) => {
    const key = `${msg.api_id}::${msg.endpoint_path}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {} as Record<string, SupportMessage[]>);

  const threadKeys = Object.keys(threads);

  const generateAiReply = async (msg: SupportMessage) => {
    setAiLoading(msg.id);
    try {
      // Build conversation history from the thread
      const threadKey = `${msg.api_id}::${msg.endpoint_path}`;
      const threadMsgs = threads[threadKey]?.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ) || [];
      const conversationHistory = threadMsgs.map(m => ({
        role: m.is_admin_reply ? "assistant" : "user",
        content: m.message,
      }));

      const { data, error } = await supabase.functions.invoke("api-support-ai", {
        body: {
          message_id: msg.id,
          user_message: msg.message,
          endpoint_path: msg.endpoint_path,
          mode: "admin",
          conversation_history: conversationHistory,
        },
      });

      if (error) throw error;
      if (data?.suggestion) {
        setReplyText(data.suggestion);
        toast.success("Sugestão de IA gerada!");
        queryClient.invalidateQueries({ queryKey: ["admin-support-messages"] });
      }
    } catch (e) {
      toast.error("Erro ao gerar sugestão: " + (e instanceof Error ? e.message : "Erro desconhecido"));
    } finally {
      setAiLoading(null);
    }
  };

  const sendReplyMutation = useMutation({
    mutationFn: async ({ threadKey, text }: { threadKey: string; text: string }) => {
      const [apiId, endpointPath] = threadKey.split("::");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Insert admin reply
      const { error: insertErr } = await supabase.from("api_support_messages").insert({
        api_id: apiId,
        endpoint_path: endpointPath,
        user_id: user.id,
        user_name: "Admin",
        message: text,
        is_admin_reply: true,
        status: "answered",
        admin_user_id: user.id,
      });
      if (insertErr) throw insertErr;

      // Mark all open messages in this thread as answered
      const threadMsgs = threads[threadKey]?.filter(m => m.status === "open" && !m.is_admin_reply) || [];
      if (threadMsgs.length > 0) {
        await supabase
          .from("api_support_messages")
          .update({ status: "answered" })
          .in("id", threadMsgs.map(m => m.id));
      }
    },
    onSuccess: () => {
      setReplyText("");
      toast.success("Resposta enviada!");
      queryClient.invalidateQueries({ queryKey: ["admin-support-messages"] });
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const openCount = messages.filter(m => m.status === "open" && !m.is_admin_reply).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageCircle className="h-7 w-7 text-primary" />
            Suporte API — Painel Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie dúvidas de desenvolvedores com assistência de IA
          </p>
        </div>
        {openCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            {openCount} pendente{openCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Abertos</SelectItem>
            <SelectItem value="answered">Respondidos</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {threadKeys.length} thread(s), {messages.length} mensagem(s)
        </span>
      </div>

      {isLoading && <p className="text-muted-foreground text-center py-8">Carregando...</p>}

      {!isLoading && threadKeys.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
            Nenhuma mensagem de suporte encontrada.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {threadKeys.map((threadKey) => {
          const threadMsgs = threads[threadKey].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          const [apiId, endpointPath] = threadKey.split("::");
          const hasOpen = threadMsgs.some(m => m.status === "open" && !m.is_admin_reply);
          const isSelected = selectedThread === threadKey;

          return (
            <Card key={threadKey} className={`transition-colors ${hasOpen ? "border-primary/40" : ""}`}>
              <CardHeader
                className="cursor-pointer pb-3"
                onClick={() => setSelectedThread(isSelected ? null : threadKey)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span className="font-mono text-primary">{endpointPath}</span>
                    <Badge variant="outline" className="text-[10px]">{apiId}</Badge>
                    {hasOpen ? (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <Clock className="h-3 w-3" /> Pendente
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Respondido
                      </Badge>
                    )}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {threadMsgs.length} msg(s)
                  </span>
                </div>
              </CardHeader>

              {isSelected && (
                <CardContent className="space-y-4">
                  {/* Messages */}
                  <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                    {threadMsgs.map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-lg px-4 py-3 text-sm ${
                          msg.is_admin_reply
                            ? "bg-primary/10 border border-primary/20 ml-8"
                            : "bg-muted mr-8"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-xs">
                            {msg.is_admin_reply ? "Admin" : msg.user_name || "Usuário"}
                          </span>
                          <div className="flex items-center gap-2">
                            {msg.status === "open" && !msg.is_admin_reply && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] gap-1"
                                onClick={() => generateAiReply(msg)}
                                disabled={aiLoading === msg.id}
                              >
                                <Sparkles className="h-3 w-3" />
                                {aiLoading === msg.id ? "Gerando..." : "IA"}
                              </Button>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{msg.message}</ReactMarkdown>
                        </div>
                        {msg.ai_suggested_reply && (
                          <div className="mt-2 p-2 bg-background rounded border border-dashed text-xs">
                            <div className="flex items-center gap-1 mb-1 font-medium text-primary">
                              <Sparkles className="h-3 w-3" /> Sugestão IA
                            </div>
                            <div className="prose prose-sm max-w-none text-xs">
                              <ReactMarkdown>{msg.ai_suggested_reply}</ReactMarkdown>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-1 h-6 text-[10px]"
                              onClick={() => setReplyText(msg.ai_suggested_reply || "")}
                            >
                              Usar como resposta
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Reply */}
                  <div className="border-t pt-3 space-y-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Escreva sua resposta ou use a sugestão da IA..."
                      className="min-h-[80px] text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          const lastOpen = threadMsgs.filter(m => !m.is_admin_reply && m.status === "open").pop();
                          if (lastOpen) generateAiReply(lastOpen);
                        }}
                        disabled={!!aiLoading}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Gerar resposta com IA
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          if (!replyText.trim()) return;
                          sendReplyMutation.mutate({ threadKey, text: replyText.trim() });
                        }}
                        disabled={!replyText.trim() || sendReplyMutation.isPending}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Enviar Resposta
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

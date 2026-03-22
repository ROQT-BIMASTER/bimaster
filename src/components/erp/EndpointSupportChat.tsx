import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, X, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface Props {
  apiId: string;
  endpointPath: string;
}

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
}

export default function EndpointSupportChat({ apiId, endpointPath }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["support-chat", apiId, endpointPath],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_support_messages")
        .select("*")
        .eq("api_id", apiId)
        .eq("endpoint_path", endpointPath)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as SupportMessage[];
    },
    enabled: open,
  });

  const openCount = messages.filter(m => m.status === "open" && !m.is_admin_reply).length;

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("api_support_messages").insert({
        api_id: apiId,
        endpoint_path: endpointPath,
        user_id: user.id,
        user_name: user.email?.split("@")[0] || "Usuário",
        message: msg,
        is_admin_reply: false,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["support-chat", apiId, endpointPath] });
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`support-${apiId}-${endpointPath}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "api_support_messages",
        filter: `api_id=eq.${apiId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["support-chat", apiId, endpointPath] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, apiId, endpointPath, queryClient]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors mt-2"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <span>Dúvida sobre este endpoint?</span>
        {openCount > 0 && (
          <Badge variant="destructive" className="text-[9px] h-4 px-1 min-w-[16px] justify-center">
            {openCount}
          </Badge>
        )}
      </button>
    );
  }

  return (
    <div className="mt-3 border rounded-lg bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 rounded-t-lg">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">Suporte — {endpointPath}</span>
          {openCount > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1">
              {openCount} aberta{openCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-48 overflow-y-auto p-3 space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground text-center">Carregando...</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhuma mensagem ainda. Envie sua dúvida!
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.is_admin_reply ? "items-start" : "items-end"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                msg.is_admin_reply
                  ? "bg-primary/10 text-foreground border border-primary/20"
                  : "bg-muted text-foreground"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-medium text-[10px]">
                  {msg.is_admin_reply ? "Admin" : msg.user_name || "Você"}
                </span>
                {msg.status === "answered" && (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                )}
              </div>
              <p className="whitespace-pre-wrap">{msg.message}</p>
              <span className="text-[9px] text-muted-foreground mt-1 block">
                {format(new Date(msg.created_at), "dd/MM HH:mm")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t p-2 flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva sua dúvida..."
          className="min-h-[36px] h-9 text-xs resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

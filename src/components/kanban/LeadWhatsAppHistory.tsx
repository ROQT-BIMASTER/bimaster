import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Mic, Image, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id: string;
  tipo: string;
  conteudo: string;
  direcao: string;
  remetente_nome: string | null;
  created_at: string;
}

interface LeadWhatsAppHistoryProps {
  prospectId: string;
  prospectName: string;
}

export const LeadWhatsAppHistory = ({ prospectId, prospectName }: LeadWhatsAppHistoryProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mockMessages: Message[] = [
    { id: "mock-1", tipo: "text", conteudo: "Olá! Gostaria de saber mais sobre os produtos da linha premium.", direcao: "inbound", remetente_nome: prospectName, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: "mock-2", tipo: "text", conteudo: "Olá! Claro, temos condições especiais para novos parceiros. Posso enviar nosso catálogo?", direcao: "outbound", remetente_nome: "Você", created_at: new Date(Date.now() - 86400000 * 2 + 300000).toISOString() },
    { id: "mock-3", tipo: "text", conteudo: "Sim, por favor! E gostaria de agendar uma visita técnica também.", direcao: "inbound", remetente_nome: prospectName, created_at: new Date(Date.now() - 86400000 * 2 + 600000).toISOString() },
    { id: "mock-4", tipo: "image", conteudo: "Catálogo Premium 2025.pdf", direcao: "outbound", remetente_nome: "Você", created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: "mock-5", tipo: "text", conteudo: "Recebi o catálogo! Os preços são para pedido mínimo de quantas unidades?", direcao: "inbound", remetente_nome: prospectName, created_at: new Date(Date.now() - 86400000 + 1800000).toISOString() },
    { id: "mock-6", tipo: "audio", conteudo: "Áudio explicando condições comerciais", direcao: "outbound", remetente_nome: "Você", created_at: new Date(Date.now() - 86400000 + 3600000).toISOString() },
    { id: "mock-7", tipo: "text", conteudo: "Perfeito, vou analisar e retorno até sexta-feira com o pedido.", direcao: "inbound", remetente_nome: prospectName, created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: "mock-8", tipo: "text", conteudo: "Ótimo! Fico no aguardo. Qualquer dúvida estou à disposição. 👍", direcao: "outbound", remetente_nome: "Você", created_at: new Date(Date.now() - 1800000).toISOString() },
  ];

  useEffect(() => {
    fetchMessages();
  }, [prospectId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("lead_messages")
      .select("*")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: true });
    const realMessages = data || [];
    setMessages(realMessages.length > 0 ? realMessages : mockMessages);
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("lead_messages").insert({
      prospect_id: prospectId,
      tipo: "text",
      conteudo: newMessage.trim(),
      direcao: "outbound",
      remetente_nome: "Você",
    });
    setNewMessage("");
    fetchMessages();
    setSending(false);
  };

  const groupByDate = (msgs: Message[]) => {
    const groups: Record<string, Message[]> = {};
    msgs.forEach(m => {
      const date = format(new Date(m.created_at), "dd/MM/yyyy", { locale: ptBR });
      if (!groups[date]) groups[date] = [];
      groups[date].push(m);
    });
    return groups;
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const grouped = groupByDate(messages);

  return (
    <div className="flex flex-col h-[60vh] rounded-lg border bg-[hsl(var(--muted)/0.3)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
          {prospectName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold">{prospectName}</p>
          <p className="text-xs text-muted-foreground">Histórico de mensagens</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date}>
            <div className="flex justify-center my-3">
              <span className="text-[10px] bg-muted px-3 py-1 rounded-full text-muted-foreground">
                {date}
              </span>
            </div>
            {msgs.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma mensagem registrada.
          </p>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t bg-card">
        <Input
          placeholder="Escrever mensagem..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 h-9"
        />
        <Button size="icon" onClick={sendMessage} disabled={sending || !newMessage.trim()} className="h-9 w-9 rounded-full">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direcao === "outbound";
  const time = format(new Date(message.created_at), "HH:mm");

  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"} mb-1`}>
      <div
        className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
          isOutbound
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border rounded-bl-sm"
        }`}
      >
        {!isOutbound && message.remetente_nome && (
          <p className="text-xs font-semibold text-primary mb-0.5">{message.remetente_nome}</p>
        )}

        {message.tipo === "audio" ? (
          <div className="flex items-center gap-2 py-1">
            <Mic className="h-4 w-4" />
            <div className="h-1 flex-1 bg-current/20 rounded-full">
              <div className="h-1 w-2/3 bg-current/60 rounded-full" />
            </div>
            <span className="text-[10px]">0:23</span>
          </div>
        ) : message.tipo === "image" ? (
          <div className="flex items-center gap-2 py-1">
            <Image className="h-4 w-4" />
            <span className="text-xs italic">{message.conteudo}</span>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.conteudo}</p>
        )}

        <div className={`flex items-center gap-1 justify-end mt-0.5 ${isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          <span className="text-[10px]">{time}</span>
          {isOutbound && <CheckCheck className="h-3 w-3" />}
        </div>
      </div>
    </div>
  );
}

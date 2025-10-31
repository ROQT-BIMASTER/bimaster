import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Mensagem {
  id: string;
  conteudo: string;
  remetente_id: string;
  created_at: string;
  remetente?: {
    nome: string;
  };
}

interface ChatWindowProps {
  conversaId: string | null;
}

export const ChatWindow = ({ conversaId }: ChatWindowProps) => {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [nomeConversa, setNomeConversa] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (conversaId) {
      fetchMensagens();
      fetchNomeConversa();
      marcarComoLida();
      const cleanup = subscribeToMensagens();
      return cleanup;
    }
  }, [conversaId]);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const subscribeToMensagens = () => {
    if (!conversaId) return;

    const channel = supabase
      .channel(`mensagens-${conversaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
          filter: `conversa_id=eq.${conversaId}`
        },
        () => {
          fetchMensagens();
          marcarComoLida();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchNomeConversa = async () => {
    if (!conversaId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: conversa } = await supabase
        .from("conversas")
        .select("nome, tipo")
        .eq("id", conversaId)
        .single();

      if (conversa?.tipo === "grupo") {
        setNomeConversa(conversa.nome || "Grupo");
      } else {
        const { data: outroParticipante } = await supabase
          .from("conversas_participantes")
          .select(`
            profiles (nome)
          `)
          .eq("conversa_id", conversaId)
          .neq("usuario_id", user.id)
          .single();

        setNomeConversa((outroParticipante as any)?.profiles?.nome || "Conversa");
      }
    } catch (error) {
      console.error("Erro ao buscar nome da conversa:", error);
    }
  };

  const fetchMensagens = async () => {
    if (!conversaId) return;

    try {
      const { data, error } = await supabase
        .from("mensagens")
        .select(`
          *,
          profiles:remetente_id (nome)
        `)
        .eq("conversa_id", conversaId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMensagens(
        (data || []).map((msg: any) => ({
          ...msg,
          remetente: { nome: msg.profiles?.nome || "Usuário" }
        }))
      );
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as mensagens",
        variant: "destructive",
      });
    }
  };

  const marcarComoLida = async () => {
    if (!conversaId || !userId) return;

    try {
      await supabase
        .from("mensagens")
        .update({ lida: true })
        .eq("conversa_id", conversaId)
        .neq("remetente_id", userId)
        .eq("lida", false);
    } catch (error) {
      console.error("Erro ao marcar mensagens como lidas:", error);
    }
  };

  const handleEnviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMensagem.trim() || !conversaId) return;

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("mensagens")
        .insert([{
          conversa_id: conversaId,
          remetente_id: user.id,
          conteudo: novaMensagem.trim()
        }]);

      if (error) throw error;

      setNovaMensagem("");
    } catch (error: any) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar a mensagem",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getIniciais = (nome: string) => {
    return nome
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (!conversaId) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground p-8">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Selecione uma conversa</p>
          <p className="text-sm">Escolha uma conversa para começar a trocar mensagens</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle>{nomeConversa}</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {mensagens.map((mensagem) => {
          const isOwn = mensagem.remetente_id === userId;
          return (
            <div
              key={mensagem.id}
              className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
            >
              <Avatar className="h-8 w-8 mt-1">
                <AvatarFallback className="text-xs">
                  {getIniciais(mensagem.remetente?.nome || "?")}
                </AvatarFallback>
              </Avatar>
              <div className={`flex flex-col ${isOwn ? "items-end" : ""} max-w-[70%]`}>
                {!isOwn && (
                  <span className="text-xs text-muted-foreground mb-1">
                    {mensagem.remetente?.nome}
                  </span>
                )}
                <div
                  className={`rounded-lg px-4 py-2 ${
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{mensagem.conteudo}</p>
                </div>
                <span className="text-xs text-muted-foreground mt-1">
                  {format(new Date(mensagem.created_at), "HH:mm", { locale: ptBR })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4">
        <form onSubmit={handleEnviarMensagem} className="flex gap-2">
          <Input
            value={novaMensagem}
            onChange={(e) => setNovaMensagem(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={loading}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={loading || !novaMensagem.trim()}
            aria-label="Enviar mensagem"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
};

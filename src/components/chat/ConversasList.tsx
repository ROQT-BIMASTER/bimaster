import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { NovaConversaDialog } from "./NovaConversaDialog";

interface Conversa {
  id: string;
  nome: string | null;
  tipo: string;
  updated_at: string;
  ultimaMensagem?: {
    conteudo: string;
    created_at: string;
  };
  mensagensNaoLidas: number;
  outroUsuario?: {
    nome: string;
  };
}

interface ConversasListProps {
  onSelectConversa: (conversaId: string) => void;
  conversaSelecionada: string | null;
}

export const ConversasList = ({ onSelectConversa, conversaSelecionada }: ConversasListProps) => {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConversas();
    const cleanup = subscribeToConversas();
    return cleanup;
  }, []);

  const subscribeToConversas = () => {
    const channel = supabase
      .channel('conversas-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversas'
        },
        () => {
          fetchConversas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchConversas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar conversas do usuário
      const { data: participacoes, error: participacoesError } = await supabase
        .from("conversas_participantes")
        .select(`
          conversa_id,
          conversas (
            id,
            nome,
            tipo,
            updated_at
          )
        `)
        .eq("usuario_id", user.id);

      if (participacoesError) throw participacoesError;

      const conversasComDetalhes = await Promise.all(
        (participacoes || []).map(async (part: any) => {
          const conversa = part.conversas;
          
          // Buscar todas as informações em paralelo
          const [ultimaMensagemResult, naoLidasResult, outroParticipanteResult] = await Promise.all([
            supabase
              .from("mensagens")
              .select("conteudo, created_at")
              .eq("conversa_id", conversa.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("mensagens")
              .select("*", { count: "exact", head: true })
              .eq("conversa_id", conversa.id)
              .eq("lida", false)
              .neq("remetente_id", user.id),
            conversa.tipo === "privada" 
              ? supabase
                  .from("conversas_participantes")
                  .select("usuario_id, profiles (nome)")
                  .eq("conversa_id", conversa.id)
                  .neq("usuario_id", user.id)
                  .maybeSingle()
              : Promise.resolve({ data: null })
          ]);

          const outroUsuario = outroParticipanteResult.data
            ? { nome: (outroParticipanteResult.data as any).profiles?.nome || "Usuário" }
            : null;

          return {
            ...conversa,
            ultimaMensagem: ultimaMensagemResult.data,
            mensagensNaoLidas: naoLidasResult.count || 0,
            outroUsuario
          };
        })
      );

      setConversas(conversasComDetalhes.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ));
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as conversas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getNomeConversa = (conversa: Conversa) => {
    if (conversa.tipo === "grupo") {
      return conversa.nome || "Grupo sem nome";
    }
    return conversa.outroUsuario?.nome || "Usuário";
  };

  const getIniciais = (nome: string) => {
    return nome
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return <div className="p-4 text-center">Carregando conversas...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Conversas</h2>
          <Button size="sm" onClick={() => setDialogAberto(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p>Nenhuma conversa ainda</p>
            <p className="text-sm">Inicie uma nova conversa</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {conversas.map((conversa) => (
              <Card
                key={conversa.id}
                className={`cursor-pointer hover:bg-accent transition-colors ${
                  conversaSelecionada === conversa.id ? "bg-accent" : ""
                }`}
                onClick={() => onSelectConversa(conversa.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {getIniciais(getNomeConversa(conversa))}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium truncate">
                          {getNomeConversa(conversa)}
                        </h3>
                        {conversa.ultimaMensagem && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(conversa.ultimaMensagem.created_at), "HH:mm", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">
                          {conversa.ultimaMensagem?.conteudo || "Sem mensagens"}
                        </p>
                        {conversa.mensagensNaoLidas > 0 && (
                          <Badge variant="default" className="ml-2">
                            {conversa.mensagensNaoLidas}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <NovaConversaDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onSuccess={(conversaId) => {
          setDialogAberto(false);
          onSelectConversa(conversaId);
          fetchConversas();
        }}
      />
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Mensagem {
  id: string;
  revisao_id: string;
  usuario_id: string | null;
  usuario_nome: string;
  conteudo: string;
  tipo: "usuario" | "diretoria";
  insumo_id: string | null;
  created_at: string;
}

interface InsumoRef {
  id: string;
  nome: string;
  codigo: string;
}

interface Props {
  revisaoId: string;
  insumos?: InsumoRef[];
  tipoRemetente?: "usuario" | "diretoria";
  insumosComApontamento?: Set<string>;
  onNavigateToInsumo?: (insumoId: string) => void;
}

export function RevisaoChatPanel({ revisaoId, insumos = [], tipoRemetente = "usuario", insumosComApontamento = new Set(), onNavigateToInsumo }: Props) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState("");
  const [insumoSelecionado, setInsumoSelecionado] = useState<string>("none");
  const scrollRef = useRef<HTMLDivElement>(null);

  const carregarMensagens = useCallback(async () => {
    const { data, error } = await supabase
      .from("fabrica_revisao_mensagens" as any)
      .select("*")
      .eq("revisao_id", revisaoId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMensagens(data as any as Mensagem[]);
    }
    setLoading(false);
  }, [revisaoId]);

  useEffect(() => {
    carregarMensagens();
  }, [carregarMensagens]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`revisao-chat-${revisaoId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fabrica_revisao_mensagens",
          filter: `revisao_id=eq.${revisaoId}`,
        },
        (payload) => {
          setMensagens((prev) => {
            if (prev.some((m) => m.id === (payload.new as any).id)) return prev;
            return [...prev, payload.new as any as Mensagem];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [revisaoId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const enviarMensagem = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const nome = user?.user_metadata?.nome || user?.email || "Usuário";

      await supabase.from("fabrica_revisao_mensagens" as any).insert({
        revisao_id: revisaoId,
        usuario_id: user?.id,
        usuario_nome: nome,
        conteudo: texto.trim(),
        tipo: tipoRemetente,
        insumo_id: insumoSelecionado !== "none" ? insumoSelecionado : null,
      } as any);

      setTexto("");
      setInsumoSelecionado("none");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  const getInsumoNome = (insumoId: string | null) => {
    if (!insumoId) return null;
    const insumo = insumos.find((i) => i.id === insumoId);
    return insumo ? `${insumo.codigo} - ${insumo.nome}` : null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          Comunicação — Revisão
          {mensagens.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {mensagens.length} mensagen{mensagens.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Histórico de mensagens */}
        <div
          ref={scrollRef}
          className="h-64 overflow-y-auto border rounded-lg bg-background p-3 space-y-3"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : mensagens.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Inicie a comunicação abaixo.
            </div>
          ) : (
            mensagens.map((msg) => {
              const isUsuario = msg.tipo === "usuario";
              const insumoNome = getInsumoNome(msg.insumo_id);
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUsuario ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 ${
                      isUsuario
                        ? "bg-blue-600 text-white"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <div className={`flex items-center gap-2 mb-0.5 ${
                      isUsuario ? "text-blue-100" : "text-muted-foreground"
                    }`}>
                      <span className="text-xs font-semibold">
                        {msg.usuario_nome}
                      </span>
                      <span className="text-[10px]">
                        {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {insumoNome && (
                      <Badge
                        variant={isUsuario ? "secondary" : "outline"}
                        className={`text-[10px] mb-1 py-0 ${onNavigateToInsumo ? "cursor-pointer hover:underline" : ""}`}
                        onClick={() => {
                          if (onNavigateToInsumo && msg.insumo_id) {
                            onNavigateToInsumo(msg.insumo_id);
                          }
                        }}
                      >
                        {insumoNome} {onNavigateToInsumo ? "↗" : ""}
                      </Badge>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.conteudo}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input de nova mensagem */}
        <div className="space-y-2">
          {insumos.length > 0 && (
            <Select value={insumoSelecionado} onValueChange={setInsumoSelecionado}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Contextualizar com insumo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem referência a insumo</SelectItem>
                {insumos.map((i) => {
                  const deveRevisar = insumosComApontamento.has(i.id);
                  return (
                    <SelectItem key={i.id} value={i.id}>
                      <span className={deveRevisar ? "text-destructive font-semibold" : ""}>
                        {i.codigo} - {i.nome}
                        {deveRevisar && " — Revisar"}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          <div className="flex gap-2">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                tipoRemetente === "diretoria"
                  ? "Responder ao responsável..."
                  : "Justificar valor ou enviar mensagem..."
              }
              className="min-h-[60px] text-sm resize-none"
              rows={2}
            />
            <Button
              size="icon"
              onClick={enviarMensagem}
              disabled={!texto.trim() || enviando}
              className="h-auto"
            >
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

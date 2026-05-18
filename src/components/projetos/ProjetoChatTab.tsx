import { useRef, useEffect, useState } from "react";
import { useProjetoChat } from "@/hooks/useProjetoChat";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, MessageCircle, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";
import { MentionInput } from "@/components/projetos/MentionInput";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";

interface Props {
  projetoId: string;
  highlightMsgId?: string | null;
}

export function ProjetoChatTab({ projetoId, highlightMsgId = null }: Props) {
  const { messages, isLoading, sendMessage, gerarResumoHoje } = useProjetoChat(projetoId);
  const { user } = useAuth();
  const { membros } = useProjetoMembros(projetoId);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  useEffect(() => {
    if (!highlightMsgId) return;
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-msg-id="${highlightMsgId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "rounded-md");
    const t = setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-md"), 2500);
    return () => clearTimeout(t);
  }, [highlightMsgId, messages.length]);

  const mentionUsers = (membros || []).map((m) => ({
    id: m.user_id,
    nome: m.profile?.nome || m.profile?.email || "Usuário",
    avatar_url: m.profile?.avatar_url || null,
  }));

  const handleSubmit = (conteudo: string, mentions: string[]) => {
    sendMessage.mutate({ conteudo, mentions });
    setText("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] border rounded-lg bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Chat do Projeto</h3>
          <Badge variant="outline" className="text-[10px]">{messages.length}</Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => gerarResumoHoje.mutate()}
          disabled={gerarResumoHoje.isPending}
          className="gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {gerarResumoHoje.isPending ? "Gerando..." : "Resumir hoje"}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div ref={containerRef} className="space-y-3">
          {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>}
          {!isLoading && messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhuma mensagem ainda. O resumo automático aparece todo dia às 19h.
            </p>
          )}
          {messages.map((m) => {
            const isMe = m.user_id === user?.id;
            const isSystem = m.tipo === "resumo_diario" || m.tipo === "sistema";
            return (
              <div key={m.id} data-msg-id={m.id} className={cn("flex gap-2 transition-shadow", isMe && !isSystem && "flex-row-reverse")}>
                <Avatar className="h-7 w-7 flex-shrink-0">
                  {isSystem ? (
                    <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                      <Bot className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  ) : (
                    <>
                      <AvatarImage src={m.autor?.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px] bg-muted">
                        {m.autor?.nome?.substring(0, 2).toUpperCase() || "??"}
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  isSystem
                    ? "bg-primary/5 border border-primary/20 w-full max-w-full"
                    : isMe
                      ? "bg-primary/15"
                      : "bg-muted"
                )}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {isSystem ? "Sofia (resumo automático)" : m.autor?.nome?.split(" ")[0] || "Usuário"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1">
                    <ReactMarkdown>{m.conteudo}</ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <MentionInput
          value={text}
          onChange={setText}
          onSubmit={handleSubmit}
          users={mentionUsers}
          placeholder="Mensagem... (Enter envia, Shift+Enter quebra linha)"
          minRows={2}
        />
      </div>
    </div>
  );
}

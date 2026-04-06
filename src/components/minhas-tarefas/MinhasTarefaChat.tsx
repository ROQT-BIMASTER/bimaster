import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MentionInput } from "@/components/projetos/MentionInput";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MinhaTarefaMessage } from "@/hooks/useMinhasTarefaDetalhe";

function renderMentionText(text: string) {
  const parts = text.split(/(@\w[\w\s]*?)(?=\s@|\s|$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="text-primary font-medium">{part}</span>
      );
    }
    return part;
  });
}

interface Props {
  messages: MinhaTarefaMessage[];
  sendMessage: { mutate: (data: { conteudo: string; mentions: string[] }) => void };
  teamMembers: { id: string; nome: string; avatar_url: string | null }[];
  currentUserId: string | null;
}

export function MinhasTarefaChat({ messages, sendMessage, teamMembers, currentUserId }: Props) {
  const [chatValue, setChatValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (text: string, mentionIds: string[]) => {
    sendMessage.mutate({ conteudo: text, mentions: mentionIds });
    setChatValue("");
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" /> Chat ({messages.length})
      </h4>

      <ScrollArea className="max-h-[250px]">
        <div className="space-y-2 pr-2">
          {messages.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-4">Nenhuma mensagem ainda.</p>
          )}
          {messages.map(m => {
            const isMe = m.user_id === currentUserId;
            return (
              <div key={m.id} className={cn("flex gap-1.5", isMe ? "flex-row-reverse" : "flex-row")}>
                <Avatar className="h-5 w-5 flex-shrink-0 mt-0.5">
                  <AvatarImage src={m.autor?.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                    {m.autor?.nome?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs",
                  isMe ? "bg-primary/20 text-foreground" : "bg-muted text-foreground"
                )}>
                  <p className="font-medium text-[10px] mb-0.5 text-muted-foreground">
                    {m.autor?.nome?.split(" ")[0]}
                  </p>
                  <p className="whitespace-pre-wrap">{renderMentionText(m.conteudo)}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {format(new Date(m.created_at), "HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      <MentionInput
        value={chatValue}
        onChange={setChatValue}
        onSubmit={handleSubmit}
        users={teamMembers}
        placeholder="Mensagem..."
        minRows={1}
      />
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MentionInput } from "../MentionInput";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id: string;
  conteudo: string;
  user_id: string;
  created_at: string;
  autor?: { nome: string; avatar_url: string | null } | null;
}

interface TeamMember {
  id: string;
  nome: string;
  avatar_url?: string | null;
}

function renderMentionText(text: string) {
  const parts = text.split(/(@\w[\w\s]*?)(?=\s@|\s|$)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="text-primary font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
}

interface TarefaChatPanelProps {
  messages: Message[];
  sendMessage: { mutate: (data: { conteudo: string; mentions: string[] }) => void };
  teamMembers: TeamMember[];
  criadorId: string | null;
  onClose: () => void;
}

export function TarefaChatPanel({ messages, sendMessage, teamMembers, criadorId, onClose }: TarefaChatPanelProps) {
  const [chatValue, setChatValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleChatSubmit = (text: string, mentionIds: string[]) => {
    sendMessage.mutate({ conteudo: text, mentions: mentionIds });
    setChatValue("");
  };

  return (
    <div className="w-[260px] flex flex-col bg-muted/10">
      <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
        <h4 className="text-xs font-semibold flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5" /> Chat
        </h4>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhuma mensagem ainda.</p>
          )}
          {messages.map(m => {
            const isMe = m.user_id === criadorId;
            return (
              <div key={m.id} className={cn("flex gap-1.5", isMe ? "flex-row-reverse" : "flex-row")}>
                <Avatar className="h-5 w-5 flex-shrink-0">
                  <AvatarImage src={m.autor?.avatar_url || undefined} />
                  <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                    {m.autor?.nome?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs",
                  isMe ? "bg-primary/20 text-primary-foreground" : "bg-muted text-foreground"
                )}>
                  <p className="font-medium text-[10px] mb-0.5">{m.autor?.nome?.split(" ")[0]}</p>
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
      <div className="p-2 border-t border-border/50">
        <MentionInput
          value={chatValue}
          onChange={setChatValue}
          onSubmit={handleChatSubmit}
          users={teamMembers}
          placeholder="Mensagem..."
          minRows={1}
        />
      </div>
    </div>
  );
}

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MentionInput } from "../MentionInput";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comentario {
  id: string;
  conteudo: string;
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

interface TarefaComentariosSectionProps {
  comentarios: Comentario[];
  addComentario: { mutate: (data: { conteudo: string; mentions: string[] }) => void };
  teamMembers: TeamMember[];
}

export function TarefaComentariosSection({ comentarios, addComentario, teamMembers }: TarefaComentariosSectionProps) {
  const [commentValue, setCommentValue] = useState("");

  const handleCommentSubmit = (text: string, mentionIds: string[]) => {
    addComentario.mutate({ conteudo: text, mentions: mentionIds });
  };

  return (
    <div>
      <h3 className="text-sm font-medium flex items-center gap-1.5 mb-3">
        <MessageSquare className="h-4 w-4" /> Comentários ({comentarios.length})
      </h3>
      <div className="space-y-3 mb-3">
        {comentarios.map(c => (
          <div key={c.id} className="flex gap-2">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarImage src={c.autor?.avatar_url || undefined} />
              <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                {c.autor?.nome?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{c.autor?.nome}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(c.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                </span>
              </div>
              <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">
                {renderMentionText(c.conteudo)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <MentionInput
        value={commentValue}
        onChange={setCommentValue}
        onSubmit={handleCommentSubmit}
        users={teamMembers}
        placeholder="Escreva um comentário..."
      />
    </div>
  );
}

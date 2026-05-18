import { useState, useMemo, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionInput } from "../MentionInput";
import { MessageSquare, ChevronDown } from "lucide-react";
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
  avatar_url: string | null;
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

const PAGE_SIZE = 10;

export function TarefaComentariosSection({ comentarios, addComentario, teamMembers }: TarefaComentariosSectionProps) {
  const [commentValue, setCommentValue] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Comentários mais recentes primeiro são paginados; exibimos cronológicos crescentes
  const ordered = useMemo(
    () => [...comentarios].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [comentarios]
  );

  const total = ordered.length;
  // Se houver mais que PAGE_SIZE, mostramos os mais recentes (últimos N) por padrão.
  const sliceStart = Math.max(0, total - visibleCount);
  const visible = ordered.slice(sliceStart);
  const hiddenCount = sliceStart;

  const handleCommentSubmit = (text: string, mentionIds: string[]) => {
    addComentario.mutate({ conteudo: text, mentions: mentionIds });
  };

  return (
    <div>
      <h3 className="text-sm font-medium flex items-center gap-1.5 mb-3">
        <MessageSquare className="h-4 w-4" /> Comentários ({total})
      </h3>

      {hiddenCount > 0 && (
        <div className="mb-3 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
          >
            <ChevronDown className="h-3 w-3" />
            Carregar mais {Math.min(PAGE_SIZE, hiddenCount)} (de {hiddenCount} anteriores)
          </Button>
        </div>
      )}

      <div className="space-y-3 mb-3">
        {visible.map(c => (
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
        {total === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-3">
            Nenhum comentário ainda.
          </p>
        )}
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

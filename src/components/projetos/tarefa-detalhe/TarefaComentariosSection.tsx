import { useState, useMemo, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MentionInput } from "../MentionInput";
import { MessageSquare, ChevronDown, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comentario {
  id: string;
  conteudo: string;
  created_at: string;
  edited_at?: string | null;
  user_id?: string;
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
  /** Mutação para editar comentário próprio (opcional para compat). */
  editComentario?: { mutate: (data: { id: string; conteudo: string }) => void; isPending?: boolean };
  /** UID do usuário logado — usado para permitir edição do próprio comentário. */
  currentUserId?: string | null;
  teamMembers: TeamMember[];
  /** Comentário a destacar/rolar (deep-link de menção). */
  highlightCommentId?: string | null;
}

const PAGE_SIZE = 10;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function TarefaComentariosSection({
  comentarios,
  addComentario,
  editComentario,
  currentUserId = null,
  teamMembers,
  highlightCommentId = null,
}: TarefaComentariosSectionProps) {
  const [commentValue, setCommentValue] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const ordered = useMemo(
    () => [...comentarios].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [comentarios]
  );

  const total = ordered.length;
  useEffect(() => {
    if (!highlightCommentId) return;
    const idx = ordered.findIndex(c => c.id === highlightCommentId);
    if (idx === -1) return;
    const needed = total - idx;
    if (needed > visibleCount) setVisibleCount(needed);
  }, [highlightCommentId, ordered, total, visibleCount]);

  useEffect(() => {
    if (!highlightCommentId) return;
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-comentario-id="${highlightCommentId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary", "rounded-md");
    const t = setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-md"), 2500);
    return () => clearTimeout(t);
  }, [highlightCommentId, visibleCount, ordered.length]);

  const sliceStart = Math.max(0, total - visibleCount);
  const visible = ordered.slice(sliceStart);
  const hiddenCount = sliceStart;

  const handleCommentSubmit = (text: string, mentionIds: string[]) => {
    addComentario.mutate({ conteudo: text, mentions: mentionIds });
  };

  const startEdit = (c: Comentario) => {
    setEditingId(c.id);
    setEditingValue(c.conteudo);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };
  const saveEdit = () => {
    if (!editingId || !editComentario) return;
    const trimmed = editingValue.trim();
    if (!trimmed) return;
    editComentario.mutate({ id: editingId, conteudo: trimmed });
    cancelEdit();
  };

  const canEdit = (c: Comentario) => {
    if (!editComentario || !currentUserId) return false;
    if (c.user_id !== currentUserId) return false;
    const ageMs = Date.now() - new Date(c.created_at).getTime();
    return ageMs < EDIT_WINDOW_MS;
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

      <div ref={containerRef} className="space-y-3 mb-3">
        {visible.map(c => {
          const editable = canEdit(c);
          const isEditing = editingId === c.id;
          return (
            <div key={c.id} data-comentario-id={c.id} className="group flex gap-2 p-1 transition-shadow">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={c.autor?.avatar_url || undefined} />
                <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                  {c.autor?.nome?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{c.autor?.nome}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(c.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                  </span>
                  {c.edited_at && (
                    <span
                      className="text-[10px] text-muted-foreground italic"
                      title={`Editado em ${format(new Date(c.edited_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}`}
                    >
                      (editado)
                    </span>
                  )}
                  {editable && !isEditing && (
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      aria-label="Editar comentário"
                    >
                      <Pencil className="h-3 w-3" /> Editar
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div className="mt-1 space-y-2">
                    <Textarea
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      rows={3}
                      className="text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={saveEdit}
                        disabled={!editingValue.trim() || editingValue.trim() === c.conteudo.trim() || editComentario?.isPending}
                      >
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        onClick={cancelEdit}
                      >
                        Cancelar
                      </Button>
                      <span className="text-[10px] text-muted-foreground self-center">
                        Edição permitida por até 24h após o envio.
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-wrap">
                    {renderMentionText(c.conteudo)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
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

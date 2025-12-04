import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  comentario: string;
  created_at: string;
  tipo?: string | null;
  user_id?: string;
  autor?: {
    nome?: string;
    avatar_url?: string | null;
  } | null;
}

interface TaskCommentsProps {
  tarefaId: string;
  comments: Comment[];
}

export function TaskComments({ tarefaId, comments }: TaskCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const queryClient = useQueryClient();

  const addComment = useMutation({
    mutationFn: async (comentario: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('marketing_task_comments')
        .insert({
          tarefa_id: tarefaId,
          user_id: user.id,
          comentario,
          tipo: 'comment'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', tarefaId] });
      setNewComment("");
      toast.success('Comentário adicionado!');
    },
    onError: () => toast.error('Erro ao adicionar comentário')
  });

  const handleSubmit = () => {
    if (newComment.trim()) {
      addComment.mutate(newComment.trim());
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Comentários ({comments.length})
      </h4>

      {/* Comments list */}
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        {comments.map(comment => (
          <div key={comment.id} className="flex gap-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={comment.autor?.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] bg-primary/10">
                {comment.autor?.nome?.slice(0, 2).toUpperCase() || '??'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {comment.autor?.nome || 'Usuário'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(comment.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {comment.comentario}
              </p>
            </div>
          </div>
        ))}

        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
            Nenhum comentário ainda
          </p>
        )}
      </div>

      {/* New comment input */}
      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escreva um comentário..."
          className="min-h-[60px] text-sm resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleSubmit();
            }
          }}
        />
        <Button
          size="icon"
          className="shrink-0"
          onClick={handleSubmit}
          disabled={addComment.isPending || !newComment.trim()}
        >
          {addComment.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Ctrl+Enter para enviar</p>
    </div>
  );
}
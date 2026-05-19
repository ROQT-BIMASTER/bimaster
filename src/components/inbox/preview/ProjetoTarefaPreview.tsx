/**
 * ProjetoTarefaPreview — painel rico para itens de inbox da origem
 * `projetos`/`processos` cujo `referencia_tipo` é `projeto_tarefa`.
 *
 * Mostra contexto da tarefa (projeto, prazo, responsável, descrição),
 * histórico recente de comentários/atividades e ações inline:
 * Concluir tarefa e Comentar — sem sair da Caixa de Entrada.
 */
import type { InboxItem } from "@/hooks/useInbox";
import { useTarefaResumo } from "@/hooks/inbox/useTarefaResumo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ExternalLink, FolderKanban, Clock, User, MessageSquare } from "lucide-react";
import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { formatDistanceToNow, format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface ProjetoTarefaPreviewHandle {
  triggerPrimary: () => void;
  triggerReject: () => void;
  focusComment: () => void;
}

interface Props {
  item: InboxItem;
  onOpen: () => void;
  onResolved?: () => void;
}

export const ProjetoTarefaPreview = forwardRef<ProjetoTarefaPreviewHandle, Props>(
  function ProjetoTarefaPreview({ item, onOpen, onResolved }, ref) {
    const tarefaId = item.referencia_id;
    const { data, isLoading, concluir, comentar } = useTarefaResumo(tarefaId);
    const [novoComentario, setNovoComentario] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      triggerPrimary: () => {
        if (data?.status !== "concluida" && !concluir.isPending) handleConcluir();
      },
      triggerReject: () => {
        // Tarefa não tem "rejeitar" — usamos o atalho para focar comentário.
        textareaRef.current?.focus();
      },
      focusComment: () => textareaRef.current?.focus(),
    }));

    async function handleConcluir() {
      await concluir.mutateAsync();
      onResolved?.();
    }

    async function handleComentar() {
      const t = novoComentario.trim();
      if (!t) return;
      await comentar.mutateAsync(t);
      setNovoComentario("");
    }

    if (isLoading) {
      return (
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      );
    }

    if (!data) {
      return (
        <div className="p-6 text-sm text-muted-foreground">
          Não foi possível carregar esta tarefa.
        </div>
      );
    }

    const concluida = data.status === "concluida";
    const atrasada = data.data_prazo && !concluida && isPast(data.data_prazo);

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Contexto */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
            {data.projeto_nome && (
              <div className="flex items-center gap-2 text-xs">
                <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Projeto:</span>
                <span className="font-medium">{data.projeto_nome}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <Badge variant={concluida ? "secondary" : "outline"} className="text-[10px] capitalize">
                {data.status.replace(/_/g, " ")}
              </Badge>
              {data.data_prazo && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] gap-1",
                    atrasada && "border-destructive/40 text-destructive",
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {format(data.data_prazo, "dd/MM/yyyy", { locale: ptBR })}
                </Badge>
              )}
              {data.responsavel_nome && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <User className="h-3 w-3" />
                  {data.responsavel_nome}
                </Badge>
              )}
            </div>
          </div>

          {/* Descrição */}
          {data.descricao && (
            <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
              {data.descricao}
            </div>
          )}

          {/* Comentários */}
          {data.comentarios.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Últimas atividades ({data.comentarios.length})
              </p>
              <ul className="space-y-2">
                {data.comentarios.map((c) => (
                  <li key={c.id} className="flex gap-2 text-xs">
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{c.user_nome ?? "Sistema"}</span>
                        <span className="text-muted-foreground capitalize">· {c.tipo.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground ml-auto text-[10px]">
                          {formatDistanceToNow(new Date(c.created_at), {
                            addSuffix: true, locale: ptBR,
                          })}
                        </span>
                      </div>
                      {c.descricao && (
                        <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{c.descricao}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Caixa de comentário */}
          {!concluida && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Novo comentário
              </p>
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  placeholder="Comente nesta tarefa..."
                  className="text-sm min-h-[60px] flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleComentar}
                  disabled={!novoComentario.trim() || comentar.isPending}
                  className="self-start"
                >
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer de ações */}
        <div className="border-t p-3 bg-muted/20 flex items-center gap-2 flex-wrap">
          {!concluida ? (
            <Button
              size="sm"
              onClick={handleConcluir}
              disabled={concluir.isPending}
              className="gap-1.5"
            >
              <Check className="h-4 w-4" /> Concluir tarefa
            </Button>
          ) : (
            <Badge variant="secondary" className="text-xs">Tarefa concluída</Badge>
          )}
          {item.action_url && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpen}
              className="ml-auto gap-1.5 text-muted-foreground hover:text-foreground"
            >
              Abrir tarefa <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  },
);

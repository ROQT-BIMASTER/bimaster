/**
 * AprovacaoPreview — painel rico estilo "leitor de e-mail" para
 * itens de inbox da origem `aprovacoes`.
 *
 * Carrega instância + etapa atual + histórico via useAprovacaoDetalhe
 * e expõe ações Aprovar / Rejeitar com motivo / Comentar inline,
 * sem sair da Caixa de Entrada.
 */
import type { InboxItem } from "@/hooks/useInbox";
import { useAprovacaoDetalhe } from "@/hooks/inbox/useAprovacaoDetalhe";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, X, ExternalLink, FolderKanban, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useState, useRef, useImperativeHandle, forwardRef } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface AprovacaoPreviewHandle {
  triggerPrimary: () => void;
  triggerReject: () => void;
  focusComment: () => void;
}

interface Props {
  item: InboxItem;
  onOpen: () => void;
  onResolved?: () => void;
}

export const AprovacaoPreview = forwardRef<AprovacaoPreviewHandle, Props>(
  function AprovacaoPreview({ item, onOpen, onResolved }, ref) {
    const aprovadorId = item.referencia_id;
    const { data, isLoading, decidir } = useAprovacaoDetalhe(aprovadorId);
    const [comentario, setComentario] = useState("");
    const [showReject, setShowReject] = useState(false);
    const [motivoReject, setMotivoReject] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      triggerPrimary: () => {
        if (data?.podeDecidir && !decidir.isPending) handleAprovar();
      },
      triggerReject: () => {
        if (data?.podeDecidir && !decidir.isPending) setShowReject(true);
      },
      focusComment: () => textareaRef.current?.focus(),
    }));

    async function handleAprovar() {
      await decidir.mutateAsync({
        decisao: "aprovado",
        comentario: comentario.trim() || undefined,
      });
      onResolved?.();
    }

    async function handleRejeitar() {
      if (!motivoReject.trim()) return;
      await decidir.mutateAsync({ decisao: "rejeitado", comentario: motivoReject.trim() });
      setShowReject(false);
      setMotivoReject("");
      onResolved?.();
    }

    if (isLoading) {
      return (
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      );
    }

    if (!data) {
      return (
        <div className="p-6 text-sm text-muted-foreground">
          Não foi possível carregar esta aprovação.
        </div>
      );
    }

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
            {data.tarefa_titulo && (
              <div className="text-xs">
                <span className="text-muted-foreground">Tarefa:</span>{" "}
                <span className="font-medium">{data.tarefa_titulo}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                Etapa: {data.etapa_nome ?? "—"}
              </Badge>
              {data.prazo_em && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Clock className="h-3 w-3" />
                  até {format(new Date(data.prazo_em), "dd/MM HH:mm", { locale: ptBR })}
                </Badge>
              )}
              {!data.podeDecidir && (
                <Badge variant="secondary" className="text-[10px]">
                  Aguardando outro responsável
                </Badge>
              )}
            </div>
          </div>

          {/* Histórico */}
          {data.eventos.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Histórico ({data.eventos.length})
              </p>
              <ul className="space-y-2">
                {data.eventos.map((ev) => {
                  const Icon =
                    ev.decisao === "aprovado" ? CheckCircle2 :
                    ev.decisao === "rejeitado" ? XCircle : Clock;
                  const color =
                    ev.decisao === "aprovado" ? "text-success" :
                    ev.decisao === "rejeitado" ? "text-destructive" : "text-muted-foreground";
                  return (
                    <li key={ev.id} className="flex gap-2 text-xs">
                      <Icon className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">{ev.etapa_nome ?? "Etapa"}</span>
                          {ev.decisao && (
                            <span className={cn("capitalize", color)}>· {ev.decisao}</span>
                          )}
                          {ev.decidido_nome && (
                            <span className="text-muted-foreground">por {ev.decidido_nome}</span>
                          )}
                          <span className="text-muted-foreground ml-auto text-[10px]">
                            {formatDistanceToNow(new Date(ev.created_at), {
                              addSuffix: true, locale: ptBR,
                            })}
                          </span>
                        </div>
                        {ev.comentario && (
                          <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">
                            {ev.comentario}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Comentário opcional */}
          {data.podeDecidir && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Comentário (opcional)
              </p>
              <Textarea
                ref={textareaRef}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Adicione contexto à sua decisão..."
                className="text-sm min-h-[72px]"
              />
            </div>
          )}
        </div>

        {/* Footer de ações */}
        <div className="border-t p-3 bg-muted/20 flex items-center gap-2 flex-wrap">
          {data.podeDecidir ? (
            <>
              <Button
                size="sm"
                onClick={handleAprovar}
                disabled={decidir.isPending}
                className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
              >
                <Check className="h-4 w-4" /> Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowReject(true)}
                disabled={decidir.isPending}
                className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4" /> Rejeitar
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Você não é o responsável atual desta etapa.
            </span>
          )}
          {item.action_url && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpen}
              className="ml-auto gap-1.5 text-muted-foreground hover:text-foreground"
            >
              Abrir tela <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <AlertDialog open={showReject} onOpenChange={setShowReject}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rejeitar aprovação</AlertDialogTitle>
              <AlertDialogDescription>
                Informe o motivo. O solicitante poderá revisar e reenviar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea
              autoFocus
              value={motivoReject}
              onChange={(e) => setMotivoReject(e.target.value)}
              placeholder="Motivo da rejeição..."
              className="min-h-[100px]"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRejeitar}
                disabled={!motivoReject.trim() || decidir.isPending}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                Rejeitar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  },
);

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Link2, Link2Off, Pencil, User, Clock, History } from "lucide-react";
import { useAuditEvidenciasDoEspelho } from "@/hooks/useProcessoTarefaEspelho";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  espelhoId: string | null;
  contexto?: { projeto?: string | null; tarefa?: string | null };
}

/**
 * Modal com a trilha completa de auditoria de uma tarefa-espelho:
 * lista, em ordem cronológica, todos os eventos de vínculo/alteração/remoção
 * de documento oficial usado como evidência.
 */
export function EspelhoTimelineDialog({ open, onOpenChange, espelhoId, contexto }: Props) {
  const { data = [], isLoading } = useAuditEvidenciasDoEspelho(espelhoId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Linha do tempo da evidência
          </DialogTitle>
          {contexto && (
            <DialogDescription className="text-xs">
              {contexto.projeto ?? "Projeto"} › {contexto.tarefa ?? "(tarefa)"}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
            Ainda não há registros de vínculo/alteração de documento oficial nesta tarefa.
          </div>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4 py-2">
            {data.map((ev) => {
              const Icon =
                ev.acao === "vinculado" ? Link2 : ev.acao === "removido" ? Link2Off : Pencil;
              const cor =
                ev.acao === "vinculado"
                  ? "text-success"
                  : ev.acao === "removido"
                  ? "text-destructive"
                  : "text-warning";
              return (
                <li key={ev.id} className="ml-4">
                  <span className="absolute -left-[7px] flex h-3 w-3 items-center justify-center rounded-full bg-background border border-border">
                    <Icon className={`h-2.5 w-2.5 ${cor}`} />
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium capitalize">{ev.acao}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
                    {ev.acao === "vinculado" && ev.documento_novo_label && (
                      <p>
                        Documento vinculado:{" "}
                        <span className="font-medium text-foreground">{ev.documento_novo_label}</span>
                      </p>
                    )}
                    {ev.acao === "removido" && ev.documento_anterior_label && (
                      <p>
                        Documento removido:{" "}
                        <span className="font-medium text-foreground">{ev.documento_anterior_label}</span>
                      </p>
                    )}
                    {ev.acao === "alterado" && (
                      <p>
                        De{" "}
                        <span className="font-medium text-foreground">
                          {ev.documento_anterior_label ?? "—"}
                        </span>{" "}
                        → para{" "}
                        <span className="font-medium text-foreground">
                          {ev.documento_novo_label ?? "—"}
                        </span>
                      </p>
                    )}
                    {ev.observacao_nova && (
                      <p className="italic">"{ev.observacao_nova}"</p>
                    )}
                    {ev.alterado_por_nome && (
                      <p className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ev.alterado_por_nome}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCalendarioHistorico, rotuloCampo } from "@/hooks/useCalendarioHistorico";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventoId?: string | null;
  recorrenciaId?: string | null;
  titulo?: string;
}

const ACAO_LABEL: Record<string, string> = {
  criado: "Criou o evento",
  editado: "Editou o evento",
  reagendado: "Reagendou o evento",
};

/** Histórico de alterações de um evento do Calendário Geral. */
export function CalendarioHistoricoDialog({ open, onOpenChange, eventoId, recorrenciaId, titulo }: Props) {
  const { data: entradas = [], isLoading } = useCalendarioHistorico(
    open ? eventoId : null,
    recorrenciaId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de alterações
          </DialogTitle>
          <DialogDescription>
            {titulo ? `Registros de "${titulo}".` : "Quem alterou, o que mudou e o alcance da edição."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando histórico...</p>}

          {!isLoading && entradas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma alteração registrada até agora.</p>
          )}

          <ol className="space-y-3">
            {entradas.map((h) => (
              <li key={h.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {ACAO_LABEL[h.acao] ?? h.acao}
                  </span>
                  <Badge variant={h.escopo === "serie" ? "default" : "secondary"} className="text-[10px]">
                    {h.escopo === "serie" ? "Série inteira" : "Somente esta ocorrência"}
                  </Badge>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {h.autor_nome ?? "Usuário do sistema"} ·{" "}
                  {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>

                {h.alteracoes.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {h.alteracoes.map((a, i) => (
                      <li key={`${h.id}-${i}`} className="text-muted-foreground">
                        <span className="text-foreground">{rotuloCampo(a.campo)}:</span>{" "}
                        {a.de ?? "—"} → {a.para ?? "—"}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

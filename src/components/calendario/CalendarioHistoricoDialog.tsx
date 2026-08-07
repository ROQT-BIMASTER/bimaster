import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, FileDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useCalendarioHistorico, rotuloCampo } from "@/hooks/useCalendarioHistorico";
import { buildHistoricoCsv, downloadCsv } from "@/lib/calendario/historicoCsv";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventoId?: string | null;
  recorrenciaId?: string | null;
  titulo?: string;
  /** Abre o histórico consolidado de todos os eventos visíveis. */
  todos?: boolean;
}

const ACAO_LABEL: Record<string, string> = {
  criado: "Criou o evento",
  editado: "Editou o evento",
  reagendado: "Reagendou o evento",
  excluido: "Excluiu o evento",
};

/** Histórico de alterações de um evento do Calendário Geral. */
export function CalendarioHistoricoDialog({
  open, onOpenChange, eventoId, recorrenciaId, titulo, todos = false,
}: Props) {
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");

  const { data: entradas = [], isLoading } = useCalendarioHistorico(
    open ? eventoId : null,
    recorrenciaId,
    { desde: desde || null, ate: ate || null, todos: open && todos },
  );

  const periodoLabel = useMemo(() => {
    if (desde && ate) return `${desde} a ${ate}`;
    if (desde) return `a partir de ${desde}`;
    if (ate) return `até ${ate}`;
    return "todo o período";
  }, [desde, ate]);

  const exportar = () => {
    if (!entradas.length) {
      toast.error("Não há registros no período selecionado.");
      return;
    }
    const blob = buildHistoricoCsv(entradas, {
      escopo: todos ? "Todos os eventos visíveis" : (titulo || eventoId || "Evento"),
      periodo: periodoLabel,
    });
    downloadCsv(blob, `historico-calendario-${format(new Date(), "yyyy-MM-dd")}.csv`);
    toast.success("Histórico exportado em CSV.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de alterações
          </DialogTitle>
          <DialogDescription>
            {todos
              ? "Registros de todos os eventos que você pode visualizar."
              : titulo
                ? `Registros de "${titulo}".`
                : "Quem alterou, o que mudou e o alcance da edição."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-8 w-[150px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-8 w-[150px] text-xs" />
          </div>
          {(desde || ate) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setDesde(""); setAte(""); }}>
              Limpar
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs ml-auto" onClick={exportar} disabled={isLoading}>
            <FileDown className="h-3.5 w-3.5 mr-1.5" />
            Exportar CSV
          </Button>
        </div>

        <ScrollArea className="max-h-[55vh] pr-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando histórico...</p>}

          {!isLoading && entradas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma alteração registrada no período.</p>
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

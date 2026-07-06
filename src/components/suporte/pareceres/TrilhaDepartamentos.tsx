import { useTicketTrilhaDepartamentos } from "@/hooks/suporte/usePareceres";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props { ticketId: string }

export function TrilhaDepartamentos({ ticketId }: Props) {
  const { data: rows = [], isLoading } = useTicketTrilhaDepartamentos(ticketId);
  const { data: filas = [] } = useSuporteFilas();

  if (isLoading || rows.length === 0) return null;

  const nome = (id: string | null) =>
    id ? filas.find((f) => f.id === id)?.nome ?? "—" : "—";

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium mb-2 text-muted-foreground">
        Trilha de departamentos
      </p>
      <ol className="flex flex-wrap items-center gap-1.5">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center gap-1.5">
            <Badge
              variant={r.status === "ativo" ? "default" : "outline"}
              className="text-[10px] gap-1"
            >
              {r.status === "ativo" ? (
                <Clock className="h-3 w-3" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              {nome(r.fila_id)}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(r.entrou_em), "dd/MM HH:mm", { locale: ptBR })}
              {r.saiu_em && ` → ${format(new Date(r.saiu_em), "dd/MM HH:mm", { locale: ptBR })}`}
            </span>
            {r.acao_resumo && (
              <span className="text-[10px] italic text-muted-foreground">
                — {r.acao_resumo}
              </span>
            )}
            {i < rows.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * TarefaAcoesHistoricoResumo — resumo colapsável no topo do chat da tarefa com o
 * histórico de envios para aprovação e chamadas de atenção (data e usuário).
 */
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, ShieldCheck, AlertOctagon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useTarefaAcoesHistorico } from "@/hooks/chat/useTarefaAcoesHistorico";

interface Props {
  tarefaId?: string | null;
  className?: string;
  defaultOpen?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  aprovada: "Aprovado",
  rejeitado: "Rejeitado",
  rejeitada: "Rejeitado",
  cancelado: "Cancelado",
};

export function TarefaAcoesHistoricoResumo({ tarefaId, className, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const { data, isLoading } = useTarefaAcoesHistorico(tarefaId);

  if (!tarefaId) return null;
  const itens = data ?? [];
  const aprovacoes = itens.filter((i) => i.tipo === "aprovacao").length;
  const urgentes = itens.filter((i) => i.tipo === "urgente").length;
  if (!isLoading && itens.length === 0) return null;

  return (
    <div className={cn("border-b border-border/50 bg-muted/20", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium hover:bg-muted/40 transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>Aprovações e chamadas de atenção</span>
        {isLoading ? (
          <Loader2 className="h-3 w-3 animate-spin ml-auto" />
        ) : (
          <span className="ml-auto flex items-center gap-1">
            <Badge variant="secondary" className="h-4 px-1 text-[9px]">
              {aprovacoes} aprov.
            </Badge>
            <Badge variant="outline" className="h-4 px-1 text-[9px] text-destructive border-destructive/40">
              {urgentes} atenção
            </Badge>
          </span>
        )}
      </button>

      {open && (
        <ul className="px-3 pb-2 space-y-1.5 max-h-48 overflow-y-auto">
          {itens.map((i) => (
            <li key={`${i.tipo}-${i.id}`} className="flex gap-1.5 text-[10px] leading-tight">
              {i.tipo === "aprovacao" ? (
                <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
              ) : (
                <AlertOctagon className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {i.titulo}
                  {i.status && (
                    <span className="ml-1 text-muted-foreground font-normal">
                      · {STATUS_LABEL[i.status] ?? i.status}
                    </span>
                  )}
                </p>
                {i.detalhe && <p className="text-muted-foreground line-clamp-2">{i.detalhe}</p>}
                <p className="text-muted-foreground">
                  {i.usuario_nome ?? "Usuário"} ·{" "}
                  {format(new Date(i.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

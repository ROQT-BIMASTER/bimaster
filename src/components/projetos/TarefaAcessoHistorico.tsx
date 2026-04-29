import { useState } from "react";
import { useTarefaAcessoAudit, type TarefaAcessoEvent } from "@/hooks/useTarefaAcessoAudit";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MOTIVO_LABEL: Record<string, string> = {
  responsavel_alterado: "Mudança de responsável",
  colaborador_adicionado: "Adicionado como colaborador",
  colaborador_removido: "Removido como colaborador",
  secao_liberada: "Seção liberada",
  secao_revogada: "Seção revogada",
  tarefa_movida_secao: "Tarefa movida de seção",
  membro_projeto_adicionado: "Adicionado ao projeto",
  membro_projeto_removido: "Removido do projeto",
  tarefa_excluida: "Tarefa excluída",
};

export function TarefaAcessoHistorico({ tarefaId }: { tarefaId: string }) {
  const { data, isLoading } = useTarefaAcessoAudit(tarefaId);
  const [showAll, setShowAll] = useState(false);
  const events = (data || []) as TarefaAcessoEvent[];
  const visible = showAll ? events : events.slice(0, 10);

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhuma mudança de acesso registrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((e) => {
        const ganhou = e.acao === "ganhou_acesso";
        return (
          <div key={e.id} className="flex items-start gap-3 p-3 rounded-md border bg-card text-sm">
            {ganhou ? (
              <ArrowUpCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
            ) : (
              <ArrowDownCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{e.user_afetado_nome || "Usuário"}</span>
                <Badge variant={ganhou ? "secondary" : "outline"} className="text-[10px] h-4">
                  {ganhou ? "ganhou acesso" : "perdeu acesso"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  · {MOTIVO_LABEL[e.motivo] || e.motivo}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {e.ator_nome ? `por ${e.ator_nome} · ` : ""}
                {format(new Date(e.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
          </div>
        );
      })}
      {events.length > 10 && (
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? "Mostrar menos" : `Ver todos (${events.length})`}
        </button>
      )}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, FileCheck2, FolderOpen, ListChecks, Clock, User, FileWarning } from "lucide-react";
import { useEvidenciasDaEtapa } from "@/hooks/useProcessoTarefaEspelho";

interface Props {
  etapaId: string;
}

/**
 * Painel exibido na aba "Evidências" do Perfil do Processo.
 * Lista todas as tarefas-espelho desta etapa (entre todas as instâncias),
 * mostrando para cada uma: tarefa do projeto, documento oficial usado como
 * evidência, quem concluiu e quando.
 */
export function EvidenciasEtapaPanel({ etapaId }: Props) {
  const { data: evidencias = [], isLoading } = useEvidenciasDaEtapa(etapaId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (evidencias.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
        <ListChecks className="h-3.5 w-3.5 inline mr-1" />
        Nenhuma tarefa-espelho registrada nesta etapa ainda. Quando uma tarefa
        vinculada do módulo Projetos for concluída, ela aparecerá aqui com o
        documento oficial usado como evidência.
      </div>
    );
  }

  const concluidas = evidencias.filter((e) => e.status === "concluida");
  const pendentes = evidencias.filter((e) => e.status !== "concluida");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="success" className="gap-1">
          <FileCheck2 className="h-3 w-3" />
          {concluidas.length} concluída{concluidas.length === 1 ? "" : "s"}
        </Badge>
        {pendentes.length > 0 && (
          <Badge variant="outline" className="gap-1 border-warning/50 text-warning">
            <Clock className="h-3 w-3" />
            {pendentes.length} pendente{pendentes.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {evidencias.map((ev) => (
          <Card key={ev.espelho_id} className="border-l-4 border-l-primary/40">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{ev.projeto_nome ?? "Projeto"}</span>
                    <span className="text-muted-foreground">›</span>
                    <span className="truncate">{ev.tarefa_titulo ?? "(tarefa removida)"}</span>
                  </div>
                  {ev.entidade_tipo && (
                    <p className="text-[11px] text-muted-foreground">
                      Instância: {ev.entidade_tipo}
                    </p>
                  )}
                </div>
                <Badge
                  variant={ev.status === "concluida" ? "success" : "secondary"}
                  className="text-[10px] shrink-0"
                >
                  {ev.status}
                </Badge>
              </div>

              {ev.evidencia_documento_id ? (
                <div className="rounded-md bg-muted/30 p-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <FileCheck2 className="h-3 w-3 text-success" />
                    <span className="font-medium">Evidência:</span>
                    <span>{ev.evidencia_documento_label}</span>
                  </div>
                  {ev.evidencia_observacao && (
                    <p className="text-[11px] text-muted-foreground italic">
                      "{ev.evidencia_observacao}"
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                    {ev.concluida_por_nome && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ev.concluida_por_nome}
                      </span>
                    )}
                    {ev.concluida_em && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(ev.concluida_em).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-warning">
                  <FileWarning className="h-3 w-3" />
                  Aguardando conclusão no módulo Projetos com seleção de documento oficial.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

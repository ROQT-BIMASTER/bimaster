import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, CircleDashed, Timer } from "lucide-react";
import { useProcessoExecucaoDia, type EtapaExecucaoDia } from "@/hooks/suporte/useProcessoExecucao";
import { ProcessoHandoffAlertas } from "./ProcessoHandoffAlertas";

interface Props {
  processoId: string;
}

function statusMeta(e: EtapaExecucaoDia) {
  if (e.concluida_em) {
    return { label: "Concluída", Icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
  }
  if (e.sla_estourado) {
    return { label: "SLA estourado", Icon: AlertTriangle, tone: "bg-destructive/15 text-destructive border-destructive/40" };
  }
  if (e.status === "em_andamento") {
    return { label: "Em andamento", Icon: Timer, tone: "bg-blue-500/15 text-blue-600 border-blue-500/30" };
  }
  if (e.status === "gerada") {
    return { label: "Gerada", Icon: Clock, tone: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  }
  return { label: "Não gerada", Icon: CircleDashed, tone: "bg-muted text-muted-foreground border-border" };
}

function fmtDeadline(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ProcessoExecucaoDia({ processoId }: Props) {
  const { data: etapas = [], isLoading } = useProcessoExecucaoDia(processoId);

  const grupos = useMemo(() => {
    const m = new Map<string, { nome: string; cor: string | null; itens: EtapaExecucaoDia[] }>();
    for (const e of etapas) {
      const key = e.fila_id;
      if (!m.has(key)) m.set(key, { nome: e.fila_nome, cor: e.fila_cor, itens: [] });
      m.get(key)!.itens.push(e);
    }
    return Array.from(m.values());
  }, [etapas]);

  const totals = useMemo(() => {
    return etapas.reduce(
      (acc, e) => {
        acc.total += 1;
        if (e.concluida_em) acc.concluidas += 1;
        else if (e.sla_estourado) acc.atrasadas += 1;
        else if (e.status === "em_andamento" || e.status === "gerada") acc.em_andamento += 1;
        else acc.nao_geradas += 1;
        return acc;
      },
      { total: 0, concluidas: 0, em_andamento: 0, atrasadas: 0, nao_geradas: 0 },
    );
  }, [etapas]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Carregando execução do dia…
        </CardContent>
      </Card>
    );
  }

  if (etapas.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma etapa vinculada a este processo.
        </CardContent>
      </Card>
    );
  }

  const etapaById = new Map(etapas.map((e) => [e.etapa_id, e]));

  return (
    <div className="flex flex-col gap-3">
      <ProcessoHandoffAlertas processoId={processoId} />
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{totals.total} etapas</Badge>
        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
          {totals.concluidas} concluídas
        </Badge>
        <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">
          {totals.em_andamento} em andamento
        </Badge>
        <Badge className="bg-destructive/15 text-destructive border-destructive/40">
          {totals.atrasadas} atrasadas
        </Badge>
        <Badge variant="secondary">{totals.nao_geradas} não geradas</Badge>
      </div>

      <div className="grid gap-3">
        {grupos.map((g) => (
          <Card key={g.nome}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: g.cor ?? "#94a3b8" }}
                />
                <span className="text-sm font-semibold">{g.nome}</span>
                <span className="text-xs text-muted-foreground">
                  {g.itens.length} etapa(s)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {g.itens.map((e) => {
                  const meta = statusMeta(e);
                  const bloqueadaPor = e.handoff_pendente_de_etapa_id
                    ? etapaById.get(e.handoff_pendente_de_etapa_id)
                    : null;
                  return (
                    <div
                      key={e.etapa_id}
                      className={`rounded-md border p-2 text-xs flex flex-col gap-1 ${meta.tone}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium line-clamp-1">{e.rotina_titulo}</span>
                        <meta.Icon className="h-3.5 w-3.5 shrink-0" />
                      </div>
                      <div className="flex items-center justify-between text-[10px] opacity-80">
                        <span>{meta.label}</span>
                        {e.sla_deadline && !e.concluida_em && (
                          <span>
                            até {fmtDeadline(e.sla_deadline)}
                            {typeof e.minutos_para_deadline === "number" && !e.sla_estourado && (
                              <> · {e.minutos_para_deadline}min</>
                            )}
                          </span>
                        )}
                        {e.concluida_em && <span>em {fmtDeadline(e.concluida_em)}</span>}
                      </div>
                      {bloqueadaPor && !e.concluida_em && (
                        <div className="text-[10px] opacity-80">
                          Aguardando: <b>{bloqueadaPor.rotina_titulo}</b>
                          {e.handoff_sla_minutos ? ` (handoff ${e.handoff_sla_minutos}min)` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

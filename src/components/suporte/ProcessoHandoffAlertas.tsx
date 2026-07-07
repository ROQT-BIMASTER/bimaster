import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowUpCircle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  useHandoffAlertas,
  useResolverAlerta,
  useEscalarAlerta,
  useGerarAlertasHandoff,
} from "@/hooks/suporte/useHandoffAlertas";
import { useProcessoExecucaoDia } from "@/hooks/suporte/useProcessoExecucao";

interface Props {
  processoId: string;
}

export function ProcessoHandoffAlertas({ processoId }: Props) {
  const { data: alertas = [], isLoading } = useHandoffAlertas(processoId);
  const { data: etapas = [] } = useProcessoExecucaoDia(processoId);
  const resolver = useResolverAlerta();
  const escalar = useEscalarAlerta();
  const gerar = useGerarAlertasHandoff();

  const etapaById = useMemo(() => {
    const m = new Map<string, (typeof etapas)[number]>();
    for (const e of etapas) m.set(e.etapa_id, e);
    return m;
  }, [etapas]);

  const abertos = alertas.filter((a) => !a.resolvido_em);
  const resolvidos = alertas.filter((a) => a.resolvido_em).slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Alertas de handoff
          {abertos.length > 0 && (
            <Badge variant="destructive" className="ml-1">{abertos.length}</Badge>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => gerar.mutate()}
          disabled={gerar.isPending}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${gerar.isPending ? "animate-spin" : ""}`} />
          Rodar varredura
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
        {!isLoading && abertos.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum handoff em risco no momento.
          </p>
        )}

        {abertos.map((a) => {
          const origem = etapaById.get(a.de_etapa_id);
          const destino = etapaById.get(a.para_etapa_id);
          const tipoLabel =
            a.tipo === "origem_atrasada"
              ? "Etapa de origem atrasada"
              : "Handoff estourado";
          return (
            <div
              key={a.id}
              className="border rounded-md p-3 flex flex-col md:flex-row md:items-center gap-2 bg-destructive/5 border-destructive/30"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="destructive" className="text-[10px]">
                    {tipoLabel}
                  </Badge>
                  {typeof a.minutos_atraso === "number" && (
                    <Badge variant="outline" className="text-[10px]">
                      +{a.minutos_atraso} min
                    </Badge>
                  )}
                  {a.escalado_em && (
                    <Badge variant="secondary" className="text-[10px]">
                      Escalado
                    </Badge>
                  )}
                </div>
                <p className="text-xs mt-1">
                  <span className="font-medium">{origem?.rotina_titulo ?? "Etapa origem"}</span>
                  <span className="text-muted-foreground"> ({origem?.fila_nome ?? "—"}) </span>
                  <span>→ </span>
                  <span className="font-medium">{destino?.rotina_titulo ?? "Etapa destino"}</span>
                  <span className="text-muted-foreground"> ({destino?.fila_nome ?? "—"})</span>
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {!a.escalado_em && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => escalar.mutate(a.id)}
                    disabled={escalar.isPending}
                  >
                    <ArrowUpCircle className="h-3.5 w-3.5 mr-1" /> Escalar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resolver.mutate(a.id)}
                  disabled={resolver.isPending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolver
                </Button>
              </div>
            </div>
          );
        })}

        {resolvidos.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Últimos resolvidos ({resolvidos.length})
            </summary>
            <div className="mt-2 flex flex-col gap-1">
              {resolvidos.map((a) => {
                const origem = etapaById.get(a.de_etapa_id);
                const destino = etapaById.get(a.para_etapa_id);
                return (
                  <div key={a.id} className="text-[11px] text-muted-foreground">
                    {origem?.rotina_titulo ?? "—"} → {destino?.rotina_titulo ?? "—"} ·{" "}
                    {new Date(a.resolvido_em!).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

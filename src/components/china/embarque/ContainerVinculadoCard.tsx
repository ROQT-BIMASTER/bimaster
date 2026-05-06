import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Container, Ship, Calendar, AlertTriangle } from "lucide-react";
import { useContainersDaOP } from "@/hooks/usePatioProntoEmbarque";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";

interface Props {
  ordemProducaoId: string;
}

export function ContainerVinculadoCard({ ordemProducaoId }: Props) {
  const { data: containers = [], isLoading } = useContainersDaOP(ordemProducaoId);

  if (isLoading) return null;
  if (containers.length === 0) {
    return (
      <Card className="p-4 bg-card/70 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Container className="h-4 w-4" />
          Esta OP ainda não foi alocada em nenhum container
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-card/70 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <Container className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Container(s) vinculado(s)</h3>
      </div>
      <div className="space-y-2">
        {containers.map((c) => (
          <div key={c.embarque_id} className="rounded-md border border-border p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="font-medium flex items-center gap-2">
                #{c.numero_embarque ?? "—"} · {c.numero_container || "Sem container"}
                {c.qtd_ocs > 1 && (
                  <Badge variant="outline" className="text-[10px]">Consolidado {c.qtd_ocs} OCs</Badge>
                )}
              </div>
              <Badge variant={c.status === "embarcado" ? "default" : "secondary"}>{c.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Ship className="h-3 w-3" /> {c.navio || "—"}
              </div>
              <div>BL: {c.numero_bl || "—"}</div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Embarque: {c.data_embarque ? format(parseLocalDate(c.data_embarque)!, "dd/MM/yy") : "—"}
              </div>
              <div>
                ETA: {c.shipsgo_eta_atual
                  ? format(parseLocalDate(c.shipsgo_eta_atual)!, "dd/MM/yy")
                  : c.data_eta
                  ? format(parseLocalDate(c.data_eta)!, "dd/MM/yy")
                  : "—"}
              </div>
              <div>Qtd nesta OP: <strong className="text-foreground">{(c as any).qty_nesta_op}</strong></div>
              {c.shipsgo_dias_atraso != null && c.shipsgo_dias_atraso > 0 && (
                <div className="flex items-center gap-1 text-amber-500">
                  <AlertTriangle className="h-3 w-3" /> Atraso {c.shipsgo_dias_atraso}d
                </div>
              )}
            </div>
            {c.shipsgo_status && (
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground pt-1 border-t border-border">
                Tracking: {c.shipsgo_status}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

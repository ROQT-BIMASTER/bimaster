import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertTriangle, Repeat } from "lucide-react";
import { useMinhasRotinasHoje, useConcluirRotinaExecucao } from "@/hooks/suporte/useRotinasFixas";

export function MinhasRotinasHojeWidget() {
  const { data = [], isLoading } = useMinhasRotinasHoje();
  const concluir = useConcluirRotinaExecucao();

  if (isLoading) return null;
  if (data.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          Minhas rotinas de hoje
          <Badge variant="secondary" className="ml-1">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((e) => {
          const violada = e.status === "violada" || e.status === "escalada";
          const concluida = e.status === "concluida";
          return (
            <div key={e.id} className="flex items-start justify-between gap-3 p-2 rounded border bg-background/60">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium truncate ${concluida ? "line-through text-muted-foreground" : ""}`}>
                    {e.titulo}
                  </span>
                  {violada && <Badge variant="destructive" className="h-5"><AlertTriangle className="h-3 w-3 mr-1" />Em atraso</Badge>}
                  {concluida && <Badge variant="default" className="h-5 bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Concluída</Badge>}
                  {!concluida && !violada && (
                    <Badge variant="outline" className="h-5"><Clock className="h-3 w-3 mr-1" />
                      {e.sla_deadline ? new Date(e.sla_deadline).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </Badge>
                  )}
                </div>
                {e.protocolo && <div className="text-xs text-muted-foreground">Protocolo {e.protocolo}</div>}
                {Array.isArray(e.checklist) && e.checklist.length > 0 && (
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {e.checklist.slice(0, 4).map((c: any, i: number) => (
                      <li key={i}>• {c.texto}</li>
                    ))}
                  </ul>
                )}
              </div>
              {!concluida && (
                <Button size="sm" variant="outline" onClick={() => concluir.mutate(e.id)} disabled={concluir.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Concluir
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

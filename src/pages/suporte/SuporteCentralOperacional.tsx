import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Workflow,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
  ArrowRight,
} from "lucide-react";
import { useProcessos } from "@/hooks/suporte/useProcessos";
import { useProcessosSaudeDia } from "@/hooks/suporte/useProcessoExecucao";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { useGerarAlertasHandoff } from "@/hooks/suporte/useHandoffAlertas";
import { ProcessoOnboardingGuide } from "@/components/suporte/ProcessoOnboardingGuide";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface AlertaAgregado {
  id: string;
  processo_id: string;
  tipo: string;
  minutos_atraso: number | null;
  gerado_em: string;
  resolvido_em: string | null;
  escalado_em: string | null;
}

function useAlertasAtivosDia(dataRef: string) {
  return useQuery({
    queryKey: ["processos", "alertas-ativos", dataRef],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processo_handoff_alertas" as any)
        .select("id, processo_id, tipo, minutos_atraso, gerado_em, resolvido_em, escalado_em")
        .eq("data_ref", dataRef)
        .is("resolvido_em", null)
        .order("gerado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AlertaAgregado[];
    },
  });
}

export default function SuporteCentralOperacional() {
  const navigate = useNavigate();
  const [dataRef, setDataRef] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const { data: processos = [] } = useProcessos();
  const { data: filas = [] } = useSuporteFilas();
  const { data: saude = [], isLoading, refetch } = useProcessosSaudeDia(dataRef);
  const { data: alertas = [] } = useAlertasAtivosDia(dataRef);
  const gerarAlertas = useGerarAlertasHandoff();

  const filaMap = useMemo(() => {
    const m = new Map<string, (typeof filas)[number]>();
    filas.forEach((f) => m.set(f.id, f));
    return m;
  }, [filas]);

  const procMap = useMemo(() => {
    const m = new Map<string, (typeof processos)[number]>();
    processos.forEach((p) => m.set(p.id, p));
    return m;
  }, [processos]);

  const kpis = useMemo(() => {
    return saude.reduce(
      (acc, s) => {
        acc.total += 1;
        acc.etapas += s.total_etapas;
        acc.concluidas += s.concluidas;
        acc.em_andamento += s.em_andamento;
        acc.atrasadas += s.atrasadas;
        acc.nao_geradas += s.nao_geradas;
        return acc;
      },
      { total: 0, etapas: 0, concluidas: 0, em_andamento: 0, atrasadas: 0, nao_geradas: 0 },
    );
  }, [saude]);

  const pctGeral =
    kpis.etapas > 0 ? Math.round((kpis.concluidas / kpis.etapas) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard/suporte/rotinas-fixas")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Rotinas fixas
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Workflow className="h-6 w-6 text-primary" /> Central operacional
              </h2>
              <p className="text-sm text-muted-foreground">
                Saúde dos processos em execução e alertas de handoff entre departamentos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dataRef}
              onChange={(e) => setDataRef(e.target.value)}
              className="h-9 w-[160px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                gerarAlertas.mutate();
                refetch();
              }}
              disabled={gerarAlertas.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Varredura
            </Button>
          </div>
        </div>

        <ProcessoOnboardingGuide />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Processos ativos</div>
              <div className="text-2xl font-bold">{kpis.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Concluídas
              </div>
              <div className="text-2xl font-bold text-emerald-600">{kpis.concluidas}</div>
              <div className="text-[10px] text-muted-foreground">de {kpis.etapas} etapas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Em andamento
              </div>
              <div className="text-2xl font-bold text-blue-600">{kpis.em_andamento}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Em atraso
              </div>
              <div className="text-2xl font-bold text-destructive">{kpis.atrasadas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Circle className="h-3 w-3" /> Não geradas
              </div>
              <div className="text-2xl font-bold text-muted-foreground">{kpis.nao_geradas}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Progresso geral do dia</span>
              <span className="text-xs text-muted-foreground">{pctGeral}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={pctGeral} className="h-2" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {isLoading && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Carregando…
              </CardContent>
            </Card>
          )}
          {!isLoading && saude.length === 0 && (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Nenhum processo com etapas na data selecionada.
              </CardContent>
            </Card>
          )}
          {saude.map((s) => {
            const proc = procMap.get(s.processo_id);
            const fila = filaMap.get(s.fila_dona_id);
            const pct =
              s.total_etapas > 0
                ? Math.round((s.concluidas / s.total_etapas) * 100)
                : 0;
            const critico = s.atrasadas > 0;
            return (
              <Card
                key={s.processo_id}
                className={
                  "cursor-pointer hover:shadow-md transition-shadow " +
                  (critico ? "border-destructive/40" : "")
                }
                onClick={() => navigate(`/dashboard/suporte/processos/${s.processo_id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 truncate">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: fila?.cor ?? "#94a3b8" }}
                      />
                      <span className="truncate">{s.processo_nome}</span>
                    </span>
                    {proc?.versao ? (
                      <Badge variant="secondary" className="shrink-0">v{proc.versao}</Badge>
                    ) : null}
                  </CardTitle>
                  <div className="text-[11px] text-muted-foreground">
                    Fila dona: {fila?.nome ?? "—"}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Progress value={pct} className="h-1.5" />
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {s.concluidas}/{s.total_etapas}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3 text-blue-600" />
                      {s.em_andamento}
                    </Badge>
                    {s.atrasadas > 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {s.atrasadas}
                      </Badge>
                    )}
                    {s.nao_geradas > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <Circle className="h-3 w-3" />
                        {s.nao_geradas}
                      </Badge>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <span className="text-[11px] text-primary inline-flex items-center gap-1">
                      Abrir <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alertas de handoff ativos ({alertas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {alertas.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum alerta ativo. Todos os handoffs dentro do SLA.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Processo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Atraso</TableHead>
                    <TableHead>Gerado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertas.map((a) => {
                    const proc = procMap.get(a.processo_id);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {proc?.nome ?? a.processo_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.tipo === "handoff_estourado" ? "destructive" : "secondary"
                            }
                          >
                            {a.tipo === "handoff_estourado"
                              ? "Handoff estourado"
                              : "Origem atrasada"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.minutos_atraso != null ? `${a.minutos_atraso} min` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(a.gerado_em), "dd/MM HH:mm")}
                        </TableCell>
                        <TableCell>
                          {a.escalado_em ? (
                            <Badge variant="destructive">Escalado</Badge>
                          ) : (
                            <Badge variant="outline">Ativo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/dashboard/suporte/processos/${a.processo_id}`}>
                              Abrir
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

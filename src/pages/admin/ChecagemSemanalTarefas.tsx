import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  History,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Timer,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type LogRow = {
  id: string;
  executed_at: string;
  duration_ms: number;
  source: string;
  total_concluidas: number;
  com_data_conclusao: number;
  sem_data_conclusao: number;
  inconsistency_pct: number;
  incident_opened: boolean;
  incident_id: string | null;
  details: any;
};

type ResumoRow = {
  total_execucoes: number;
  ultima_execucao: string | null;
  ultima_total_concluidas: number | null;
  ultima_sem_data_conclusao: number | null;
  ultima_inconsistency_pct: number | null;
  ultima_incident_id: string | null;
  incidentes_abertos: number;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  } catch {
    return d;
  }
}

export default function ChecagemSemanalTarefas() {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filterArgs = useMemo(
    () => ({
      p_date_from: dateFrom ? dateFrom.toISOString() : null,
      p_date_to: dateTo
        ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)).toISOString()
        : null,
      p_limit: 200,
    }),
    [dateFrom, dateTo]
  );

  const resumoQuery = useQuery({
    queryKey: ["consistency-check-tarefas-resumo"],
    queryFn: async (): Promise<ResumoRow | null> => {
      const { data, error } = await supabase.rpc(
        "consistency_check_tarefas_resumo" as any
      );
      if (error) throw error;
      const arr = (data as ResumoRow[] | null) ?? [];
      return arr[0] ?? null;
    },
  });

  const listQuery = useQuery({
    queryKey: ["consistency-check-tarefas-listar", filterArgs],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase.rpc(
        "consistency_check_tarefas_listar" as any,
        filterArgs as any
      );
      if (error) throw error;
      return (data as LogRow[] | null) ?? [];
    },
  });

  const runNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        "consistency_check_tarefas_run_now" as any
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Checagem executada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["consistency-check-tarefas-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["consistency-check-tarefas-listar"] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Falha ao executar checagem.");
    },
  });

  const isAdminError =
    (resumoQuery.error as any)?.message?.includes("Acesso negado") ||
    (listQuery.error as any)?.message?.includes("Acesso negado");

  const refetchAll = () => {
    resumoQuery.refetch();
    listQuery.refetch();
  };

  const resumo = resumoQuery.data;
  const rows = listQuery.data ?? [];
  const hasOpenIncident = (resumo?.incidentes_abertos ?? 0) > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Checagem semanal — Tarefas
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Verificação automática semanal (segundas-feiras, 03:00 UTC) que compara
              o total de tarefas concluídas com a quantidade que possui{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">data_conclusao</code>
              . Quando há divergência, um incidente é aberto em "Incidentes de Segurança"
              automaticamente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={refetchAll}
              className="h-9 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={() => runNow.mutate()}
              disabled={runNow.isPending}
              className="h-9 gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              {runNow.isPending ? "Executando…" : "Executar agora"}
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link to="/dashboard/admin/diagnostico-tarefas-data-conclusao">
                <ShieldAlert className="h-3.5 w-3.5" />
                Diagnóstico
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link to="/dashboard/admin/historico-backfill-tarefas">
                <History className="h-3.5 w-3.5" />
                Backfill
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link to="/dashboard/admin/alertas-backfill-tarefas">
                <Bell className="h-3.5 w-3.5" />
                Alertas
              </Link>
            </Button>
          </div>
        </div>

        {isAdminError ? (
          <Card className="border-destructive/40">
            <CardContent className="flex items-start gap-3 py-6">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Acesso negado</p>
                <p className="text-sm text-muted-foreground">
                  Esta tela é restrita a administradores.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Status banner */}
            {resumoQuery.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : hasOpenIncident ? (
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="flex items-start gap-3 py-4">
                  <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      {resumo?.incidentes_abertos} incidente(s) em aberto
                    </p>
                    <p className="text-sm text-muted-foreground">
                      A última checagem detectou{" "}
                      <strong>{resumo?.ultima_sem_data_conclusao ?? 0}</strong> tarefa(s)
                      concluída(s) sem <code className="text-xs">data_conclusao</code>
                      {resumo?.ultima_inconsistency_pct != null
                        ? ` (${Number(resumo.ultima_inconsistency_pct).toFixed(2)}%)`
                        : ""}
                      . Acompanhe em "Incidentes de Segurança".
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-success/40 bg-success/5">
                <CardContent className="flex items-start gap-3 py-4">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Sem inconsistências</p>
                    <p className="text-sm text-muted-foreground">
                      Todas as tarefas concluídas possuem{" "}
                      <code className="text-xs">data_conclusao</code> registrada na
                      última checagem.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Execuções totais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-bold">
                      {resumo?.total_execucoes ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Última execução
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    <div className="text-sm font-mono">
                      {fmtDate(resumo?.ultima_execucao ?? null)}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Tarefas órfãs (última)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div
                      className={`text-2xl font-bold ${
                        (resumo?.ultima_sem_data_conclusao ?? 0) > 0
                          ? "text-warning"
                          : "text-success"
                      }`}
                    >
                      {resumo?.ultima_sem_data_conclusao ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Incidentes abertos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div
                      className={`text-2xl font-bold ${
                        hasOpenIncident ? "text-destructive" : "text-success"
                      }`}
                    >
                      {resumo?.incidentes_abertos ?? 0}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Histórico */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Timer className="h-5 w-5 text-muted-foreground" />
                  Histórico de execuções
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="text-right">Concluídas</TableHead>
                      <TableHead className="text-right">Com data</TableHead>
                      <TableHead className="text-right">Sem data</TableHead>
                      <TableHead className="text-right">Inconsist. %</TableHead>
                      <TableHead>Incidente</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listQuery.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Carregando…
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhuma execução registrada no período selecionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs font-mono whitespace-nowrap">
                            {fmtDate(r.executed_at)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={r.source === "cron" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {r.source}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {r.total_concluidas}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-success">
                            {r.com_data_conclusao}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-xs ${
                              r.sem_data_conclusao > 0 ? "text-warning" : "text-muted-foreground"
                            }`}
                          >
                            {r.sem_data_conclusao}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {Number(r.inconsistency_pct).toFixed(2)}%
                          </TableCell>
                          <TableCell>
                            {r.incident_opened ? (
                              <Badge className="bg-warning/20 text-warning text-xs">
                                Aberto
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {r.duration_ms} ms
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

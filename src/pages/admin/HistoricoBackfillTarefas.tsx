import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  Bell,
  CheckCircle2,
  Clock,
  Database,
  Download,
  History,
  RefreshCw,
  ShieldCheck,
  Timer,
  AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { supabase } from "@/integrations/supabase/client";

type LogRow = {
  id: string;
  executed_at: string;
  source: string;
  rows_updated: number;
  duration_ms: number;
  details: any;
};

type ResumoRow = {
  total_execucoes: number;
  total_tarefas_corrigidas: number;
  execucoes_com_correcao: number;
  execucoes_sem_correcao: number;
  duracao_media_ms: number;
  duracao_maxima_ms: number;
  primeira_execucao: string | null;
  ultima_execucao: string | null;
  por_origem: Array<{ source: string; execucoes: number; rows_updated: number }>;
};

const LIMIT_OPTIONS = [50, 100, 200, 500, 1000];
const SOURCE_OPTIONS = [
  { value: "__all__", label: "Todas as origens" },
  { value: "cron", label: "Cron (job diário)" },
  { value: "manual", label: "Manual" },
  { value: "manual_test", label: "Teste manual" },
  { value: "trigger_test", label: "Teste de trigger" },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  } catch {
    return d;
  }
}

function sourceVariant(source: string): "default" | "secondary" | "outline" {
  if (source === "cron") return "default";
  if (source.startsWith("manual")) return "secondary";
  return "outline";
}

function exportToCsv(rows: LogRow[]) {
  const header = ["executed_at", "source", "rows_updated", "duration_ms", "details"];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [r.executed_at, r.source, r.rows_updated, r.duration_ms, r.details]
        .map(escape)
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backfill-log-${format(new Date(), "yyyyMMdd-HHmmss")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function HistoricoBackfillTarefas() {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [source, setSource] = useState<string>("__all__");
  const [limit, setLimit] = useState<number>(200);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filterArgs = useMemo(
    () => ({
      p_date_from: dateFrom ? dateFrom.toISOString() : null,
      p_date_to: dateTo
        ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)).toISOString()
        : null,
      p_source: source === "__all__" ? null : source,
      p_limit: limit,
    }),
    [dateFrom, dateTo, source, limit]
  );

  const resumoQuery = useQuery({
    queryKey: ["diag-backfill-log-resumo", filterArgs.p_date_from, filterArgs.p_date_to],
    queryFn: async (): Promise<ResumoRow | null> => {
      const { data, error } = await supabase.rpc("diag_backfill_log_resumo" as any, {
        p_date_from: filterArgs.p_date_from,
        p_date_to: filterArgs.p_date_to,
      } as any);
      if (error) throw error;
      const arr = (data as ResumoRow[] | null) ?? [];
      return arr[0] ?? null;
    },
  });

  const listQuery = useQuery({
    queryKey: ["diag-backfill-log-listar", filterArgs],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase.rpc(
        "diag_backfill_log_listar" as any,
        filterArgs as any
      );
      if (error) throw error;
      return (data as LogRow[] | null) ?? [];
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Histórico — Backfill de tarefas
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Consulte cada execução do job{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">backfill_data_conclusao_tarefas</code>:
              quantas tarefas foram corrigidas, duração e origem (cron, manual, trigger).
              Desde a v3.4.24 o job processa em lotes de 500 com{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">FOR UPDATE SKIP LOCKED</code>{" "}
              (cap 100k tarefas/execução) — verifique <em>batches_done</em> e <em>reached_cap</em> nos detalhes.
              Tela restrita a administradores.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="h-9 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} linhas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={refetchAll} className="h-9 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link to="/dashboard/admin/alertas-backfill-tarefas">
                <Bell className="h-3.5 w-3.5" />
                Alertas
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link to="/dashboard/admin/checagem-semanal-tarefas">
                <ShieldCheck className="h-3.5 w-3.5" />
                Checagem semanal
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCsv(rows)}
              disabled={rows.length === 0}
              className="h-9 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
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
            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Execuções no período</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-bold tabular-nums">
                      {resumo?.total_execucoes ?? 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {resumo?.execucoes_com_correcao ?? 0} com correção ·{" "}
                    {resumo?.execucoes_sem_correcao ?? 0} heartbeats
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tarefas corrigidas</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-success tabular-nums">
                      {resumo?.total_tarefas_corrigidas ?? 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Soma de `rows_updated`</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Duração média</CardTitle>
                  <Timer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <div className="text-2xl font-bold tabular-nums">
                      {Number(resumo?.duracao_media_ms ?? 0).toFixed(0)}
                      <span className="text-base font-normal text-muted-foreground ml-1">ms</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Pico: {resumo?.duracao_maxima_ms ?? 0} ms
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Última execução</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-6 w-32" />
                  ) : (
                    <div className="text-base font-semibold">
                      {fmtDate(resumo?.ultima_execucao ?? null)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Primeira: {fmtDate(resumo?.primeira_execucao ?? null)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Por origem */}
            {!resumoQuery.isLoading && resumo && resumo.por_origem?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Por origem
                  </CardTitle>
                  <CardDescription>
                    Distribuição das execuções e correções por canal de disparo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {resumo.por_origem.map((row) => (
                      <div
                        key={row.source}
                        className="rounded-md border border-border bg-muted/20 p-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant={sourceVariant(row.source)} className="font-mono text-[10px]">
                            {row.source}
                          </Badge>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {row.execucoes} exec.
                          </span>
                        </div>
                        <div className="text-lg font-bold tabular-nums">
                          {row.rows_updated}
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            tarefa(s) corrigida(s)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Histórico detalhado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de execuções
                </CardTitle>
                <CardDescription>
                  {listQuery.isLoading
                    ? "Carregando…"
                    : `Mostrando ${rows.length} registro(s) (limite: ${limit}).`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {listQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : rows.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Nenhuma execução encontrada para o filtro atual.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Executado em</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead className="text-right">Corrigidas</TableHead>
                          <TableHead className="text-right">Duração</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => {
                          const hasDetails = row.details && Object.keys(row.details).length > 0;
                          const isOpen = !!expanded[row.id];
                          const corrected = row.rows_updated > 0;
                          return (
                            <>
                              <TableRow key={row.id}>
                                <TableCell className="font-mono text-xs">
                                  {fmtDate(row.executed_at)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={sourceVariant(row.source)} className="font-mono text-[10px]">
                                    {row.source}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {corrected ? (
                                    <span className="text-success font-semibold">
                                      +{row.rows_updated}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                                  {row.duration_ms} ms
                                </TableCell>
                                <TableCell>
                                  {hasDetails ? (
                                    <Collapsible
                                      open={isOpen}
                                      onOpenChange={(o) =>
                                        setExpanded((s) => ({ ...s, [row.id]: o }))
                                      }
                                    >
                                      <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                                          {isOpen ? "Ocultar" : "Ver JSON"}
                                        </Button>
                                      </CollapsibleTrigger>
                                    </Collapsible>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                              {hasDetails && isOpen && (
                                <TableRow key={`${row.id}-details`} className="bg-muted/20">
                                  <TableCell colSpan={5}>
                                    <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all p-2 bg-background rounded border">
                                      {JSON.stringify(row.details, null, 2)}
                                    </pre>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

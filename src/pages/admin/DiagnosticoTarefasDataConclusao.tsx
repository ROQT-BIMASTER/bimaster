import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Users, Clock, History } from "lucide-react";
import { Link } from "react-router-dom";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

type ResumoRow = {
  total_concluidas: number;
  sem_data_conclusao: number;
  com_data_conclusao: number;
  pct_sem_data: number;
  responsaveis_afetados: number;
  ultimo_backfill_em: string | null;
  ultimo_backfill_rows: number | null;
};

type DetalheRow = {
  responsavel_id: string | null;
  responsavel_nome: string;
  responsavel_email: string;
  total_concluidas: number;
  sem_data_conclusao: number;
  com_data_conclusao: number;
  pct_sem_data: number;
  ultima_atualizacao_orfa: string | null;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return d;
  }
}

export default function DiagnosticoTarefasDataConclusao() {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState("");

  const filterArgs = useMemo(
    () => ({
      p_date_from: dateFrom ? dateFrom.toISOString() : null,
      p_date_to: dateTo
        ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)).toISOString()
        : null,
    }),
    [dateFrom, dateTo]
  );

  const resumoQuery = useQuery({
    queryKey: ["diag-tarefas-data-conclusao-resumo", filterArgs],
    queryFn: async (): Promise<ResumoRow | null> => {
      const { data, error } = await supabase.rpc(
        "diag_tarefas_sem_data_conclusao_resumo" as any,
        filterArgs as any
      );
      if (error) throw error;
      const arr = (data as ResumoRow[] | null) ?? [];
      return arr[0] ?? null;
    },
  });

  const detalheQuery = useQuery({
    queryKey: ["diag-tarefas-data-conclusao-detalhe", filterArgs],
    queryFn: async (): Promise<DetalheRow[]> => {
      const { data, error } = await supabase.rpc(
        "diag_tarefas_sem_data_conclusao" as any,
        filterArgs as any
      );
      if (error) throw error;
      return (data as DetalheRow[] | null) ?? [];
    },
  });

  const detalheFiltrado = useMemo(() => {
    const rows = detalheQuery.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.responsavel_nome.toLowerCase().includes(term) ||
        r.responsavel_email.toLowerCase().includes(term)
    );
  }, [detalheQuery.data, search]);

  const resumo = resumoQuery.data;
  const isAdminError =
    (resumoQuery.error as any)?.message?.includes("Acesso negado") ||
    (detalheQuery.error as any)?.message?.includes("Acesso negado");

  const refetchAll = () => {
    resumoQuery.refetch();
    detalheQuery.refetch();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Diagnóstico — Tarefas sem data de conclusão
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Acompanhe o saneamento do campo <code className="rounded bg-muted px-1 py-0.5 text-xs">data_conclusao</code>.
              Esta tela é restrita a administradores e mostra quantas tarefas concluídas ainda
              estão sem data registrada, segmentadas por responsável e período.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
            />
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link to="/dashboard/admin/historico-backfill-tarefas">
                <History className="h-3.5 w-3.5" />
                Histórico do job
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={refetchAll} className="h-9 gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
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
                  Esta tela é restrita a administradores. Solicite acesso ao time responsável
                  ou autentique-se com uma conta com perfil de administrador.
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
                  <CardTitle className="text-sm font-medium">Concluídas (período)</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold tabular-nums">
                      {resumo?.total_concluidas ?? 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Total de tarefas concluídas no filtro</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sem data de conclusão</CardTitle>
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      (resumo?.sem_data_conclusao ?? 0) > 0 ? "text-destructive" : "text-success"
                    }`}
                  />
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div
                      className={`text-2xl font-bold tabular-nums ${
                        (resumo?.sem_data_conclusao ?? 0) > 0 ? "text-destructive" : "text-success"
                      }`}
                    >
                      {resumo?.sem_data_conclusao ?? 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {resumo?.pct_sem_data ?? 0}% do total no período
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Responsáveis afetados</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="text-2xl font-bold tabular-nums">
                      {resumo?.responsaveis_afetados ?? 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Usuários com alguma órfã</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Último backfill</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {resumoQuery.isLoading ? (
                    <Skeleton className="h-6 w-32" />
                  ) : (
                    <div className="text-base font-semibold">
                      {fmtDate(resumo?.ultimo_backfill_em ?? null)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {resumo?.ultimo_backfill_rows ?? 0} linha(s) corrigida(s) na última execução
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Status banner */}
            {!resumoQuery.isLoading && resumo && (
              <Card
                className={
                  resumo.sem_data_conclusao === 0
                    ? "border-success/40 bg-success/5"
                    : "border-warning/40 bg-warning/5"
                }
              >
                <CardContent className="flex items-start gap-3 py-4">
                  {resumo.sem_data_conclusao === 0 ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">Base íntegra no período selecionado</p>
                        <p className="text-sm text-muted-foreground">
                          Todas as tarefas concluídas têm <code className="rounded bg-muted px-1 py-0.5 text-xs">data_conclusao</code> registrada.
                          O trigger e o job de backfill diário estão mantendo a consistência.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">
                          {resumo.sem_data_conclusao} tarefa(s) ainda sem data de conclusão
                        </p>
                        <p className="text-sm text-muted-foreground">
                          O job diário corrigirá automaticamente na próxima execução (03:00 UTC).
                          Para corrigir agora, execute manualmente a função{" "}
                          <code className="rounded bg-muted px-1 py-0.5 text-xs">backfill_data_conclusao_tarefas</code>.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tabela por responsável */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>Detalhamento por responsável</CardTitle>
                    <CardDescription>
                      Ordenado pelo maior número de tarefas órfãs no período.
                    </CardDescription>
                  </div>
                  <Input
                    placeholder="Buscar por nome ou e-mail…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 max-w-sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {detalheQuery.isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : detalheFiltrado.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Nenhum registro encontrado para o filtro atual.
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Responsável</TableHead>
                          <TableHead className="text-right">Concluídas</TableHead>
                          <TableHead className="text-right">Sem data</TableHead>
                          <TableHead className="text-right">% sem data</TableHead>
                          <TableHead>Última órfã</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detalheFiltrado.map((row) => {
                          const critical = row.sem_data_conclusao > 0;
                          return (
                            <TableRow key={row.responsavel_id ?? "sem-resp"}>
                              <TableCell>
                                <div className="font-medium text-foreground">
                                  {row.responsavel_nome}
                                </div>
                                {row.responsavel_email && (
                                  <div className="text-xs text-muted-foreground">
                                    {row.responsavel_email}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.total_concluidas}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {critical ? (
                                  <Badge variant="destructive" className="font-mono">
                                    {row.sem_data_conclusao}
                                  </Badge>
                                ) : (
                                  <span className="text-success font-medium">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                <span
                                  className={
                                    row.pct_sem_data > 0 ? "text-warning font-medium" : "text-muted-foreground"
                                  }
                                >
                                  {row.pct_sem_data}%
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                {fmtDate(row.ultima_atualizacao_orfa)}
                              </TableCell>
                            </TableRow>
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

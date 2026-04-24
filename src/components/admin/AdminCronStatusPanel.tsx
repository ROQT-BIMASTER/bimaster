import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  PauseCircle,
  RefreshCw,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

type CronStatusRow = {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
  last_run_started_at: string | null;
  last_run_finished_at: string | null;
  last_run_status: string | null;
  last_run_return_message: string | null;
  seconds_since_last_run: number | null;
};

const JOB_LABELS: Record<string, { label: string; href: string }> = {
  "backfill-data-conclusao-tarefas-daily": {
    label: "Backfill diário de data_conclusao",
    href: "/dashboard/admin/historico-backfill-tarefas",
  },
  "consistency-check-tarefas-data-conclusao-weekly": {
    label: "Checagem semanal de consistência",
    href: "/dashboard/admin/checagem-semanal-tarefas",
  },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  } catch {
    return d;
  }
}

function relTime(d: string | null) {
  if (!d) return null;
  try {
    return formatDistanceToNow(new Date(d), { locale: ptBR, addSuffix: true });
  } catch {
    return null;
  }
}

function statusBadge(status: string | null) {
  if (!status) {
    return <Badge variant="outline" className="text-xs">Sem execução</Badge>;
  }
  const s = status.toLowerCase();
  if (s === "succeeded") {
    return (
      <Badge className="bg-success/20 text-success text-xs flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> Sucesso
      </Badge>
    );
  }
  if (s === "failed") {
    return (
      <Badge className="bg-destructive/20 text-destructive text-xs flex items-center gap-1">
        <AlertCircle className="h-3 w-3" /> Falha
      </Badge>
    );
  }
  if (s === "running" || s === "starting") {
    return (
      <Badge className="bg-primary/20 text-primary text-xs flex items-center gap-1">
        <Activity className="h-3 w-3" /> Em execução
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

export function AdminCronStatusPanel() {
  const query = useQuery({
    queryKey: ["admin-tarefas-cron-status"],
    queryFn: async (): Promise<CronStatusRow[]> => {
      const { data, error } = await supabase.rpc(
        "admin_tarefas_cron_status" as any
      );
      if (error) throw error;
      return (data as CronStatusRow[] | null) ?? [];
    },
    refetchInterval: 60000,
  });

  const isAccessDenied = (query.error as any)?.message?.includes("Acesso negado");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Jobs automáticos — Tarefas
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : isAccessDenied ? (
          <p className="text-sm text-muted-foreground">
            Restrito a administradores.
          </p>
        ) : query.error ? (
          <p className="text-sm text-destructive">
            Erro ao carregar status: {(query.error as any)?.message}
          </p>
        ) : (query.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum job agendado encontrado.
          </p>
        ) : (
          <div className="space-y-3">
            {(query.data ?? []).map((row) => {
              const meta = JOB_LABELS[row.jobname] ?? {
                label: row.jobname,
                href: null as string | null,
              };
              const rel = relTime(row.last_run_started_at);
              return (
                <div
                  key={row.jobid}
                  className="rounded-lg border bg-muted/20 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {row.active ? (
                          <Badge className="bg-success/20 text-success text-xs flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-muted text-muted-foreground text-xs flex items-center gap-1">
                            <PauseCircle className="h-3 w-3" /> Inativo
                          </Badge>
                        )}
                        <span className="text-sm font-medium text-foreground">
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">
                          {row.jobname}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <code className="font-mono">{row.schedule}</code>
                        </span>
                      </div>
                    </div>
                    {meta.href && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                      >
                        <Link to={meta.href}>
                          Detalhes
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Última execução:</span>
                      {statusBadge(row.last_run_status)}
                    </div>
                    <div className="text-muted-foreground">
                      <span className="font-mono">{fmtDate(row.last_run_started_at)}</span>
                      {rel && <span className="ml-1">({rel})</span>}
                    </div>
                  </div>

                  {row.last_run_return_message &&
                    row.last_run_status?.toLowerCase() !== "succeeded" && (
                      <div className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1 font-mono break-words">
                        {row.last_run_return_message}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

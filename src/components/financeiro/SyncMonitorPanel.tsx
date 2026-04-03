import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertCircle, AlertTriangle, Clock, TrendingUp, Zap, Shield } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface SyncRecord {
  id: string;
  entidade: string;
  empresa_id: number;
  ultima_sync: string;
  total_registros: number;
  registros_inseridos: number;
  registros_atualizados: number;
  duracao_ms: number;
  status: string;
  erro_mensagem: string | null;
}

interface SyncMetric {
  id: string;
  entity: string;
  empresa_id: number;
  pages: number;
  rows: number;
  rows_inserted: number;
  duration_ms: number;
  errors: number;
  deadlock_retries: number;
  rows_per_second: number;
  status: string;
  created_at: string;
}

export function SyncMonitorPanel() {
  const [syncing, setSyncing] = useState(false);

  const { data: syncHistory, isLoading, refetch } = useQuery({
    queryKey: ["sync-monitor-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_control" as any)
        .select("*")
        .order("ultima_sync", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as unknown as SyncRecord[];
    },
    refetchInterval: 30000,
  });

  const { data: syncMetrics } = useQuery({
    queryKey: ["sync-metrics-trend"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_metrics" as any)
        .select("*")
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;
      return (data as unknown as SyncMetric[]) || [];
    },
    refetchInterval: 60000,
  });

  const lastSync = syncHistory?.[0];

  const handleForceSync = async () => {
    setSyncing(true);
    toast.info("Iniciando sincronização completa...");
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/erp-sync-engine`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ path: "sync-all" }),
        }
      );
      const result = await response.json();
      if (result.success) {
        toast.success("Sincronização concluída!");
      } else {
        toast.error("Erro na sincronização: " + (result.error || "desconhecido"));
      }
      refetch();
    } catch (err) {
      toast.error("Falha ao iniciar sincronização");
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" />Sucesso</Badge>;
      case "error":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Erro</Badge>;
      case "partial":
        return <Badge variant="warning" className="gap-1"><AlertTriangle className="h-3 w-3" />Parcial</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{status}</Badge>;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  // Prepare chart data
  const chartData = (syncMetrics || []).map((m) => ({
    time: format(new Date(m.created_at), "dd/MM HH:mm"),
    rows_per_second: m.rows_per_second,
    duration_s: Math.round(m.duration_ms / 1000),
    rows: m.rows,
    deadlocks: m.deadlock_retries,
  }));

  // Aggregate metrics
  const totalMetrics = (syncMetrics || []).reduce(
    (acc, m) => ({
      totalRows: acc.totalRows + m.rows,
      totalErrors: acc.totalErrors + m.errors,
      totalDeadlocks: acc.totalDeadlocks + m.deadlock_retries,
      avgRps: acc.avgRps + m.rows_per_second,
      count: acc.count + 1,
    }),
    { totalRows: 0, totalErrors: 0, totalDeadlocks: 0, avgRps: 0, count: 0 }
  );
  const avgRps = totalMetrics.count > 0 ? Math.round(totalMetrics.avgRps / totalMetrics.count) : 0;

  return (
    <div className="space-y-4 p-4 max-h-[70vh] overflow-auto">
      {/* Última Sync */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Última Sincronização</CardTitle>
            <Button size="sm" onClick={handleForceSync} disabled={syncing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Forçar Sync"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lastSync ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Data/Hora</p>
                <p className="text-sm font-medium">
                  {format(new Date(lastSync.ultima_sync), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                {getStatusBadge(lastSync.status)}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Registros</p>
                <p className="text-sm font-medium">{lastSync.total_registros?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Duração</p>
                <p className="text-sm font-medium">{formatDuration(lastSync.duracao_ms || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" />Conexão</p>
                <Badge variant="outline" className="gap-1 text-xs"><Shield className="h-3 w-3" />Rede Interna</Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada</p>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance de Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground">Média rows/s</p>
                <p className="text-lg font-bold flex items-center justify-center gap-1">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  {avgRps.toLocaleString()}
                </p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground">Total Erros</p>
                <p className="text-lg font-bold">{totalMetrics.totalErrors}</p>
              </div>
              <div className="text-center p-2 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground">Deadlock Retries</p>
                <p className="text-lg font-bold">{totalMetrics.totalDeadlocks}</p>
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(value: number, name: string) => {
                      if (name === "rows_per_second") return [value, "Rows/s"];
                      if (name === "duration_s") return [`${value}s`, "Duração"];
                      return [value, name];
                    }}
                  />
                  <Area type="monotone" dataKey="rows_per_second" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="rows_per_second" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de Sincronizações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead className="text-right">Inseridos</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncHistory?.map((sync) => (
                  <TableRow key={sync.id}>
                    <TableCell className="text-xs">
                      {format(new Date(sync.ultima_sync), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-xs">{sync.entidade}</TableCell>
                    <TableCell>{getStatusBadge(sync.status)}</TableCell>
                    <TableCell className="text-right text-xs">{sync.total_registros?.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs">{sync.registros_inseridos?.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs">{formatDuration(sync.duracao_ms || 0)}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={sync.erro_mensagem || ""}>
                      {sync.erro_mensagem || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

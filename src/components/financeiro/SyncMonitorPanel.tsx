import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, AlertCircle, AlertTriangle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada</p>
          )}
        </CardContent>
      </Card>

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

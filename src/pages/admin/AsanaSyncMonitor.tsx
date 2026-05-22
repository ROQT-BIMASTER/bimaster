import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, CheckCircle2, Clock, Plug, RefreshCw, Users, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type SyncLog = {
  id: string;
  workspace_gid: string | null;
  project_gids: string[] | null;
  status: string;
  projects_synced: number | null;
  sections_synced: number | null;
  tasks_synced: number | null;
  collaborators_synced: number | null;
  users_mapped: number | null;
  errors: any;
  started_at: string;
  completed_at: string | null;
};

function fmt(ts: string | null) {
  if (!ts) return "—";
  try { return format(new Date(ts), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }); } catch { return ts; }
}

function durationMs(a: string, b: string | null) {
  if (!b) return null;
  return new Date(b).getTime() - new Date(a).getTime();
}

export default function AsanaSyncMonitor() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [running, setRunning] = useState(false);
  const [replayingUserId, setReplayingUserId] = useState<string | null>(null);

  async function replayUser(uid: string, label: string) {
    setReplayingUserId(uid);
    try {
      const { data, error } = await supabase.functions.invoke("asana-sync", {
        body: { path: "/replay-user", user_id: uid },
      });
      if (error) throw error;
      const r: any = data;
      toast.success(
        `Replay de ${label}: ${r?.tasks_reconciled ?? 0} tarefas, ${r?.assignees_updated ?? 0} responsáveis, ${r?.followers_added ?? 0} seguidores`,
      );
      logs.refetch();
      userHealth.refetch();
    } catch (e: any) {
      toast.error(`Falha no replay: ${e?.message || "erro"}`);
    } finally {
      setReplayingUserId(null);
    }
  }

  const logs = useQuery({
    queryKey: ["asana-sync-logs"],
    enabled: isAdmin,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asana_sync_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as SyncLog[];
    },
  });

  const userHealth = useQuery({
    queryKey: ["asana-user-health"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, nome, email, status, departamento_id")
        .eq("status", "ativo")
        .eq("aprovado", true);
      if (pErr) throw pErr;
      const profileIds = (profiles || []).map((p) => p.id);

      const [mapsResp, segsResp, colabsResp, respResp] = await Promise.all([
        supabase.from("asana_sync_mappings").select("local_id").eq("entity_type", "user"),
        supabase.from("projeto_tarefa_seguidores").select("user_id"),
        supabase.from("projeto_tarefa_colaboradores").select("user_id"),
        supabase.from("projeto_tarefas").select("responsavel_id").not("responsavel_id", "is", null),
      ]);

      const tally = (rows: any[] | null, key: string) => {
        const m = new Map<string, number>();
        (rows || []).forEach((r) => {
          const k = r[key];
          if (!k) return;
          m.set(k, (m.get(k) || 0) + 1);
        });
        return m;
      };

      const mapsByUser = tally(mapsResp.data, "local_id");
      const segByUser = tally(segsResp.data, "user_id");
      const colByUser = tally(colabsResp.data, "user_id");
      const respByUser = tally(respResp.data, "responsavel_id");

      return (profiles || []).map((p) => ({
        ...p,
        asana_maps: mapsByUser.get(p.id) || 0,
        seguidor_em: segByUser.get(p.id) || 0,
        colaborador_em: colByUser.get(p.id) || 0,
        responsavel_em: respByUser.get(p.id) || 0,
        sem_mapeamento: (mapsByUser.get(p.id) || 0) === 0,
      })).sort((a, b) => (a.sem_mapeamento === b.sem_mapeamento ? 0 : a.sem_mapeamento ? -1 : 1));
    },
  });

  async function runSync() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("asana-sync", {
        body: { path: "/sync-project", phase: "core" },
      });
      if (error) throw error;
      toast.success("Sincronização iniciada");
      logs.refetch();
    } catch (e: any) {
      toast.error(`Falha: ${e?.message || "erro desconhecido"}`);
    } finally {
      setRunning(false);
    }
  }

  if (roleLoading) return <div className="p-6"><Skeleton className="h-32 w-full" /></div>;
  if (!isAdmin) return <div className="p-6 text-muted-foreground">Acesso restrito a administradores.</div>;

  const last = logs.data?.[0];
  const lastDuration = last ? durationMs(last.started_at, last.completed_at) : null;
  const errorsCount = last && Array.isArray(last.errors) ? last.errors.length : 0;

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Monitor de Sincronização Asana</h1>
          <p className="text-sm text-muted-foreground">Última execução, vínculos atualizados e saúde por usuário.</p>
        </div>
        <Button onClick={runSync} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          Executar sync agora
        </Button>
      </div>

      {/* KPIs do último run */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Clock className="h-3 w-3" /> Última execução</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.isLoading ? <Skeleton className="h-6 w-24" /> :
              <div className="text-sm font-medium">{fmt(last?.started_at || null)}</div>}
            <div className="text-xs text-muted-foreground mt-1">
              Duração: {lastDuration ? `${(lastDuration / 1000).toFixed(1)}s` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Status</CardDescription></CardHeader>
          <CardContent>
            <Badge variant={last?.status === "core_done" || last?.status === "completed" ? "default" : "secondary"}>
              {last?.status || "—"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Tarefas atualizadas</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{last?.tasks_synced ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Vínculos reconciliados</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{last?.collaborators_synced ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Erros</CardDescription>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{errorsCount}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico"><Activity className="h-4 w-4 mr-2" />Histórico</TabsTrigger>
          <TabsTrigger value="usuarios"><Users className="h-4 w-4 mr-2" />Saúde por usuário</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="space-y-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Últimas 30 execuções</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px]">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Início</th>
                      <th className="text-left py-2 px-2">Duração</th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-right py-2 px-2">Projetos</th>
                      <th className="text-right py-2 px-2">Tarefas</th>
                      <th className="text-right py-2 px-2">Vínculos</th>
                      <th className="text-right py-2 px-2">Erros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logs.data || []).map((l) => {
                      const dur = durationMs(l.started_at, l.completed_at);
                      const errs = Array.isArray(l.errors) ? l.errors.length : 0;
                      return (
                        <tr key={l.id} className="border-b hover:bg-muted/40">
                          <td className="py-2 px-2">{fmt(l.started_at)}</td>
                          <td className="py-2 px-2">{dur ? `${(dur / 1000).toFixed(1)}s` : "—"}</td>
                          <td className="py-2 px-2"><Badge variant="outline">{l.status}</Badge></td>
                          <td className="py-2 px-2 text-right">{l.projects_synced ?? 0}</td>
                          <td className="py-2 px-2 text-right">{l.tasks_synced ?? 0}</td>
                          <td className="py-2 px-2 text-right">{l.collaborators_synced ?? 0}</td>
                          <td className="py-2 px-2 text-right">
                            {errs > 0 ? <span className="text-destructive">{errs}</span> : <CheckCircle2 className="h-4 w-4 inline text-green-600" />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saúde por usuário</CardTitle>
              <CardDescription>Usuários sem mapeamento Asana aparecem primeiro.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px]">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Usuário</th>
                      <th className="text-left py-2 px-2">E-mail</th>
                      <th className="text-right py-2 px-2">Asana mapeado</th>
                      <th className="text-right py-2 px-2">Responsável</th>
                      <th className="text-right py-2 px-2">Seguidor</th>
                      <th className="text-right py-2 px-2">Colaborador</th>
                      <th className="text-right py-2 px-2">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(userHealth.data || []).map((u) => (
                      <tr key={u.id} className={`border-b hover:bg-muted/40 ${u.sem_mapeamento ? "bg-destructive/5" : ""}`}>
                        <td className="py-2 px-2">{u.nome}</td>
                        <td className="py-2 px-2 text-muted-foreground">{u.email}</td>
                        <td className="py-2 px-2 text-right">
                          {u.sem_mapeamento ? <Badge variant="destructive">sem GID</Badge> : u.asana_maps}
                        </td>
                        <td className="py-2 px-2 text-right">{u.responsavel_em}</td>
                        <td className="py-2 px-2 text-right">{u.seguidor_em}</td>
                        <td className="py-2 px-2 text-right">{u.colaborador_em}</td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={u.sem_mapeamento || replayingUserId === u.id}
                            onClick={() => replayUser(u.id, u.nome || u.email || "")}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${replayingUserId === u.id ? "animate-spin" : ""}`} />
                            Replay
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

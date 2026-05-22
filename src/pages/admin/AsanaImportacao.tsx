import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Download, FolderPlus, RefreshCw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

type Workspace = { gid: string; name: string };
type AsanaProject = { gid: string; name: string; color?: string | null; modified_at?: string | null };
type LocalProject = { id: string; nome: string; asana_gid: string | null };

export default function AsanaImportacao() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [workspaceGid, setWorkspaceGid] = useState<string>("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [importingWs, setImportingWs] = useState(false);

  const connection = useQuery({
    queryKey: ["asana-test-connection"],
    enabled: isAdmin,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("asana-sync", { body: { path: "/test-connection" } });
      if (error) throw error;
      return data as { user: { name: string; email: string }; workspaces: Workspace[] };
    },
  });

  useEffect(() => {
    if (!workspaceGid && connection.data?.workspaces?.length) {
      setWorkspaceGid(connection.data.workspaces[0].gid);
    }
  }, [connection.data, workspaceGid]);

  const asanaProjects = useQuery({
    queryKey: ["asana-list-projects", workspaceGid],
    enabled: isAdmin && !!workspaceGid,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("asana-sync", {
        body: { path: "/list-projects", workspace_gid: workspaceGid },
      });
      if (error) throw error;
      return (data as any).projects as AsanaProject[];
    },
  });

  const localProjects = useQuery({
    queryKey: ["local-projects-asana"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome, asana_gid")
        .not("asana_gid", "is", null);
      if (error) throw error;
      return (data || []) as LocalProject[];
    },
  });

  const localByGid = useMemo(() => {
    const m = new Map<string, LocalProject>();
    (localProjects.data || []).forEach((p) => p.asana_gid && m.set(p.asana_gid, p));
    return m;
  }, [localProjects.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (asanaProjects.data || []).filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [asanaProjects.data, search]);

  async function importWorkspace() {
    if (!workspaceGid) return;
    setImportingWs(true);
    try {
      const { data, error } = await supabase.functions.invoke("asana-sync", {
        body: { path: "/import-workspace", workspace_gid: workspaceGid },
      });
      if (error) throw error;
      const r: any = data;
      toast.success(`Workspace importado: ${r.created} novo(s), ${r.updated} atualizado(s).`);
      localProjects.refetch();
      asanaProjects.refetch();
    } catch (e: any) {
      toast.error(`Falha na importação: ${e?.message || "erro"}`);
    } finally {
      setImportingWs(false);
    }
  }

  async function syncProject(p: AsanaProject) {
    setBusy(p.gid);
    try {
      const { data, error } = await supabase.functions.invoke("asana-sync", {
        body: {
          path: "/sync-project",
          workspace_gid: workspaceGid,
          project_gids: [p.gid],
          phase: "full",
        },
      });
      if (error) throw error;
      const r: any = data;
      toast.success(`${p.name}: ${r?.tasks_synced ?? 0} tarefas sincronizadas.`);
      localProjects.refetch();
    } catch (e: any) {
      toast.error(`Falha em ${p.name}: ${e?.message || "erro"}`);
    } finally {
      setBusy(null);
    }
  }

  if (roleLoading) return <div className="p-6"><Skeleton className="h-32 w-full" /></div>;
  if (!isAdmin) return <div className="p-6 text-muted-foreground">Acesso restrito a administradores.</div>;

  const total = filtered.length;
  const importedCount = filtered.filter((p) => localByGid.has(p.gid)).length;
  const pending = total - importedCount;

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Importação Asana</h1>
          <p className="text-sm text-muted-foreground">
            Descubra projetos no workspace e importe tarefas, comentários, anexos e mensagens.
          </p>
        </div>
        <Button onClick={importWorkspace} disabled={!workspaceGid || importingWs}>
          <FolderPlus className={`h-4 w-4 mr-2 ${importingWs ? "animate-pulse" : ""}`} />
          Importar workspace inteiro
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conexão</CardTitle>
        </CardHeader>
        <CardContent>
          {connection.isLoading ? (
            <Skeleton className="h-5 w-64" />
          ) : connection.data ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>
                Conectado como <strong>{connection.data.user.name}</strong> —{" "}
                {connection.data.workspaces.length} workspace(s).
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              <span>Conexão indisponível. Verifique BiMaster Sync em Conectores.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={workspaceGid} onValueChange={setWorkspaceGid}>
          <SelectTrigger className="sm:w-72"><SelectValue placeholder="Selecione um workspace" /></SelectTrigger>
          <SelectContent>
            {(connection.data?.workspaces || []).map((w) => (
              <SelectItem key={w.gid} value={w.gid}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar projeto…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardDescription>Projetos no Asana</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{total}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Já importados</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{importedCount}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Pendentes</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{pending}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projetos do workspace</CardTitle>
          <CardDescription>Sincronize individualmente para puxar tarefas, comentários e anexos.</CardDescription>
        </CardHeader>
        <CardContent>
          {asanaProjects.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ScrollArea className="h-[520px]">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Projeto Asana</th>
                    <th className="text-left py-2 px-2">Status local</th>
                    <th className="text-left py-2 px-2">Modificado</th>
                    <th className="text-right py-2 px-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const local = localByGid.get(p.gid);
                    return (
                      <tr key={p.gid} className="border-b hover:bg-muted/40">
                        <td className="py-2 px-2">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">gid {p.gid}</div>
                        </td>
                        <td className="py-2 px-2">
                          {local
                            ? <Badge variant="default">Importado</Badge>
                            : <Badge variant="outline">Não importado</Badge>}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {p.modified_at ? new Date(p.modified_at).toLocaleString("pt-BR") : "—"}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            size="sm"
                            variant={local ? "outline" : "default"}
                            disabled={busy === p.gid}
                            onClick={() => syncProject(p)}
                          >
                            {busy === p.gid
                              ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              : <Download className="h-3 w-3 mr-1" />}
                            {local ? "Re-sincronizar" : "Importar"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">
                      Nenhum projeto encontrado.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

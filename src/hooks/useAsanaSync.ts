import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AsanaWorkspace {
  gid: string;
  name: string;
}

interface AsanaProject {
  gid: string;
  name: string;
  color: string | null;
  modified_at: string | null;
}

interface SyncResult {
  success: boolean;
  projects_synced: number;
  sections_synced: number;
  tasks_synced: number;
  comments_synced: number;
  users_mapped: number;
  errors: any[];
}

interface SyncLog {
  id: string;
  workspace_gid: string;
  project_gids: string[];
  status: string;
  projects_synced: number;
  sections_synced: number;
  tasks_synced: number;
  comments_synced: number;
  users_mapped: number;
  errors: any[];
  started_at: string;
  completed_at: string | null;
}

export function useAsanaSync() {
  const [loading, setLoading] = useState(false);

  async function callAsana(path: string, extra: Record<string, any> = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");

    const { data, error } = await supabase.functions.invoke("asana-sync", {
      body: { path, ...extra },
    });

    if (error) throw new Error(error.message || "Erro na chamada");
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function testConnection(pat: string): Promise<{
    user: { name: string; email: string };
    workspaces: AsanaWorkspace[];
  }> {
    setLoading(true);
    try {
      const result = await callAsana("/test-connection", { pat });
      toast.success(`Conectado como ${result.user.name}`);
      return result;
    } catch (e: any) {
      toast.error(`Falha na conexão: ${e.message}`);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function listProjects(pat: string, workspaceGid: string): Promise<AsanaProject[]> {
    setLoading(true);
    try {
      const result = await callAsana("/list-projects", { pat, workspace_gid: workspaceGid });
      return result.projects;
    } catch (e: any) {
      toast.error(`Erro ao listar projetos: ${e.message}`);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function syncProjects(
    pat: string,
    workspaceGid: string,
    projectGids: string[]
  ): Promise<SyncResult> {
    setLoading(true);
    try {
      const result = await callAsana("/sync-project", {
        pat,
        workspace_gid: workspaceGid,
        project_gids: projectGids,
      });
      if (result.success) {
        toast.success(
          `Sincronizado: ${result.projects_synced} projetos, ${result.tasks_synced} tarefas, ${result.comments_synced} comentários`
        );
      }
      return result;
    } catch (e: any) {
      toast.error(`Erro na sincronização: ${e.message}`);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function getSyncLogs(): Promise<SyncLog[]> {
    try {
      const result = await callAsana("/status");
      return result.logs || [];
    } catch {
      return [];
    }
  }

  async function analyzeStructure(
    pat: string,
    workspaceGid: string
  ): Promise<{ report: string; structure: any }> {
    setLoading(true);
    try {
      const result = await callAsana("/analyze-structure", {
        pat,
        workspace_gid: workspaceGid,
      });
      toast.success("Análise concluída!");
      return result;
    } catch (e: any) {
      toast.error(`Erro na análise: ${e.message}`);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return { testConnection, listProjects, syncProjects, getSyncLogs, analyzeStructure, loading };
}

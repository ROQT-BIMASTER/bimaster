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
  phase: string;
  complete?: boolean;
  next_phase?: string;
  log_id: string;
  projects_synced: number;
  sections_synced: number;
  tasks_synced: number;
  subtasks_synced: number;
  attachments_synced: number;
  comments_synced: number;
  collaborators_synced: number;
  users_mapped: number;
  errors: any[];
  message?: string;
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
  const [syncStatus, setSyncStatus] = useState<string>("");

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
      // Phase 1: Core (projects, sections, tasks)
      setSyncStatus("Fase 1: Sincronizando projetos, seções e tarefas...");
      const coreResult = await callAsana("/sync-project", {
        pat,
        workspace_gid: workspaceGid,
        project_gids: projectGids,
        phase: "core",
      });

      toast.success(
        `Fase 1: ${coreResult.projects_synced} projetos, ${coreResult.tasks_synced} tarefas`
      );

      // Phase 2: Secondary (subtasks, attachments, comments) — may need multiple calls
      const logId = coreResult.log_id;
      let secondaryComplete = false;
      let totalSubtasks = 0, totalAttachments = 0, totalComments = 0;
      let lastErrors: any[] = [];
      let attempts = 0;
      const maxAttempts = 10; // Safety limit

      while (!secondaryComplete && attempts < maxAttempts) {
        attempts++;
        setSyncStatus(`Fase 2 (${attempts}): Subtarefas, anexos e comentários...`);

        try {
          const secResult = await callAsana("/sync-project", {
            pat,
            workspace_gid: workspaceGid,
            project_gids: projectGids,
            phase: "secondary",
            log_id: logId,
          });

          totalSubtasks += secResult.subtasks_synced || 0;
          totalAttachments += secResult.attachments_synced || 0;
          totalComments += secResult.comments_synced || 0;
          lastErrors = secResult.errors || [];

          if (secResult.complete) {
            secondaryComplete = true;
          } else {
            toast.info(`Fase 2 parcial (${attempts}): +${secResult.subtasks_synced || 0} subtarefas, +${secResult.comments_synced || 0} comentários. Continuando...`);
          }
        } catch (e: any) {
          // If secondary phase fails, still return core success
          console.error("Secondary phase error:", e);
          lastErrors.push({ phase: "secondary", attempt: attempts, error: e.message });
          break;
        }
      }

      setSyncStatus("");
      const finalResult: SyncResult = {
        success: true,
        phase: "complete",
        complete: secondaryComplete,
        log_id: logId,
        projects_synced: coreResult.projects_synced || 0,
        sections_synced: coreResult.sections_synced || 0,
        tasks_synced: coreResult.tasks_synced || 0,
        subtasks_synced: totalSubtasks,
        attachments_synced: totalAttachments,
        comments_synced: totalComments,
        collaborators_synced: coreResult.collaborators_synced || 0,
        users_mapped: coreResult.users_mapped || 0,
        errors: [...(coreResult.errors || []), ...lastErrors],
      };

      toast.success(
        `Sincronizado: ${finalResult.projects_synced} projetos, ${finalResult.tasks_synced} tarefas, ${totalSubtasks} subtarefas, ${totalAttachments} anexos, ${totalComments} comentários`
      );

      return finalResult;
    } catch (e: any) {
      setSyncStatus("");
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

  return { testConnection, listProjects, syncProjects, getSyncLogs, analyzeStructure, loading, syncStatus };
}

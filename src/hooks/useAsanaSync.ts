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
  subtasks_synced: number;
  attachments_synced: number;
  comments_synced: number;
  collaborators_synced: number;
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

    // Quando a edge retorna 4xx/5xx, o SDK coloca a resposta em error.context
    if (error) {
      let serverMessage = error.message || "Erro na chamada";
      try {
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json();
          if (body?.error) serverMessage = body.error;
        } else if (ctx && typeof ctx.text === "function") {
          const txt = await ctx.text();
          try {
            const parsed = JSON.parse(txt);
            if (parsed?.error) serverMessage = parsed.error;
          } catch {
            if (txt) serverMessage = txt;
          }
        }
      } catch { /* ignore */ }
      throw new Error(serverMessage);
    }
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
      // Phase 1: Core (projects, sections, tasks) — may need multiple calls for large projects
      let coreResult: any = null;
      let coreComplete = false;
      let coreAttempts = 0;
      const maxCoreAttempts = 15;
      let coreLogId: string | undefined = undefined;
      let totalCoreTasks = 0, totalCoreSections = 0, totalCoreProjects = 0;
      let totalCoreCollabs = 0, totalCoreUsers = 0;
      let coreErrors: any[] = [];

      while (!coreComplete && coreAttempts < maxCoreAttempts) {
        coreAttempts++;
        setSyncStatus(
          `Fase 1 (passagem ${coreAttempts}): ${totalCoreTasks} tarefas / ${totalCoreSections} seções / ${totalCoreProjects} projetos importados`
        );
        coreResult = await callAsana("/sync-project", {
          pat,
          workspace_gid: workspaceGid,
          project_gids: projectGids,
          phase: "core",
          ...(coreLogId ? { log_id: coreLogId } : {}),
        });
        coreLogId = coreResult.log_id;
        // Estes contadores são por chamada — usamos os da última como referência cumulativa,
        // pois o backend faz upsert e recontará o total na próxima passagem.
        totalCoreTasks = Math.max(totalCoreTasks, coreResult.tasks_synced || 0);
        totalCoreSections = Math.max(totalCoreSections, coreResult.sections_synced || 0);
        totalCoreProjects = Math.max(totalCoreProjects, coreResult.projects_synced || 0);
        totalCoreCollabs = Math.max(totalCoreCollabs, coreResult.collaborators_synced || 0);
        totalCoreUsers = Math.max(totalCoreUsers, coreResult.users_mapped || 0);
        coreErrors = coreResult.errors || [];

        coreComplete = coreResult.complete !== false; // backward-compat: undefined = complete
        if (!coreComplete) {
          setSyncStatus(
            `Fase 1 (passagem ${coreAttempts}): ${totalCoreTasks} tarefas até agora — continuando automaticamente...`
          );
        }
      }

      if (!coreComplete) {
        // Atingiu o limite de retomadas — avisa em vez de falhar silenciosamente
        toast.warning(
          `Importação parcial: ${totalCoreTasks} tarefas em ${coreAttempts} tentativas. Clique em "Sincronizar" novamente para continuar de onde parou.`
        );
      }

      toast.success(
        `Fase 1: ${totalCoreProjects} projetos, ${totalCoreTasks} tarefas`
      );

      // Phase 2: Secondary (subtasks, attachments, comments) — may need multiple calls
      const logId = coreLogId!;
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
        projects_synced: totalCoreProjects,
        sections_synced: totalCoreSections,
        tasks_synced: totalCoreTasks,
        subtasks_synced: totalSubtasks,
        attachments_synced: totalAttachments,
        comments_synced: totalComments,
        collaborators_synced: totalCoreCollabs,
        users_mapped: totalCoreUsers,
        errors: [...coreErrors, ...lastErrors],
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

// src/hooks/useNotionConnection.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { openNotionOAuthPopup } from "@/lib/notion/popup";
import { toast } from "sonner";

export interface NotionConnection {
  id: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  briefings_database_id: string | null;
  briefings_database_url: string | null;
  notion_user_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotionExportLog {
  id: string;
  briefing_id: string;
  notion_page_id: string | null;
  notion_page_url: string | null;
  status: "success" | "error";
  error_message: string | null;
  created_at: string;
}

export function useNotionConnection() {
  const qc = useQueryClient();

  const connection = useQuery({
    queryKey: ["notion-connection"],
    queryFn: async (): Promise<NotionConnection | null> => {
      const { data, error } = await supabase
        .from("notion_connections")
        .select(
          "id, workspace_id, workspace_name, workspace_icon, briefings_database_id, briefings_database_url, notion_user_name, created_at, updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ authorize_url: string }>(
        "notion-oauth-start",
        { body: {} },
      );
      if (error || !data?.authorize_url) {
        throw new Error(error?.message || "Não foi possível iniciar a conexão com o Notion.");
      }
      const result = await openNotionOAuthPopup(data.authorize_url);
      return result;
    },
    onSuccess: async (result) => {
      if (result.outcome === "success") {
        toast.success("Notion conectado com sucesso");
      } else if (result.outcome === "error") {
        toast.error("A conexão com o Notion foi recusada");
      }
      // Re-query in any case (also handles "closed" where user may have completed)
      await new Promise((r) => setTimeout(r, 600));
      qc.invalidateQueries({ queryKey: ["notion-connection"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("notion-disconnect", { body: {} });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Notion desconectado");
      qc.invalidateQueries({ queryKey: ["notion-connection"] });
      qc.invalidateQueries({ queryKey: ["notion-export-log"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { connection, connect, disconnect };
}

export function useNotionExportLog(limit = 20) {
  return useQuery({
    queryKey: ["notion-export-log", limit],
    queryFn: async (): Promise<NotionExportLog[]> => {
      const { data, error } = await supabase
        .from("notion_export_log")
        .select("id, briefing_id, notion_page_id, notion_page_url, status, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as NotionExportLog[];
    },
  });
}

export async function sendBriefingToNotion(
  briefingId: string,
  opts?: { force?: boolean },
): Promise<{ page_url: string; action: "create" | "update" }> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    page_url: string;
    action: "create" | "update";
    error?: string;
    message?: string;
  }>("notion-export-briefing", {
    body: {
      briefing_id: briefingId,
      bimaster_origin: PUBLIC_FORMS_DOMAIN,
      force: opts?.force ?? false,
    },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) {
    throw new Error(data?.message || data?.error || "Falha ao enviar para o Notion");
  }
  return { page_url: data.page_url, action: data.action };
}

export async function pullBriefingFromNotion(
  briefingId: string,
): Promise<{ fields_changed: string[]; notes_chars: number }> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean;
    fields_changed: string[];
    notes_chars: number;
    error?: string;
  }>("notion-pull-briefing", { body: { briefing_id: briefingId } });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || "Falha ao puxar do Notion");
  return { fields_changed: data.fields_changed, notes_chars: data.notes_chars };
}

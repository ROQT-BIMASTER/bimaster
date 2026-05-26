// src/hooks/useGoogleDriveSync.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DriveConnectionStatus = "nao_configurado" | "conectado" | "erro" | "desconectado";

export interface GoogleDriveConfig {
  id: string;
  root_folder_id: string | null;
  root_folder_name: string;
  shared_drive_id: string | null;
  auto_sync_enabled: boolean;
  connection_status: DriveConnectionStatus;
  last_verified_at: string | null;
}

export function useGoogleDriveConfig() {
  return useQuery({
    queryKey: ["google-drive-config"],
    queryFn: async (): Promise<GoogleDriveConfig | null> => {
      const { data, error } = await (supabase as any)
        .from("google_drive_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as GoogleDriveConfig | null;
    },
    staleTime: 30_000,
  });
}

export function useSalvarDriveConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<GoogleDriveConfig>) => {
      const { data: cfg } = await (supabase as any)
        .from("google_drive_config").select("id").limit(1).maybeSingle();
      if (!cfg) throw new Error("Config inexistente");
      const { error } = await (supabase as any)
        .from("google_drive_config").update(patch).eq("id", cfg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-drive-config"] });
      toast.success("Configuração salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useVerificarDriveConexao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gdrive-verificar-conexao", {
        body: {},
      });
      if (error) throw new Error(error.message);
      return data as { ok: boolean; status: DriveConnectionStatus; error?: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["google-drive-config"] });
      if (data.ok) toast.success("Conexão verificada com sucesso");
      else toast.error(data.error || "Conexão indisponível");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSyncDocumentoDrive(briefingId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (documento_id: string) => {
      const { data, error } = await supabase.functions.invoke("gdrive-sync-documento", {
        body: { documento_id },
      });
      if (error) throw new Error(error.message);
      return data as { ok: boolean; drive_url?: string; error?: string };
    },
    onSuccess: (data) => {
      if (briefingId) qc.invalidateQueries({ queryKey: ["briefing-documentos", briefingId] });
      if (data.ok) toast.success("Enviado ao Google Drive");
      else if (data.error === "not_configured")
        toast.error("Google Drive ainda não foi configurado");
      else toast.error(data.error || "Falha no envio");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCompartilharPastaBriefing(briefingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (acao: "compartilhar" | "revogar") => {
      const { data, error } = await supabase.functions.invoke("gdrive-compartilhar-pasta", {
        body: { briefing_id: briefingId, acao },
      });
      if (error) throw new Error(error.message);
      return data as { ok: boolean; share_url?: string; error?: string };
    },
    onSuccess: (data, acao) => {
      qc.invalidateQueries({ queryKey: ["briefing", briefingId] });
      if (!data.ok) {
        toast.error(data.error === "not_configured"
          ? "Google Drive ainda não foi configurado"
          : data.error || "Falha");
        return;
      }
      toast.success(acao === "compartilhar" ? "Link de compartilhamento criado" : "Compartilhamento revogado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RRTaskResult {
  ok: boolean;
  action: "create" | "update";
  page_id: string;
  page_url: string;
  solicitante_resolvido: boolean;
  warnings?: string[];
}

export function useRRTask() {
  const [enviando, setEnviando] = useState(false);

  async function enviarParaRRTask(
    briefingId: string,
    opts?: { force?: boolean },
  ): Promise<RRTaskResult> {
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke<RRTaskResult>(
        "rrtask-create-task",
        { body: { briefing_id: briefingId, force: opts?.force ?? false } },
      );
      if (error) throw error;
      if (!data?.ok) throw new Error((data as any)?.error ?? "Falha ao enviar");

      toast.success(
        data.action === "update"
          ? "Task atualizada no RR-Tasks"
          : "Task criada no RR-Tasks",
      );
      if (data.solicitante_resolvido === false) {
        toast.warning(
          "Solicitante gravado como texto (usuário ainda não mapeado no Notion da agência).",
        );
      }
      (data.warnings ?? []).forEach((w) => toast.warning(w));
      return data;
    } catch (e: any) {
      toast.error(
        "Erro ao enviar para o RR-Tasks: " + (e?.message ?? "desconhecido"),
      );
      throw e;
    } finally {
      setEnviando(false);
    }
  }

  return { enviando, enviarParaRRTask };
}

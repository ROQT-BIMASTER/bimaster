import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Args {
  submissao_id: string;
  /** Quando informado, atualiza apenas esse documento. Caso contrário, promove
   * todos os documentos `rascunho` da submissão para `pendente`. */
  documento_id?: string;
}

/**
 * Envia uma submissão da China para o Brasil:
 *  1) Documentos rascunho da submissão → status "pendente"
 *  2) Submissão pai → status "enviado_brasil" + data_envio = now()
 */
export function useEnviarDocumentoAoBrasil() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ submissao_id, documento_id }: Args) => {
      if (documento_id) {
        const { error: docErr } = await supabase
          .from("china_produto_documentos" as any)
          .update({ status: "pendente" } as any)
          .eq("id", documento_id);
        if (docErr) throw docErr;
      } else {
        const { error: docErr } = await supabase
          .from("china_produto_documentos" as any)
          .update({ status: "pendente" } as any)
          .eq("submissao_id", submissao_id)
          .eq("status", "rascunho");
        if (docErr) throw docErr;
      }

      const { error: subErr } = await supabase
        .from("china_produto_submissoes" as any)
        .update({
          status: "enviado_brasil",
          data_envio: new Date().toISOString(),
        } as any)
        .eq("id", submissao_id);
      if (subErr) throw subErr;
    },
    onSuccess: () => {
      toast.success("Submissão enviada ao Brasil / 已发送至巴西");
      qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
      qc.invalidateQueries({ queryKey: ["china-stats"] });
      qc.invalidateQueries({ queryKey: ["vincular-china"] });
      qc.invalidateQueries({ queryKey: ["vincular-china-flags"] });
      qc.invalidateQueries({ queryKey: ["vincular-china-snoozes"] });
    },
    onError: (err: any) => {
      console.error("[useEnviarDocumentoAoBrasil]", err);
      toast.error(err?.message || "Erro ao enviar ao Brasil / 发送失败");
    },
  });
}

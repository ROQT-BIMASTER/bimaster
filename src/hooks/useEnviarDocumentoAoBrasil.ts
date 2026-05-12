import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Args {
  documento_id: string;
  submissao_id: string;
}

/**
 * Envia um documento da China para o Brasil:
 *  1) Documento → status "pendente"
 *  2) Submissão pai → status "enviado_brasil" + data_envio = now()
 *
 * Espelha o comportamento do botão "Enviar ao Brasil" do
 * ChinaChecklistFocusMode, porém atuando em UM documento de cada vez
 * (selecionado na Caixa de Entrada).
 */
export function useEnviarDocumentoAoBrasil() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ documento_id, submissao_id }: Args) => {
      const { error: docErr } = await supabase
        .from("china_produto_documentos" as any)
        .update({ status: "pendente" } as any)
        .eq("id", documento_id);
      if (docErr) throw docErr;

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
      toast.success("Documento enviado ao Brasil / 文件已发送至巴西");
      qc.invalidateQueries({ queryKey: ["china-mailbox"] });
      qc.invalidateQueries({ queryKey: ["china-inbox"] });
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

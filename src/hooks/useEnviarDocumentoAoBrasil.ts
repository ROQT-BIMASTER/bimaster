import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Args {
  submissao_id: string;
  /** Quando informado, atualiza apenas esse documento. Caso contrário, promove
   * todos os documentos `rascunho` da submissão para `pendente`. */
  documento_id?: string;
  /** Suprime toast/invalidation por item — usado em envios em lote em que o
   * chamador exibe um único toast resumo e invalida queries uma vez só. */
  silent?: boolean;
}

/**
 * Envia uma submissão (ou um único documento) da China para o Brasil.
 *
 * Regras de status da submissão pai (`china_produto_submissoes.status`):
 *  - Envio em lote (sem `documento_id`)          → `enviado_brasil`
 *  - Envio individual e todos os docs já saíram  → `enviado_brasil`
 *  - Envio individual com docs ainda em rascunho → `enviado_parcial`
 *
 * O status `enviado_parcial` reflete envios fracionados do checklist e impede
 * que o painel agregado "anuncie" envio completo enquanto ainda há rascunhos.
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

      // Recalcula o status da submissão pai a partir do estado atual dos docs.
      // Single-doc → pode ficar `enviado_parcial` se ainda há rascunhos.
      // Lote (sem documento_id) → sempre `enviado_brasil`.
      let nextStatus: "enviado_brasil" | "enviado_parcial" = "enviado_brasil";
      if (documento_id) {
        const { data: docs, error: listErr } = await (supabase
          .from("china_produto_documentos" as any)
          .select("status")
          .eq("submissao_id", submissao_id) as any);
        if (listErr) throw listErr;
        const aindaRascunho = (docs ?? []).some(
          (d: any) => (d?.status ?? "rascunho") === "rascunho",
        );
        nextStatus = aindaRascunho ? "enviado_parcial" : "enviado_brasil";
      }

      const { error: subErr } = await supabase
        .from("china_produto_submissoes" as any)
        .update({
          status: nextStatus,
          data_envio: new Date().toISOString(),
        } as any)
        .eq("id", submissao_id);
      if (subErr) throw subErr;

      return { status_pai: nextStatus };
    },
    onSuccess: (res) => {
      const msg =
        res?.status_pai === "enviado_parcial"
          ? "Documento enviado ao Brasil (envio parcial) / 已发送至巴西（部分）"
          : "Submissão enviada ao Brasil / 已发送至巴西";
      toast.success(msg);
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

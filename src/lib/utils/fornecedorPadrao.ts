import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface FornecedorPadrao {
  plano_contas_id: string | null;
  categoria_codigo: string | null;
}

/**
 * Busca o plano de contas padrão memorizado para o fornecedor (por codigo_externo/documento).
 * Usado no submit da origem para pré-preencher a classificação da fila financeira.
 * Retorna nulls silenciosamente se não houver padrão ou se a consulta falhar.
 */
export async function lookupFornecedorPadrao(
  supplierDocument: string | null | undefined,
): Promise<FornecedorPadrao> {
  if (!supplierDocument) return { plano_contas_id: null, categoria_codigo: null };
  try {
    const { data, error } = await supabase
      .from("fornecedores")
      .select("plano_contas_id_padrao, categoria_codigo_padrao")
      .eq("codigo_externo", supplierDocument)
      .not("plano_contas_id_padrao", "is", null)
      .limit(1)
      .maybeSingle();
    if (error || !data) return { plano_contas_id: null, categoria_codigo: null };
    return {
      plano_contas_id: (data as any).plano_contas_id_padrao ?? null,
      categoria_codigo: (data as any).categoria_codigo_padrao ?? null,
    };
  } catch (err) {
    logger.warn("lookupFornecedorPadrao falhou", err);
    return { plano_contas_id: null, categoria_codigo: null };
  }
}

/**
 * Salva o plano de contas escolhido pelo financeiro como padrão do fornecedor.
 * Usado no aceite quando o usuário marca "Salvar como padrão".
 * Falha silenciosa (warning) — nunca desfaz o aceite.
 */
export async function saveFornecedorPadrao(params: {
  supplierDocument: string | null | undefined;
  planoContasId: string | null;
  categoriaCodigo: string | null;
  userId: string | null | undefined;
}): Promise<{ ok: boolean; count: number; error?: string }> {
  const { supplierDocument, planoContasId, categoriaCodigo, userId } = params;
  if (!supplierDocument || !planoContasId || !categoriaCodigo) {
    return { ok: false, count: 0, error: "dados insuficientes" };
  }
  try {
    const { data, error } = await supabase
      .from("fornecedores")
      .update({
        plano_contas_id_padrao: planoContasId,
        categoria_codigo_padrao: categoriaCodigo,
        plano_padrao_atualizado_em: new Date().toISOString(),
        plano_padrao_atualizado_por: userId ?? null,
      } as any)
      .eq("codigo_externo", supplierDocument)
      .select("id");
    if (error) return { ok: false, count: 0, error: error.message };
    return { ok: true, count: data?.length ?? 0 };
  } catch (err: any) {
    return { ok: false, count: 0, error: err?.message || "erro desconhecido" };
  }
}

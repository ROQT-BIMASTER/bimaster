import { supabase } from "@/integrations/supabase/client";

/**
 * Registra uma movimentação automática na tarefa do projeto
 * quando um despacho é realizado, incluindo o número do processo.
 */
export async function registrarMovimentacaoNaTarefa(params: {
  tarefa_id: string;
  projeto_id: string;
  user_id: string;
  modulo_destino: string;
  descricao_despacho?: string;
  numero_processo?: string;
  documento_titulo?: string;
}) {
  const desc = [
    `Despacho para ${params.modulo_destino}`,
    params.numero_processo ? `(Proc. ${params.numero_processo})` : null,
    params.documento_titulo ? `— ${params.documento_titulo}` : null,
    params.descricao_despacho ? `| ${params.descricao_despacho}` : null,
  ].filter(Boolean).join(" ");

  await supabase
    .from("projeto_tarefa_atividades" as any)
    .insert({
      tarefa_id: params.tarefa_id,
      projeto_id: params.projeto_id,
      user_id: params.user_id,
      tipo: "despacho_processo",
      campo: "processo",
      valor_anterior: null,
      valor_novo: params.modulo_destino,
      descricao: desc,
    });
}

/**
 * Busca o número do processo vinculado a uma submissão
 */
export async function buscarNumeroProcesso(submissaoId: string): Promise<string | null> {
  const { data } = await (supabase
    .from("product_process" as any)
    .select("numero_processo")
    .eq("produto_ref_id", submissaoId)
    .limit(1)
    .maybeSingle() as any);
  return data?.numero_processo || null;
}

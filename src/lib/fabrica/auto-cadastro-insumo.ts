import { supabase } from "@/integrations/supabase/client";

/**
 * Helper para resolver (ou criar automaticamente) os cadastros de
 * Fornecedor e Matéria-Prima a partir de insumos extraídos pela IA
 * ou digitados livremente no quick-add. Garante que toda linha que entra
 * em `fabrica_produto_custos` tenha um `mp_id` apontando para o cadastro
 * mestre, mantendo a integridade do MRP / BOM / Cenários.
 */

export interface InsumoBruto {
  codigo?: string;
  nome: string;
  fornecedor?: string;
  tipo_insumo?: string;
  custo_nf?: number;
  custo_servico?: number;
  custo_condicao?: number;
  nf_referencia?: string;
}

export interface InsumoResolvido extends InsumoBruto {
  mp_id?: string;
  codigo_insumo?: string;
  codigo_fornecedor?: string;
}

const norm = (s: string | undefined | null): string =>
  (s ?? "").trim().toUpperCase().replace(/\s+/g, " ");

async function resolverFornecedorId(nomeFornecedor?: string): Promise<string | null> {
  const n = norm(nomeFornecedor);
  if (!n) return null;

  // Tenta achar por nome_fantasia ou razao_social (case-insensitive)
  const { data: existentes } = await supabase
    .from("fabrica_fornecedores")
    .select("id, razao_social, nome_fantasia")
    .or(`razao_social.ilike.${n},nome_fantasia.ilike.${n}`)
    .limit(5);

  const match = (existentes ?? []).find(
    (f: any) => norm(f.nome_fantasia) === n || norm(f.razao_social) === n
  );
  if (match) return match.id as string;

  // Cria fornecedor pendente
  const { data: novo, error } = await supabase
    .from("fabrica_fornecedores")
    .insert({
      razao_social: nomeFornecedor!.trim(),
      nome_fantasia: nomeFornecedor!.trim(),
      cnpj: null,
      ativo: true,
      pendente_complemento: true,
    } as any)
    .select("id")
    .single();

  if (error || !novo) {
    console.error("[auto-cadastro] Falha ao criar fornecedor:", error);
    return null;
  }
  return (novo as any).id as string;
}

async function resolverMateriaPrima(
  nome: string,
  fornecedorId: string | null,
  custoSugerido: number,
  codigoInformado?: string
): Promise<{ id: string; codigo: string } | null> {
  const n = norm(nome);
  if (!n) return null;

  // 1) Se IA trouxe código, tenta achar exato
  if (codigoInformado && codigoInformado.trim()) {
    const { data: porCodigo } = await supabase
      .from("fabrica_materias_primas")
      .select("id, codigo")
      .eq("codigo", codigoInformado.trim())
      .maybeSingle();
    if (porCodigo) return porCodigo as { id: string; codigo: string };
  }

  // 2) Match por nome + fornecedor
  const { data: candidatos } = await supabase
    .from("fabrica_materias_primas")
    .select("id, codigo, nome, fornecedor_id")
    .ilike("nome", n)
    .limit(10);

  const match = (candidatos ?? []).find(
    (m: any) =>
      norm(m.nome) === n &&
      (m.fornecedor_id ?? null) === (fornecedorId ?? null)
  );
  if (match) return { id: (match as any).id, codigo: (match as any).codigo };

  // 3) Gera próximo código MP-NNNNN via RPC
  const { data: codigoRpc, error: rpcErr } = await supabase.rpc("next_mp_codigo" as any);
  if (rpcErr || !codigoRpc) {
    console.error("[auto-cadastro] Falha ao gerar código MP:", rpcErr);
    return null;
  }
  const codigo = codigoInformado?.trim() || (codigoRpc as unknown as string);

  const { data: nova, error } = await supabase
    .from("fabrica_materias_primas")
    .insert({
      codigo,
      nome: nome.trim(),
      fornecedor_id: fornecedorId,
      custo_unitario: custoSugerido || 0,
      ativo: true,
      status: "ativo",
    } as any)
    .select("id, codigo")
    .single();

  if (error || !nova) {
    console.error("[auto-cadastro] Falha ao criar MP:", error);
    return null;
  }
  return nova as { id: string; codigo: string };
}

/**
 * Garante que o insumo tenha `mp_id` e `codigo_insumo`, criando Fornecedor
 * e Matéria-Prima caso ainda não existam. Se já vier com `mp_id`, devolve
 * inalterado. Se algum passo falhar, devolve sem `mp_id` (fallback: texto livre).
 */
export async function resolverOuCriarInsumo(
  insumo: InsumoBruto & { mp_id?: string }
): Promise<InsumoResolvido> {
  if (insumo.mp_id) return insumo as InsumoResolvido;

  const fornecedorId = await resolverFornecedorId(insumo.fornecedor);
  const mp = await resolverMateriaPrima(
    insumo.nome,
    fornecedorId,
    insumo.custo_nf ?? 0,
    insumo.codigo
  );

  if (!mp) return insumo as InsumoResolvido;

  return {
    ...insumo,
    mp_id: mp.id,
    codigo: insumo.codigo || mp.codigo,
    codigo_insumo: insumo.codigo || mp.codigo,
  };
}

export async function resolverOuCriarInsumosEmLote(
  insumos: (InsumoBruto & { mp_id?: string })[]
): Promise<{ resolvidos: InsumoResolvido[]; criadosMP: number; criadosFornecedor: number }> {
  let criadosMP = 0;
  let criadosFornecedor = 0;
  const resolvidos: InsumoResolvido[] = [];

  for (const i of insumos) {
    if (i.mp_id) {
      resolvidos.push(i as InsumoResolvido);
      continue;
    }
    const antes = await supabase
      .from("fabrica_materias_primas")
      .select("id", { count: "exact", head: true });
    const antesForn = await supabase
      .from("fabrica_fornecedores")
      .select("id", { count: "exact", head: true });

    const resolvido = await resolverOuCriarInsumo(i);
    resolvidos.push(resolvido);

    const depois = await supabase
      .from("fabrica_materias_primas")
      .select("id", { count: "exact", head: true });
    const depoisForn = await supabase
      .from("fabrica_fornecedores")
      .select("id", { count: "exact", head: true });

    if ((depois.count ?? 0) > (antes.count ?? 0)) criadosMP++;
    if ((depoisForn.count ?? 0) > (antesForn.count ?? 0)) criadosFornecedor++;
  }

  return { resolvidos, criadosMP, criadosFornecedor };
}

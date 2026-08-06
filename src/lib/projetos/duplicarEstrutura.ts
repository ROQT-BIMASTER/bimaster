/**
 * Duplicação de SEÇÕES e PROJETOS inteiros, replicando as atribuições.
 *
 * Regras:
 * - Tarefas são copiadas com título original (sem sufixo "(cópia)"), pois o
 *   contexto de cópia já está no nome da seção/projeto novo.
 * - Copia hierarquia (subtarefas), tags, responsável principal e a junction
 *   `projeto_tarefa_responsaveis` (equipe da tarefa).
 * - Não copia anexos, comentários, histórico nem aprovações.
 */

import { supabase } from "@/integrations/supabase/client";
import { copiarResponsaveis } from "@/lib/tarefas/duplicarTarefa";

const TAREFA_FIELDS =
  "id, titulo, descricao, prioridade, tipo_tarefa, estagio, visibilidade, data_prazo, data_inicio_planejada, responsavel_id, parent_tarefa_id, ordem, status";

async function copiarTags(idMap: Map<string, string>): Promise<void> {
  const origens = Array.from(idMap.keys());
  if (!origens.length) return;
  const { data } = await supabase
    .from("projeto_tarefa_tags")
    .select("tarefa_id, tag_id")
    .in("tarefa_id", origens);
  const rows = (data || [])
    .map((r: any) => {
      const novo = idMap.get(r.tarefa_id);
      return novo ? { tarefa_id: novo, tag_id: r.tag_id } : null;
    })
    .filter(Boolean) as any[];
  if (rows.length) await supabase.from("projeto_tarefa_tags").insert(rows);
}

/** Clona todas as tarefas de uma seção para outra (mantendo hierarquia). */
export async function clonarTarefasDaSecao(params: {
  secaoOrigemId: string;
  secaoDestinoId: string;
  projetoDestinoId: string;
  criadorId: string;
}): Promise<any[]> {
  const { secaoOrigemId, secaoDestinoId, projetoDestinoId, criadorId } = params;

  const { data, error } = await supabase
    .from("projeto_tarefas")
    .select(TAREFA_FIELDS)
    .eq("secao_id", secaoOrigemId)
    .is("deleted_at", null)
    .is("excluida_em", null)
    .order("ordem", { ascending: true });
  if (error) throw error;

  const origem = (data || []) as any[];
  if (!origem.length) return [];

  const porParent = new Map<string | null, any[]>();
  const ids = new Set(origem.map((t) => t.id));
  for (const t of origem) {
    // Se o pai não pertence à seção, trata como raiz.
    const parent = t.parent_tarefa_id && ids.has(t.parent_tarefa_id) ? t.parent_tarefa_id : null;
    const arr = porParent.get(parent) || [];
    arr.push(t);
    porParent.set(parent, arr);
  }

  const idMap = new Map<string, string>();
  const criadas: any[] = [];

  const inserirNivel = async (parentOrigem: string | null) => {
    const filhos = porParent.get(parentOrigem) || [];
    if (!filhos.length) return;
    const novoParent = parentOrigem ? idMap.get(parentOrigem) ?? null : null;
    const inserts = filhos.map((t, idx) => ({
      projeto_id: projetoDestinoId,
      secao_id: secaoDestinoId,
      parent_tarefa_id: novoParent,
      titulo: t.titulo,
      descricao: t.descricao,
      prioridade: t.prioridade || "media",
      tipo_tarefa: t.tipo_tarefa,
      estagio: t.estagio,
      visibilidade: t.visibilidade || "publica",
      data_prazo: t.data_prazo,
      data_inicio_planejada: t.data_inicio_planejada ?? null,
      responsavel_id: t.responsavel_id ?? null,
      ordem: t.ordem ?? idx,
      status: "pendente",
      criador_id: criadorId,
    }));
    const { data: inseridas, error: insErr } = await supabase
      .from("projeto_tarefas")
      .insert(inserts)
      .select("*");
    if (insErr) throw insErr;
    (inseridas || []).forEach((row: any, idx: number) => {
      idMap.set(filhos[idx].id, row.id);
      criadas.push(row);
    });
    for (const f of filhos) await inserirNivel(f.id);
  };

  await inserirNivel(null);
  await copiarTags(idMap);
  await copiarResponsaveis(idMap, criadorId);

  return criadas;
}

/** Duplica uma seção dentro do mesmo projeto. */
export async function duplicarSecao(params: {
  secaoId: string;
  projetoId: string;
  criadorId: string;
}): Promise<{ secaoId: string; rows: any[] }> {
  const { secaoId, projetoId, criadorId } = params;

  const { data: secao, error } = await supabase
    .from("projeto_secoes")
    .select("*")
    .eq("id", secaoId)
    .single();
  if (error || !secao) throw error || new Error("Seção não encontrada");

  const { count } = await supabase
    .from("projeto_secoes")
    .select("id", { count: "exact", head: true })
    .eq("projeto_id", projetoId);

  const { data: nova, error: novaErr } = await supabase
    .from("projeto_secoes")
    .insert({
      projeto_id: projetoId,
      nome: `${secao.nome} (cópia)`,
      ordem: count ?? 0,
      data_inicio: secao.data_inicio,
      data_prazo: secao.data_prazo,
      dias_alerta_antes: secao.dias_alerta_antes,
      tem_briefing: false,
    })
    .select("*")
    .single();
  if (novaErr || !nova) throw novaErr || new Error("Falha ao duplicar seção");

  const rows = await clonarTarefasDaSecao({
    secaoOrigemId: secaoId,
    secaoDestinoId: nova.id,
    projetoDestinoId: projetoId,
    criadorId,
  });

  return { secaoId: nova.id, rows };
}

/** Duplica um projeto completo: seções, tarefas, atribuições e equipe. */
export async function duplicarProjeto(params: {
  projetoId: string;
  criadorId: string;
  novoNome?: string;
  copiarEquipe?: boolean;
}): Promise<{ projetoId: string }> {
  const { projetoId, criadorId, novoNome, copiarEquipe = true } = params;

  const { data: projeto, error } = await supabase
    .from("projetos")
    .select("*")
    .eq("id", projetoId)
    .single();
  if (error || !projeto) throw error || new Error("Projeto não encontrado");

  const insert: Record<string, any> = {
    nome: novoNome?.trim() || `${projeto.nome} (cópia)`,
    descricao: projeto.descricao,
    cor: projeto.cor,
    bg_cor: projeto.bg_cor,
    icone: projeto.icone,
    imagem_url: projeto.imagem_url,
    tipo: projeto.tipo,
    status: projeto.status,
    marca: projeto.marca,
    categoria_linha: projeto.categoria_linha,
    departamento_id: projeto.departamento_id,
    data_inicio: projeto.data_inicio,
    data_fim_alvo: projeto.data_fim_alvo,
    regime_calendario: projeto.regime_calendario,
    usa_feriados: projeto.usa_feriados,
    uf_feriados: projeto.uf_feriados,
    prazo_padrao_tarefa: projeto.prazo_padrao_tarefa,
    alerta_antecipacao_dias: projeto.alerta_antecipacao_dias,
    tipo_operacional: projeto.tipo_operacional,
    criador_id: criadorId,
  };

  const { data: novo, error: novoErr } = await supabase
    .from("projetos")
    .insert(insert)
    .select("id")
    .single();
  if (novoErr || !novo) throw novoErr || new Error("Falha ao duplicar projeto");

  if (copiarEquipe) {
    const { data: membros } = await supabase
      .from("projeto_membros")
      .select("user_id, papel")
      .eq("projeto_id", projetoId);
    const rows = (membros || []).map((m: any) => ({
      projeto_id: novo.id,
      user_id: m.user_id,
      papel: m.papel,
    }));
    if (rows.length) {
      await supabase
        .from("projeto_membros")
        .upsert(rows, { onConflict: "projeto_id,user_id", ignoreDuplicates: true });
    }
  }

  const { data: secoes } = await supabase
    .from("projeto_secoes")
    .select("*")
    .eq("projeto_id", projetoId)
    .order("ordem", { ascending: true });

  for (const [idx, s] of (secoes || []).entries()) {
    const { data: novaSecao } = await supabase
      .from("projeto_secoes")
      .insert({
        projeto_id: novo.id,
        nome: s.nome,
        ordem: s.ordem ?? idx,
        data_inicio: s.data_inicio,
        data_prazo: s.data_prazo,
        dias_alerta_antes: s.dias_alerta_antes,
        tem_briefing: false,
      })
      .select("id")
      .single();
    if (!novaSecao) continue;
    await clonarTarefasDaSecao({
      secaoOrigemId: s.id,
      secaoDestinoId: novaSecao.id,
      projetoDestinoId: novo.id,
      criadorId,
    });
  }

  return { projetoId: novo.id };
}

/**
 * Duplicação de tarefas + aplicação de modelos.
 *
 * Estratégia: inserts diretos no Supabase (não via `createTarefa.mutateAsync`)
 * porque precisamos preservar campos que a mutation não aceita (descricao,
 * prioridade, data_prazo, tipo_tarefa, etc.). Realtime pega os inserts e
 * reconcilia a lista sem duplicar linhas — `pendingCreatesRef` só existe
 * para linhas criadas via `createTarefa` (echo de otimista); aqui não há
 * otimismo e o eco de realtime é o mecanismo natural.
 *
 * Referências `sb-storage://` na descricao são copiadas verbatim; o
 * `resolveStorageRef` já existente resolve no render.
 */

import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { addDays, differenceInCalendarDays, format } from "date-fns";

export type TarefaNodeTemplate = {
  titulo: string;
  descricao: string | null;
  prioridade: string | null;
  tipo_tarefa: string | null;
  estagio: string | null;
  visibilidade: string | null;
  /** Dias entre criação e prazo (para aplicar modelo). */
  prazo_dias: number | null;
  tags: string[];
  children: TarefaNodeTemplate[];
};

export type TarefaModeloPayload = {
  version: 1;
  root: TarefaNodeTemplate;
};

const SP_TZ = "America/Sao_Paulo";

/** Converte data_prazo ISO em prazo_dias relativo ao "hoje" em SP. */
function toPrazoDias(dataPrazo: string | null | undefined): number | null {
  if (!dataPrazo) return null;
  const prazo = parseLocalDate(dataPrazo);
  if (!prazo) return null;
  const hojeSp = new Date(new Date().toLocaleString("en-US", { timeZone: SP_TZ }));
  hojeSp.setHours(0, 0, 0, 0);
  return Math.max(0, differenceInCalendarDays(prazo, hojeSp));
}

async function fetchProjetoTagIdsByName(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const clean = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (clean.length === 0) return map;
  const { data } = await supabase
    .from("projeto_tags")
    .select("id, nome")
    .in("nome", clean);
  (data || []).forEach((row: any) => map.set(String(row.nome).trim(), row.id));
  return map;
}

async function fetchTagNamesForTarefa(tarefaId: string): Promise<string[]> {
  const { data } = await supabase
    .from("projeto_tarefa_tags")
    .select("projeto_tags!inner(nome)")
    .eq("tarefa_id", tarefaId);
  return (data || [])
    .map((r: any) => r.projeto_tags?.nome)
    .filter((n: any): n is string => typeof n === "string" && n.trim().length > 0);
}

async function fetchDescendantsRecursive(rootId: string): Promise<Map<string, any[]>> {
  // Map parent_tarefa_id -> children (só campos relevantes para clonar).
  const byParent = new Map<string, any[]>();
  const queue = [rootId];
  while (queue.length) {
    const parentId = queue.shift()!;
    const { data, error } = await supabase
      .from("projeto_tarefas")
      .select("id, titulo, descricao, prioridade, tipo_tarefa, estagio, visibilidade, data_prazo, ordem, secao_id, projeto_id")
      .eq("parent_tarefa_id", parentId)
      .is("deleted_at", null)
      .is("excluida_em", null)
      .order("ordem", { ascending: true });
    if (error) throw error;
    const children = data || [];
    if (children.length) {
      byParent.set(parentId, children);
      children.forEach((c: any) => queue.push(c.id));
    }
  }
  return byParent;
}

/**
 * Duplica uma tarefa (com subtarefas + tags) dentro do mesmo projeto/seção.
 */
export async function duplicarTarefa(params: {
  tarefaId: string;
  projetoId: string;
  secaoId: string;
  criadorId: string;
  parentTarefaId?: string | null;
}): Promise<string> {
  const { tarefaId, projetoId, secaoId, criadorId, parentTarefaId = null } = params;

  const { data: source, error: srcErr } = await supabase
    .from("projeto_tarefas")
    .select("id, titulo, descricao, prioridade, tipo_tarefa, estagio, visibilidade, data_prazo, secao_id, projeto_id")
    .eq("id", tarefaId)
    .single();
  if (srcErr || !source) throw srcErr || new Error("Tarefa não encontrada");

  // Ordem: no final da seção destino.
  const ordemQuery = supabase
    .from("projeto_tarefas")
    .select("id", { count: "exact", head: true })
    .eq("secao_id", secaoId);
  const { count } = parentTarefaId
    ? await ordemQuery.eq("parent_tarefa_id", parentTarefaId)
    : await ordemQuery.is("parent_tarefa_id", null);
  const baseOrdem = count ?? 0;

  const rootInsert = {
    projeto_id: projetoId,
    secao_id: secaoId,
    parent_tarefa_id: parentTarefaId,
    titulo: `${source.titulo} (cópia)`,
    descricao: source.descricao,
    prioridade: source.prioridade || "media",
    tipo_tarefa: source.tipo_tarefa,
    estagio: source.estagio,
    visibilidade: source.visibilidade || "publica",
    data_prazo: source.data_prazo,
    ordem: baseOrdem,
    status: "pendente",
    criador_id: criadorId,
  };
  const { data: rootNew, error: rootErr } = await supabase
    .from("projeto_tarefas")
    .insert(rootInsert)
    .select("id")
    .single();
  if (rootErr || !rootNew) throw rootErr || new Error("Falha ao duplicar tarefa");

  // Tags da raiz.
  const rootTagNames = await fetchTagNamesForTarefa(tarefaId);
  if (rootTagNames.length) {
    const tagMap = await fetchProjetoTagIdsByName(rootTagNames);
    const rows = Array.from(tagMap.values()).map((tag_id) => ({ tarefa_id: rootNew.id, tag_id }));
    if (rows.length) await supabase.from("projeto_tarefa_tags").insert(rows);
  }

  // Subtarefas recursivas, nível a nível.
  const descendants = await fetchDescendantsRecursive(tarefaId);
  const idMap = new Map<string, string>();
  idMap.set(tarefaId, rootNew.id);

  const process = async (oldParent: string) => {
    const children = descendants.get(oldParent);
    if (!children || !children.length) return;
    const newParent = idMap.get(oldParent)!;
    // Insere irmãs em paralelo mas serializa entre níveis.
    const inserts = children.map((c, idx) => ({
      projeto_id: projetoId,
      secao_id: secaoId,
      parent_tarefa_id: newParent,
      titulo: c.titulo,
      descricao: c.descricao,
      prioridade: c.prioridade || "media",
      tipo_tarefa: c.tipo_tarefa,
      estagio: c.estagio,
      visibilidade: c.visibilidade || "publica",
      data_prazo: c.data_prazo,
      ordem: idx,
      status: "pendente",
      criador_id: criadorId,
    }));
    const { data: inserted, error } = await supabase
      .from("projeto_tarefas")
      .insert(inserts)
      .select("id");
    if (error) throw error;
    (inserted || []).forEach((row: any, idx) => idMap.set(children[idx].id, row.id));

    // Tags das filhas em paralelo.
    await Promise.all(
      children.map(async (c: any, idx: number) => {
        const names = await fetchTagNamesForTarefa(c.id);
        if (!names.length) return;
        const tagMap = await fetchProjetoTagIdsByName(names);
        const rows = Array.from(tagMap.values()).map((tag_id) => ({
          tarefa_id: (inserted as any[])[idx].id,
          tag_id,
        }));
        if (rows.length) await supabase.from("projeto_tarefa_tags").insert(rows);
      }),
    );

    // Próximo nível.
    for (const c of children) await process(c.id);
  };
  await process(tarefaId);

  return rootNew.id;
}

/** Captura o subtree da tarefa como payload de modelo (sem responsáveis/anexos/comentários/seguidores). */
export async function capturarTarefaComoModelo(tarefaId: string): Promise<TarefaModeloPayload> {
  const { data: root, error } = await supabase
    .from("projeto_tarefas")
    .select("id, titulo, descricao, prioridade, tipo_tarefa, estagio, visibilidade, data_prazo")
    .eq("id", tarefaId)
    .single();
  if (error || !root) throw error || new Error("Tarefa não encontrada");

  const descendants = await fetchDescendantsRecursive(tarefaId);

  const buildNode = async (row: any): Promise<TarefaNodeTemplate> => {
    const tags = await fetchTagNamesForTarefa(row.id);
    const kids = descendants.get(row.id) || [];
    const children: TarefaNodeTemplate[] = [];
    for (const k of kids) children.push(await buildNode(k));
    return {
      titulo: row.titulo,
      descricao: row.descricao ?? null,
      prioridade: row.prioridade ?? null,
      tipo_tarefa: row.tipo_tarefa ?? null,
      estagio: row.estagio ?? null,
      visibilidade: row.visibilidade ?? null,
      prazo_dias: toPrazoDias(row.data_prazo),
      tags,
      children,
    };
  };

  return { version: 1, root: await buildNode(root) };
}

/** Aplica um modelo criando a árvore de tarefas na seção destino. */
export async function aplicarTarefaModelo(params: {
  payload: TarefaModeloPayload;
  projetoId: string;
  secaoId: string;
  criadorId: string;
  parentTarefaId?: string | null;
}): Promise<string> {
  const { payload, projetoId, secaoId, criadorId, parentTarefaId = null } = params;
  if (!payload?.root) throw new Error("Modelo inválido");

  const hojeSp = new Date(new Date().toLocaleString("en-US", { timeZone: SP_TZ }));
  hojeSp.setHours(0, 0, 0, 0);
  const prazoOf = (dias: number | null | undefined): string | null =>
    typeof dias === "number" && dias >= 0 ? format(addDays(hojeSp, dias), "yyyy-MM-dd") : null;

  const ordemQuery = supabase
    .from("projeto_tarefas")
    .select("id", { count: "exact", head: true })
    .eq("secao_id", secaoId);
  const { count } = parentTarefaId
    ? await ordemQuery.eq("parent_tarefa_id", parentTarefaId)
    : await ordemQuery.is("parent_tarefa_id", null);
  const baseOrdem = count ?? 0;

  const insertNode = async (
    node: TarefaNodeTemplate,
    parent: string | null,
    ordem: number,
  ): Promise<string> => {
    const { data, error } = await supabase
      .from("projeto_tarefas")
      .insert({
        projeto_id: projetoId,
        secao_id: secaoId,
        parent_tarefa_id: parent,
        titulo: node.titulo,
        descricao: node.descricao,
        prioridade: node.prioridade || "media",
        tipo_tarefa: node.tipo_tarefa,
        estagio: node.estagio,
        visibilidade: node.visibilidade || "publica",
        data_prazo: prazoOf(node.prazo_dias),
        ordem,
        status: "pendente",
        criador_id: criadorId,
      })
      .select("id")
      .single();
    if (error || !data) throw error || new Error("Falha ao aplicar modelo");

    if (node.tags?.length) {
      const tagMap = await fetchProjetoTagIdsByName(node.tags);
      const rows = Array.from(tagMap.values()).map((tag_id) => ({ tarefa_id: data.id, tag_id }));
      if (rows.length) await supabase.from("projeto_tarefa_tags").insert(rows);
    }

    for (let i = 0; i < node.children.length; i++) {
      await insertNode(node.children[i], data.id, i);
    }
    return data.id;
  };

  return insertNode(payload.root, parentTarefaId, baseOrdem);
}

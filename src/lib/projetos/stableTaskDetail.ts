import type { ProjetoTarefa } from "@/hooks/useProjetoTarefas";

const pessoaSig = (p: { user_id?: string; id?: string; nome?: string | null; avatar_url?: string | null; papel?: string | null }) =>
  `${p.user_id ?? p.id ?? ""}:${p.nome ?? ""}:${p.avatar_url ?? ""}:${p.papel ?? ""}`;

export function buildTarefaDetalheSnapshot(
  tarefaId: string | null | undefined,
  tarefas: ProjetoTarefa[],
): ProjetoTarefa | null {
  if (!tarefaId) return null;
  const found = tarefas.find((t) => t.id === tarefaId);
  if (!found) return null;

  const buildSubtree = (parentId: string): ProjetoTarefa[] =>
    tarefas
      .filter((st) => st.parent_tarefa_id === parentId)
      .map((st) => ({ ...st, subtarefas: buildSubtree(st.id) }));

  return { ...found, subtarefas: buildSubtree(found.id) } as ProjetoTarefa;
}

export function tarefaDetalheSignature(tarefa: ProjetoTarefa | null | undefined): string {
  if (!tarefa) return "";
  const responsaveis = (tarefa.responsaveis ?? []).map(pessoaSig).sort().join(",");
  const colaboradores = (tarefa.colaboradores ?? []).map(pessoaSig).sort().join(",");
  const responsavel = tarefa.responsavel ? pessoaSig(tarefa.responsavel) : "";
  const children = (tarefa.subtarefas ?? []).map(tarefaDetalheSignature).join(";");
  return [
    (tarefa as any).__clientKey || tarefa.id,
    tarefa.id,
    tarefa.updated_at,
    tarefa.titulo,
    tarefa.descricao ?? "",
    tarefa.status,
    tarefa.prioridade,
    tarefa.estagio ?? "",
    tarefa.secao_id,
    tarefa.responsavel_id ?? "",
    responsavel,
    responsaveis,
    colaboradores,
    tarefa.data_prazo ?? "",
    (tarefa as any).data_inicio_planejada ?? "",
    (tarefa as any).data_inicio_real ?? "",
    (tarefa as any).data_proxima_acao ?? "",
    (tarefa as any).dias_alerta_antes ?? "",
    tarefa.produto_id ?? "",
    children,
  ].join("|");
}

function mergePessoaList<T extends { user_id: string; nome: string; avatar_url: string | null }>(
  previous: T[] | undefined,
  next: T[] | undefined,
): T[] | undefined {
  if (!next) return next;
  if (!previous?.length) return next;
  let changed = previous.length !== next.length;
  const previousById = new Map(previous.map((p) => [p.user_id, p]));
  const merged = next.map((item) => {
    const old = previousById.get(item.user_id);
    if (
      old &&
      old.nome === item.nome &&
      old.avatar_url === item.avatar_url &&
      (old as any).papel === (item as any).papel
    ) {
      return old;
    }
    changed = true;
    return item;
  });
  if (!changed && previous.length === merged.length) return previous;
  return merged;
}

function mergeSubtarefas(previous: ProjetoTarefa[] | undefined, next: ProjetoTarefa[] | undefined): ProjetoTarefa[] | undefined {
  if (!next) return next;
  if (!previous?.length) return next;
  let changed = previous.length !== next.length;
  const previousById = new Map(previous.map((st) => [st.id, st]));
  const merged = next.map((item) => {
    const old = previousById.get(item.id);
    const mergedItem = old ? mergeTarefaDetalheSnapshot(old, item) ?? item : item;
    if (mergedItem !== old) changed = true;
    return mergedItem;
  });
  if (!changed && previous.length === merged.length) return previous;
  return merged;
}

export function mergeTarefaDetalheSnapshot(
  previous: ProjetoTarefa | null,
  next: ProjetoTarefa | null,
): ProjetoTarefa | null {
  if (!next) return previous;
  if (!previous || previous.id !== next.id) return next;

  const merged: ProjetoTarefa = {
    ...next,
    responsavel:
      previous.responsavel &&
      next.responsavel &&
      previous.responsavel.id === next.responsavel.id &&
      previous.responsavel.nome === next.responsavel.nome &&
      previous.responsavel.avatar_url === next.responsavel.avatar_url
        ? previous.responsavel
        : next.responsavel,
    responsaveis: mergePessoaList(previous.responsaveis, next.responsaveis) as ProjetoTarefa["responsaveis"],
    colaboradores: mergePessoaList(previous.colaboradores, next.colaboradores) as ProjetoTarefa["colaboradores"],
    subtarefas: mergeSubtarefas(previous.subtarefas, next.subtarefas),
  };

  return tarefaDetalheSignature(previous) === tarefaDetalheSignature(merged) ? previous : merged;
}

export function patchTarefaInDetailTree(
  root: ProjetoTarefa | null,
  tarefaId: string,
  updates: Partial<ProjetoTarefa>,
): ProjetoTarefa | null {
  if (!root) return root;
  if (root.id === tarefaId) return { ...root, ...updates } as ProjetoTarefa;

  const children = root.subtarefas ?? [];
  let changed = false;
  const nextChildren = children.map((child) => {
    const patched = patchTarefaInDetailTree(child, tarefaId, updates);
    if (patched !== child) changed = true;
    return patched ?? child;
  });

  return changed ? ({ ...root, subtarefas: nextChildren } as ProjetoTarefa) : root;
}
/**
 * Merges idempotentes para coleções aninhadas em uma tarefa
 * (responsáveis, seguidores, anexos, checklist, comentários).
 *
 * Objetivo: quando dois usuários mexem em partes diferentes da mesma
 * tarefa, o Realtime não deve substituir a coleção inteira e apagar o
 * trabalho concorrente. A união é feita por `id`, com desempate por
 * `updated_at` (fallback `created_at`). Itens marcados como `__pending`
 * (otimistas ainda não confirmados) são preservados até que o servidor
 * confirme com o mesmo `id`.
 *
 * Todos os merges são puros e sem efeitos colaterais.
 */

export interface ColecaoItem {
  id: string;
  updated_at?: string | null;
  created_at?: string | null;
  /** Marcador cliente: item ainda não confirmado pelo servidor. */
  __pending?: boolean;
}

function pickMoreRecent<T extends ColecaoItem>(a: T, b: T): T {
  const ta = a.updated_at ?? a.created_at ?? "";
  const tb = b.updated_at ?? b.created_at ?? "";
  if (tb > ta) return b;
  return a;
}

/**
 * Merge por id. Comportamento:
 *  - itens `__pending` do local que não têm par no remoto são preservados;
 *  - itens presentes nos dois lados: vence o mais recente por updated_at;
 *  - itens só no remoto: incluídos.
 *
 * Preserva a ordem: primeiro na ordem do remoto (fonte da verdade), depois
 * os pendentes locais que não têm par (ao fim, mais recente primeiro).
 */
export function mergeById<T extends ColecaoItem>(
  local: readonly T[] | null | undefined,
  remote: readonly T[] | null | undefined,
): T[] {
  const localArr = local ?? [];
  const remoteArr = remote ?? [];
  const localById = new Map<string, T>();
  for (const item of localArr) localById.set(item.id, item);

  const out: T[] = [];
  const seen = new Set<string>();

  for (const r of remoteArr) {
    const l = localById.get(r.id);
    if (l) {
      // Se o local está pendente e ainda não tem timestamp remoto que o
      // supere, mantém o local para não regredir a UI antes do commit.
      if (l.__pending && !r.updated_at) {
        out.push(l);
      } else {
        out.push(pickMoreRecent(l, r));
      }
    } else {
      out.push(r);
    }
    seen.add(r.id);
  }

  // Pendentes locais sem par remoto: preserva ao fim
  const pendings = localArr.filter((l) => l.__pending && !seen.has(l.id));
  pendings.sort((a, b) => {
    const ta = a.updated_at ?? a.created_at ?? "";
    const tb = b.updated_at ?? b.created_at ?? "";
    return tb.localeCompare(ta);
  });
  out.push(...pendings);

  return out;
}

// Wrappers nomeados — fachada estável para uso no reducer/hooks
export const mergeResponsaveis = mergeById;
export const mergeSeguidores = mergeById;
export const mergeAnexos = mergeById;
export const mergeChecklist = mergeById;
export const mergeComentarios = mergeById;

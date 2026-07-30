/**
 * Ordenação por data dos documentos da submissão China.
 *
 * - "atualizacao": última atualização conhecida do documento
 *   (assinatura / oficialização / criação do registro), mais recente primeiro.
 * - "proxima_acao": previsão de envio (próxima ação), mais próxima primeiro;
 *   documentos sem previsão vão para o fim.
 */
export type DocSortKey = "none" | "atualizacao" | "proxima_acao";

export const DOC_SORT_LABEL: Record<DocSortKey, string> = {
  none: "Ordem padrão",
  atualizacao: "Última atualização",
  proxima_acao: "Próxima ação",
};

export interface DocDatas {
  created_at?: string | null;
  oficializado_em?: string | null;
  assinado_em?: string | null;
  previsao_envio?: string | null;
}

function ts(value?: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Data da última atualização conhecida (epoch ms) ou null. */
export function ultimaAtualizacao(d: DocDatas): number | null {
  const candidatos = [ts(d.assinado_em), ts(d.oficializado_em), ts(d.created_at)].filter(
    (v): v is number => v !== null,
  );
  return candidatos.length > 0 ? Math.max(...candidatos) : null;
}

/** Data da próxima ação (previsão de envio, epoch ms) ou null. */
export function proximaAcao(d: DocDatas): number | null {
  return ts(d.previsao_envio);
}

/** Comparador estável para as chaves de ordenação suportadas. */
export function compararDocs(key: DocSortKey, a: DocDatas, b: DocDatas): number {
  if (key === "atualizacao") {
    const va = ultimaAtualizacao(a);
    const vb = ultimaAtualizacao(b);
    if (va === vb) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va; // mais recente primeiro
  }
  if (key === "proxima_acao") {
    const va = proximaAcao(a);
    const vb = proximaAcao(b);
    if (va === vb) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return va - vb; // mais próxima primeiro
  }
  return 0;
}

/** Ordena uma lista sem mutar o array original. */
export function ordenarDocs<T extends DocDatas>(lista: T[], key: DocSortKey): T[] {
  if (key === "none") return lista;
  return [...lista].sort((a, b) => compararDocs(key, a, b));
}

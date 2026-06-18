import { useCallback, useEffect, useMemo, useState } from "react";

export type AnexoFilter = "all" | "with" | "without";
export type BucketFilter = "pendente" | "enviado" | "em_analise" | "aprovado" | "rejeitado";

export interface ChinaKanbanFilters {
  /** Submissões selecionadas (vazio = todas). Não persistido entre reloads. */
  submissaoIds: string[];
  /** Filtro por estado do anexo. Persistido. */
  anexo: AnexoFilter;
  /** Buckets habilitados (vazio = todos). Persistido. */
  buckets: BucketFilter[];
}

const ALL_BUCKETS: BucketFilter[] = ["pendente", "enviado", "em_analise", "aprovado", "rejeitado"];

interface PersistedShape {
  anexo: AnexoFilter;
  buckets: BucketFilter[];
}

function readPersisted(key: string): PersistedShape {
  if (typeof window === "undefined") return { anexo: "all", buckets: ALL_BUCKETS };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { anexo: "all", buckets: ALL_BUCKETS };
    const v = JSON.parse(raw) as Partial<PersistedShape>;
    const anexo: AnexoFilter = v.anexo === "with" || v.anexo === "without" ? v.anexo : "all";
    const buckets: BucketFilter[] =
      Array.isArray(v.buckets) && v.buckets.length > 0
        ? v.buckets.filter((b): b is BucketFilter => ALL_BUCKETS.includes(b as BucketFilter))
        : ALL_BUCKETS;
    return { anexo, buckets };
  } catch {
    return { anexo: "all", buckets: ALL_BUCKETS };
  }
}

export function useChinaKanbanFilters(perspective: "china" | "brasil") {
  const storageKey = `china.kanban.filters.${perspective}`;

  const [submissaoIds, setSubmissaoIds] = useState<string[]>([]);
  const [persisted, setPersisted] = useState<PersistedShape>(() => readPersisted(storageKey));

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(persisted));
  }, [persisted, storageKey]);

  // Trocou perspectiva → re-lê persistência
  useEffect(() => {
    setPersisted(readPersisted(storageKey));
    setSubmissaoIds([]);
  }, [storageKey]);

  const setAnexo = useCallback((a: AnexoFilter) => {
    setPersisted((p) => ({ ...p, anexo: a }));
  }, []);

  const toggleBucket = useCallback((b: BucketFilter) => {
    setPersisted((p) => {
      const next = p.buckets.includes(b)
        ? p.buckets.filter((x) => x !== b)
        : [...p.buckets, b];
      // Nunca deixa vazio: vazio é confuso pro usuário; volta a todos.
      return { ...p, buckets: next.length === 0 ? ALL_BUCKETS : next };
    });
  }, []);

  const toggleSubmissao = useCallback((id: string) => {
    setSubmissaoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clearSubmissoes = useCallback(() => setSubmissaoIds([]), []);

  const clearAll = useCallback(() => {
    setSubmissaoIds([]);
    setPersisted({ anexo: "all", buckets: ALL_BUCKETS });
  }, []);

  const filters: ChinaKanbanFilters = useMemo(
    () => ({ submissaoIds, anexo: persisted.anexo, buckets: persisted.buckets }),
    [submissaoIds, persisted.anexo, persisted.buckets],
  );

  const isActive = useMemo(
    () =>
      submissaoIds.length > 0 ||
      persisted.anexo !== "all" ||
      persisted.buckets.length !== ALL_BUCKETS.length,
    [submissaoIds, persisted.anexo, persisted.buckets],
  );

  return {
    filters,
    isActive,
    setAnexo,
    toggleBucket,
    toggleSubmissao,
    setSubmissoes: setSubmissaoIds,
    clearSubmissoes,
    clearAll,
    ALL_BUCKETS,
  };
}

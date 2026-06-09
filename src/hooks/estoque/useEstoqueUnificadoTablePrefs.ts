import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type EstoqueUnifColId =
  | 'empresa'
  | 'produto_raiz'
  | 'ean_raiz'
  | 'saldo_em_caixas'
  | 'saldo_em_displays'
  | 'saldo_em_unidades'
  | 'saldo_total_em_unidades'
  | 'bloqueado_total_em_unidades'
  | 'disponivel_total_em_unidades'
  | 'pendente_total_em_unidades'
  | 'pedidos_count'
  | 'em_cx'
  | 'skus_envolvidos';

export const ESTOQUE_UNIF_COLUMNS: { id: EstoqueUnifColId; label: string; hideable: boolean }[] = [
  { id: 'empresa', label: 'Empresa', hideable: true },
  { id: 'produto_raiz', label: 'Produto-raiz', hideable: false },
  { id: 'ean_raiz', label: 'EAN raiz', hideable: true },
  { id: 'saldo_em_caixas', label: 'Caixas', hideable: true },
  { id: 'saldo_em_displays', label: 'Displays', hideable: true },
  { id: 'saldo_em_unidades', label: 'Unidades', hideable: true },
  { id: 'saldo_total_em_unidades', label: '≡ Total em UN', hideable: true },
  { id: 'bloqueado_total_em_unidades', label: 'Bloqueado', hideable: true },
  { id: 'disponivel_total_em_unidades', label: 'Disponível', hideable: true },
  { id: 'pendente_total_em_unidades', label: 'Pendente', hideable: true },
  { id: 'pedidos_count', label: 'Pedidos', hideable: true },
  { id: 'em_cx', label: '≡ em CX', hideable: true },
  { id: 'skus_envolvidos', label: 'SKUs', hideable: true },
];

// Chaves de ordenação que o backend suporta nativamente (passadas para o hook).
export const BACKEND_SORT_KEYS = new Set<EstoqueUnifColId>([
  'saldo_em_caixas',
  'saldo_em_displays',
  'saldo_em_unidades',
  'saldo_total_em_unidades',
  'pedidos_count',
]);

const DEFAULT_HIDDEN: EstoqueUnifColId[] = [];
const DEFAULT_SORT_BY: EstoqueUnifColId = 'saldo_total_em_unidades';
const DEFAULT_SORT_DIR: 'asc' | 'desc' = 'desc';

interface Prefs {
  hidden: EstoqueUnifColId[];
  sortBy: EstoqueUnifColId;
  sortDir: 'asc' | 'desc';
}

function storageKey(uid: string | null | undefined) {
  return `estoque-unificado-table-prefs:${uid ?? 'anon'}`;
}

function readPrefs(uid: string | null | undefined): Prefs {
  if (typeof window === 'undefined') {
    return { hidden: DEFAULT_HIDDEN, sortBy: DEFAULT_SORT_BY, sortDir: DEFAULT_SORT_DIR };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return { hidden: DEFAULT_HIDDEN, sortBy: DEFAULT_SORT_BY, sortDir: DEFAULT_SORT_DIR };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      hidden: Array.isArray(parsed.hidden) ? (parsed.hidden as EstoqueUnifColId[]) : DEFAULT_HIDDEN,
      sortBy: (parsed.sortBy as EstoqueUnifColId) ?? DEFAULT_SORT_BY,
      sortDir: parsed.sortDir === 'asc' ? 'asc' : 'desc',
    };
  } catch {
    return { hidden: DEFAULT_HIDDEN, sortBy: DEFAULT_SORT_BY, sortDir: DEFAULT_SORT_DIR };
  }
}

export function useEstoqueUnificadoTablePrefs() {
  const { user } = useAuth();
  const uid = user?.id ?? null;

  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs(uid));

  // Re-load if user changes
  useEffect(() => {
    setPrefs(readPrefs(uid));
  }, [uid]);

  // Persist
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey(uid), JSON.stringify(prefs));
    } catch {
      /* noop */
    }
  }, [prefs, uid]);

  const hiddenSet = useMemo(() => new Set(prefs.hidden), [prefs.hidden]);

  const isHidden = useCallback((id: EstoqueUnifColId) => hiddenSet.has(id), [hiddenSet]);

  const toggle = useCallback((id: EstoqueUnifColId) => {
    setPrefs((prev) => {
      const exists = prev.hidden.includes(id);
      return { ...prev, hidden: exists ? prev.hidden.filter((x) => x !== id) : [...prev.hidden, id] };
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs({ hidden: DEFAULT_HIDDEN, sortBy: DEFAULT_SORT_BY, sortDir: DEFAULT_SORT_DIR });
  }, []);

  const setSort = useCallback((id: EstoqueUnifColId) => {
    setPrefs((prev) =>
      prev.sortBy === id
        ? { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc' }
        : { ...prev, sortBy: id, sortDir: 'desc' },
    );
  }, []);

  return {
    hidden: prefs.hidden,
    isHidden,
    toggle,
    reset,
    sortBy: prefs.sortBy,
    sortDir: prefs.sortDir,
    setSort,
  };
}

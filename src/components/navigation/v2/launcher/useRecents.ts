/**
 * Hook de "Recentes" do Launcher v2.
 *
 * - Persiste em localStorage (chave `bimaster.launcher.recents.v1`).
 * - TTL 24h por entrada.
 * - Máximo 8 itens, dedup por route.
 * - Inerte fora do v2 (só é montado dentro do AppRail).
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "bimaster.launcher.recents.v1";
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX = 8;

export interface RecentEntry {
  route: string;
  moduleCode: string;
  moduleLabel: string;
  pageLabel: string;
  icon?: string | null;
  visitedAt: number;
}

function read(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RecentEntry[];
    const now = Date.now();
    return Array.isArray(arr) ? arr.filter((e) => now - e.visitedAt < TTL_MS) : [];
  } catch {
    return [];
  }
}

function write(list: RecentEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent("launcher-recents-changed"));
  } catch {
    /* ignore quota */
  }
}

export function useRecents() {
  const [entries, setEntries] = useState<RecentEntry[]>(() => read());

  useEffect(() => {
    const refresh = () => setEntries(read());
    window.addEventListener("launcher-recents-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("launcher-recents-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const record = useCallback((entry: Omit<RecentEntry, "visitedAt">) => {
    const list = read();
    const next: RecentEntry[] = [
      { ...entry, visitedAt: Date.now() },
      ...list.filter((e) => e.route !== entry.route),
    ];
    write(next);
  }, []);

  const clear = useCallback(() => write([]), []);

  return { entries, record, clear };
}

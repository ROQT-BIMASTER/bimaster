/**
 * Favoritos do Launcher v2.
 * Persiste em localStorage (`bimaster.launcher.favs.v1`) um Set de rotas.
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "bimaster.launcher.favs.v1";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(list))));
    window.dispatchEvent(new CustomEvent("launcher-favs-changed"));
  } catch {
    /* ignore */
  }
}

export function useFavorites() {
  const [routes, setRoutes] = useState<string[]>(() => read());

  useEffect(() => {
    const refresh = () => setRoutes(read());
    window.addEventListener("launcher-favs-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("launcher-favs-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const isFavorite = useCallback(
    (route: string) => routes.includes(route),
    [routes],
  );

  const toggle = useCallback((route: string) => {
    const list = read();
    const next = list.includes(route)
      ? list.filter((r) => r !== route)
      : [route, ...list];
    write(next);
  }, []);

  return { favorites: routes, isFavorite, toggle };
}

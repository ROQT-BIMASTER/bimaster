import { useCallback, useEffect, useState } from "react";

/**
 * Densidade da listagem de tarefas no módulo Projetos.
 * Persistida em localStorage (global ao usuário neste navegador).
 *
 * - `comfortable`: padding maior, ideal para leitura
 * - `compact`: padding reduzido, mais linhas visíveis (estilo Linear/Asana)
 */
export type TarefaDensity = "comfortable" | "compact";

const STORAGE_KEY = "projetos:density";
const CHANGE_EVENT = "projetos-density-change";

function readStored(): TarefaDensity {
  if (typeof window === "undefined") return "comfortable";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

export function useTarefaDensity() {
  const [density, setDensityState] = useState<TarefaDensity>(() => readStored());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setDensityState(e.newValue === "compact" ? "compact" : "comfortable");
      }
    };
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent<TarefaDensity>).detail;
      if (detail) setDensityState(detail);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(CHANGE_EVENT, handleCustom as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(CHANGE_EVENT, handleCustom as EventListener);
    };
  }, []);

  const setDensity = useCallback((value: TarefaDensity) => {
    setDensityState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
    } catch {
      /* noop */
    }
  }, []);

  const toggle = useCallback(() => {
    setDensity(density === "compact" ? "comfortable" : "compact");
  }, [density, setDensity]);

  return { density, setDensity, toggle, isCompact: density === "compact" };
}

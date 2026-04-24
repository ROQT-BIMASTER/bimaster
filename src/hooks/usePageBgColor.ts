import { useState, useEffect, useMemo, useCallback } from "react";
import { isDarkHex } from "@/lib/colorUtils";

// Chave única compartilhada por todo o módulo Projetos.
// Qualquer tela que use este hook lê/escreve no mesmo slot,
// garantindo identidade visual unificada e persistência global.
const MODULE_BG_KEY = "projeto_module_bg";
const BG_CHANGE_EVENT = "projeto-module-bg-change";

function readStored(): string | null {
  try {
    return localStorage.getItem(MODULE_BG_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Hook de cor de fundo do módulo Projetos.
 * O parâmetro `pageKey` é mantido por compatibilidade, mas ignorado:
 * a cor é global ao módulo e sincroniza entre abas/telas em tempo real.
 */
export function usePageBgColor(_pageKey?: string) {
  const [bgColor, setBgColorState] = useState<string | null>(() => readStored());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === MODULE_BG_KEY) {
        setBgColorState(e.newValue || null);
      }
    };
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail ?? null;
      setBgColorState(detail);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(BG_CHANGE_EVENT, handleCustom as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(BG_CHANGE_EVENT, handleCustom as EventListener);
    };
  }, []);

  const setBgColor = useCallback((color: string | null) => {
    setBgColorState(color);
    try {
      if (color) {
        localStorage.setItem(MODULE_BG_KEY, color);
      } else {
        localStorage.removeItem(MODULE_BG_KEY);
      }
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent(BG_CHANGE_EVENT, { detail: color }));
    } catch {}
  }, []);

  const darkBg = useMemo(() => (bgColor ? isDarkHex(bgColor) : false), [bgColor]);
  const customBg = !!bgColor;

  return { bgColor, setBgColor, darkBg, customBg };
}

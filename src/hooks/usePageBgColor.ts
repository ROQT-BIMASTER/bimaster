import { useState, useEffect, useMemo } from "react";
import { isDarkHex } from "@/lib/colorUtils";

const DEFAULT_BG = "";

export function usePageBgColor(pageKey: string) {
  const storageKey = `projeto_page_bg_${pageKey}`;

  const [bgColor, setBgColorState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(storageKey) || null;
    } catch {
      return null;
    }
  });

  const setBgColor = (color: string | null) => {
    setBgColorState(color);
    try {
      if (color) {
        localStorage.setItem(storageKey, color);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {}
  };

  const darkBg = useMemo(() => (bgColor ? isDarkHex(bgColor) : false), [bgColor]);
  const customBg = !!bgColor;

  return { bgColor, setBgColor, darkBg, customBg };
}

/**
 * PageBgCustomizer
 * ----------------
 * Replica o padrão visual do módulo de Projetos (botão de paleta no header +
 * paleta HSL coerente derivada via getBgPaletteVars) para qualquer página.
 *
 * Uso:
 *   const { bgColor, BgColorButton, bgStyle } = usePageBgColor("fabrica_produtos_acabados");
 *
 *   // No header da página, ao lado do título:
 *   <BgColorButton />
 *
 *   // No wrapper do conteúdo (div mais externo da página):
 *   <div style={bgStyle}> ... </div>
 *
 * A cor é persistida em localStorage por chave (uma por tela), igual à
 * listagem de Projetos. Não toca em dados, RLS ou regras de negócio.
 */
import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { ProjetoBgColorPicker } from "@/components/projetos/ProjetoBgColorPicker";
import { getBgPaletteVars } from "@/lib/colorUtils";

const STORAGE_PREFIX = "bg_color:";

export function usePageBgColor(scope: string) {
  const storageKey = `${STORAGE_PREFIX}${scope}`;

  const [bgColor, setBgColorState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  });

  const setBgColor = useCallback(
    (color: string | null) => {
      setBgColorState(color);
      try {
        if (color) window.localStorage.setItem(storageKey, color);
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* noop */
      }
    },
    [storageKey],
  );

  const bgStyle = useMemo<CSSProperties | undefined>(() => {
    if (!bgColor) return undefined;
    return {
      backgroundColor: bgColor,
      color: "hsl(var(--foreground))",
      ...getBgPaletteVars(bgColor),
    } as CSSProperties;
  }, [bgColor]);

  const BgColorButton = useCallback(
    () => <ProjetoBgColorPicker value={bgColor} onChange={setBgColor} />,
    [bgColor, setBgColor],
  );

  return { bgColor, setBgColor, bgStyle, BgColorButton };
}

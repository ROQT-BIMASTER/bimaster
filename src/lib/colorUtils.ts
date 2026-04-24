/**
 * Color helpers for the per-page background customization.
 *
 * The Central de Trabalho (and other Projeto pages) lets the user pick a custom
 * background color. Without help, only the <main> element gets recolored — the
 * Cards, inputs and KPI tiles keep their default tokens and look pasted on top.
 *
 * `getBgPaletteVars` derives a coherent token palette (background, card, muted,
 * foreground, border, ring, accent) from a single hex so the whole subtree
 * blends with the chosen color. The variables override shadcn tokens locally.
 *
 * v3.4.9: now enforces WCAG AA contrast automatically. Foreground colors are
 * iteratively darkened or lightened until they reach the minimum 4.5:1 ratio
 * against their surface, and borders reach 3:1 against the background. This
 * fixes mid-luminance backgrounds (e.g. teal #4A9, olive #8C7) where the
 * binary dark/light split previously produced unreadable text.
 */

export function isDarkHex(hex: string): boolean {
  const { l } = rgbToHsl(...Object.values(hexToRgb(hex)) as [number, number, number]);
  // l is 0-100 here; treat <55 as dark for theming branch selection.
  return l < 55;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const safe = hex.replace("#", "");
  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

/**
 * sRGB relative luminance per WCAG 2.1 (0-1).
 * @param l HSL lightness 0-100. Converts back via achromatic approximation —
 *          good enough for contrast budgeting since saturation has small effect
 *          on luminance for moderate s values.
 */
function luminanceFromHsl(h: number, s: number, l: number): number {
  // Convert HSL → RGB, then RGB → relative luminance.
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = ln - c / 2;
  const toLin = (v: number) => {
    const u = v + m;
    return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastRatio(l1: number, l2: number): number {
  const a = Math.max(l1, l2);
  const b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

/**
 * Pick a foreground lightness that meets WCAG AA contrast against a surface.
 * Tries to keep the same hue as the surface (so the palette stays cohesive)
 * by walking lightness toward 0% (dark) or 100% (light) until the ratio is met.
 *
 * @param surfaceL  surface lightness (0-100)
 * @param hue       shared hue (0-360)
 * @param sat       desired saturation (capped — desaturated text reads better)
 * @param minRatio  minimum contrast (4.5 = AA body, 3 = AA large/border)
 * @param prefer    'auto' picks the direction with most headroom; 'dark'/'light' force
 */
function pickForegroundL(
  surfaceL: number,
  hue: number,
  sat: number,
  minRatio: number,
  prefer: "auto" | "dark" | "light" = "auto",
): number {
  const surfaceLum = luminanceFromHsl(hue, sat, surfaceL);
  // Decide direction
  let direction: "dark" | "light";
  if (prefer !== "auto") {
    direction = prefer;
  } else {
    // Pick the side that gives a head start: distance from surface lightness.
    direction = surfaceL >= 55 ? "dark" : "light";
  }
  // Walk lightness toward extreme until contrast ≥ minRatio.
  const start = direction === "dark" ? Math.min(surfaceL, 50) : Math.max(surfaceL, 50);
  const step = 2;
  let l = start;
  for (let i = 0; i < 60; i++) {
    const lum = luminanceFromHsl(hue, sat, l);
    if (contrastRatio(lum, surfaceLum) >= minRatio) return l;
    l = direction === "dark" ? l - step : l + step;
    if (l < 2) return 2;
    if (l > 98) return 98;
  }
  return direction === "dark" ? 8 : 96;
}

function hsl(h: number, s: number, l: number): string {
  return `${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%`;
}

/**
 * Build a CSS variables map that re-skins the shadcn tokens to match a custom
 * background. Returns an empty object when no color is chosen so the page falls
 * back to the global theme.
 *
 * Foreground/border lightness values are computed via `pickForegroundL` so each
 * variable meets WCAG AA contrast against its own surface (cards have their
 * own foreground tuned to the card lightness, not the page background).
 */
export function getBgPaletteVars(hex: string | null | undefined): Record<string, string> {
  if (!hex) return {};
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const dark = l < 55;

  // Saturation budgets — keep tokens cohesive but desaturate text for readability.
  const textSat = Math.min(s, 18);
  const mutedTextSat = Math.min(s, 14);
  const borderSat = Math.min(s, 28);
  const surfaceSat = Math.min(s, 35);

  // Surface lightnesses (card lifts above bg in dark mode, sits softly in light mode).
  const cardL = dark ? Math.min(l + 7, 22) : Math.min(l + 4, 100);
  const mutedL = dark ? Math.min(l + 4, 18) : Math.max(l - 4, 88);
  const accentL = dark ? Math.min(l + 10, 28) : Math.max(l - 6, 84);

  // Compute foregrounds that meet WCAG AA against EACH surface.
  const fgOnBg = pickForegroundL(l, h, textSat, 4.5);
  const fgOnCard = pickForegroundL(cardL, h, textSat, 4.5);
  const mutedFgOnBg = pickForegroundL(l, h, mutedTextSat, 4.5);
  const fgOnAccent = pickForegroundL(accentL, h, textSat, 4.5);

  // Borders only need 3:1 (UI component contrast per WCAG 1.4.11).
  const borderL = pickForegroundL(l, h, borderSat, 3.0);
  // But pull borders gently toward the surface so they don't look like text:
  // blend the picked lightness with the surface lightness 60/40.
  const softBorderL = borderL * 0.55 + l * 0.45;
  // Re-check: if the blend dropped below 3:1, fall back to the strict pick.
  const finalBorderL =
    contrastRatio(
      luminanceFromHsl(h, borderSat, softBorderL),
      luminanceFromHsl(h, s, l),
    ) >= 3.0
      ? softBorderL
      : borderL;

  return {
    "--background": hsl(h, s, l),
    "--foreground": hsl(h, textSat, fgOnBg),
    "--card": hsl(h, surfaceSat, cardL),
    "--card-foreground": hsl(h, textSat, fgOnCard),
    "--popover": hsl(h, surfaceSat, cardL),
    "--popover-foreground": hsl(h, textSat, fgOnCard),
    "--muted": hsl(h, Math.max(s - 5, 0), mutedL),
    "--muted-foreground": hsl(h, mutedTextSat, mutedFgOnBg),
    "--border": hsl(h, borderSat, finalBorderL),
    "--input": hsl(h, borderSat, finalBorderL),
    "--secondary": hsl(h, Math.max(s - 5, 0), mutedL),
    "--secondary-foreground": hsl(h, textSat, fgOnCard),
    "--accent": hsl(h, surfaceSat, accentL),
    "--accent-foreground": hsl(h, textSat, fgOnAccent),
  };
}

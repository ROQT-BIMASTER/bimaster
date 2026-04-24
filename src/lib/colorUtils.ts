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
 */

export function isDarkHex(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 0.4;
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

function hsl(h: number, s: number, l: number): string {
  return `${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%`;
}

/**
 * Build a CSS variables map that re-skins the shadcn tokens to match a custom
 * background. Returns an empty object when no color is chosen so the page falls
 * back to the global theme.
 */
export function getBgPaletteVars(hex: string | null | undefined): Record<string, string> {
  if (!hex) return {};
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const dark = isDarkHex(hex);

  if (dark) {
    // Dark background: use lighter foreground and slightly lifted surfaces.
    const cardL = Math.min(l + 7, 22);
    const mutedL = Math.min(l + 4, 18);
    const borderL = Math.min(l + 14, 30);
    return {
      "--background": hsl(h, s, l),
      "--foreground": hsl(h, Math.min(s, 15), 96),
      "--card": hsl(h, Math.min(s, 35), cardL),
      "--card-foreground": hsl(h, Math.min(s, 15), 96),
      "--popover": hsl(h, Math.min(s, 35), cardL),
      "--popover-foreground": hsl(h, Math.min(s, 15), 96),
      "--muted": hsl(h, Math.min(s, 25), mutedL),
      "--muted-foreground": hsl(h, Math.min(s, 15), 70),
      "--border": hsl(h, Math.min(s, 30), borderL),
      "--input": hsl(h, Math.min(s, 30), borderL),
      "--secondary": hsl(h, Math.min(s, 25), mutedL),
      "--secondary-foreground": hsl(h, Math.min(s, 15), 96),
      "--accent": hsl(h, Math.min(s, 35), Math.min(l + 10, 25)),
      "--accent-foreground": hsl(h, Math.min(s, 15), 96),
    };
  }

  // Light background: keep card slightly lighter than the surface, soft borders.
  const cardL = Math.min(l + 4, 100);
  const mutedL = Math.max(l - 4, 88);
  const borderL = Math.max(l - 12, 80);
  return {
    "--background": hsl(h, s, l),
    "--foreground": hsl(h, Math.min(s, 25), 12),
    "--card": hsl(h, Math.max(s - 10, 0), cardL),
    "--card-foreground": hsl(h, Math.min(s, 25), 12),
    "--popover": hsl(h, Math.max(s - 10, 0), cardL),
    "--popover-foreground": hsl(h, Math.min(s, 25), 12),
    "--muted": hsl(h, Math.max(s - 5, 0), mutedL),
    "--muted-foreground": hsl(h, Math.min(s, 20), 38),
    "--border": hsl(h, Math.min(s, 30), borderL),
    "--input": hsl(h, Math.min(s, 30), borderL),
    "--secondary": hsl(h, Math.max(s - 5, 0), mutedL),
    "--secondary-foreground": hsl(h, Math.min(s, 25), 18),
    "--accent": hsl(h, Math.max(s - 5, 0), mutedL),
    "--accent-foreground": hsl(h, Math.min(s, 25), 18),
  };
}

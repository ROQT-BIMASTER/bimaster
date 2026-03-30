/**
 * Semantic chart color palette.
 * Uses CSS variables from the design system so charts adapt to light/dark themes.
 * `hsl` strings for Recharts/SVG fill/stroke; `var` for Tailwind classes.
 */

export const chartColors = {
  primary:     "hsl(var(--chart-1))",
  success:     "hsl(var(--chart-2))",
  warning:     "hsl(var(--chart-3))",
  accent:      "hsl(var(--chart-4))",
  destructive: "hsl(var(--chart-5))",
  teal:        "hsl(var(--chart-6))",
  gold:        "hsl(var(--chart-7))",
  pink:        "hsl(var(--chart-8))",
} as const;

/** Ordered palette for multi-series charts */
export const chartPalette = [
  chartColors.primary,
  chartColors.success,
  chartColors.warning,
  chartColors.accent,
  chartColors.destructive,
  chartColors.teal,
  chartColors.gold,
  chartColors.pink,
] as const;

/** Gradient IDs for area charts — call once per chart SVG */
export function getAreaGradientId(index: number) {
  return `area-gradient-${index}`;
}

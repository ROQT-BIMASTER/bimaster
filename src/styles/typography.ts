/**
 * Single source of truth for typography tokens.
 *
 * ANY page/component that needs to reference the body or display font MUST
 * import from this file. Do NOT hardcode font-family strings elsewhere.
 *
 * Values MUST stay in sync with:
 *   - `--font-sans` / `--font-display` in `src/index.css`
 *   - `fontFamily.sans` / `fontFamily.display` in `tailwind.config.ts`
 *
 * The CI grep `.github/workflows/regression-greps.yml` enforces that both
 * `DM Sans Fallback` and `Space Grotesk Fallback` remain present in
 * `src/index.css` and `tailwind.config.ts`.
 */

export const FONT_SANS_STACK =
  "'DM Sans', 'DM Sans Fallback', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'";

export const FONT_DISPLAY_STACK =
  "'Space Grotesk Variable', 'Space Grotesk', 'Space Grotesk Fallback', 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Tailwind utility for body copy — use on page shells to make the token explicit. */
export const TYPOGRAPHY_BODY_CLASS = "font-sans";

/** Tailwind utility for headings/display — use on H1/H2 and KPI numerals. */
export const TYPOGRAPHY_DISPLAY_CLASS = "font-display";

/**
 * Inline style helper — apply on the top-level element of a page/module to
 * guarantee the shared stack resolves even if a parent overrides `font-family`
 * via a third-party CSS reset.
 */
export const typographyRootStyle: React.CSSProperties = {
  fontFamily: FONT_SANS_STACK,
};

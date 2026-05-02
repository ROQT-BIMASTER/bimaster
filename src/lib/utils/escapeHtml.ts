/**
 * Escape an arbitrary value for safe interpolation inside HTML markup
 * generated for `printWindow.document.write(...)` (or any innerHTML sink).
 *
 * Mitigates stored XSS where DB/user-controlled values were previously
 * concatenated raw into HTML template literals.
 *
 * Always use this helper before interpolating any string into HTML emitted
 * by print/export utilities. Numbers and other primitives are coerced to
 * string and still escaped (cheap and harmless).
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Tagged-template variant: html`<div>${userValue}</div>` auto-escapes interpolations. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) {
      const v = values[i];
      // Allow opt-out via { __raw: string } for already-safe HTML fragments
      if (v && typeof v === "object" && "__raw" in (v as Record<string, unknown>)) {
        out += String((v as { __raw: unknown }).__raw ?? "");
      } else {
        out += escapeHtml(v);
      }
    }
  });
  return out;
}

/** Mark an already-safe HTML string so it bypasses escaping inside `html` tagged templates. */
export const rawHtml = (s: string) => ({ __raw: s });

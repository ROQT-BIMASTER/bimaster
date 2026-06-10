// Citation validation. See RFC v4.0.0 §C1.

import type { Citation } from "./types.ts";

export interface CitationValidationIssue {
  citationId: string;
  code: "MISSING_SPAN" | "INVALID_SPAN" | "LOW_CONFIDENCE" | "SNIPPET_TOO_LONG";
  message: string;
}

export function validateCitations(
  citations: Citation[],
  plainText: string,
  opts: { allowMissingSpanInAppendix?: boolean } = {},
): CitationValidationIssue[] {
  const issues: CitationValidationIssue[] = [];
  const plainLen = [...plainText].length;
  for (const c of citations) {
    if (c.snippet.length > 240) {
      issues.push({ citationId: c.citationId, code: "SNIPPET_TOO_LONG", message: "snippet >240 chars" });
    }
    if (!c.span) {
      if (!opts.allowMissingSpanInAppendix) {
        issues.push({
          citationId: c.citationId,
          code: "MISSING_SPAN",
          message: "span required outside Apêndice",
        });
      }
      continue;
    }
    if (c.span.start < 0 || c.span.end > plainLen || c.span.start >= c.span.end) {
      issues.push({ citationId: c.citationId, code: "INVALID_SPAN", message: "span out of bounds" });
    }
    if (c.confidence < 0.5) {
      issues.push({ citationId: c.citationId, code: "LOW_CONFIDENCE", message: "render as weak source" });
    }
  }
  return issues;
}

/** Group citations by paragraph using their span on the plain text. */
export function citationsByParagraph(
  citations: Citation[],
  plainText: string,
): Map<number, Citation[]> {
  const paragraphs = plainText.split(/\n{2,}|\n(?=[-*•])/);
  const offsets: number[] = [];
  let cursor = 0;
  for (const p of paragraphs) {
    offsets.push(cursor);
    cursor += p.length + 2;
  }
  const map = new Map<number, Citation[]>();
  for (const c of citations) {
    if (!c.span) continue;
    let idx = 0;
    for (let i = 0; i < offsets.length; i++) {
      if (c.span.start >= offsets[i]) idx = i;
      else break;
    }
    const arr = map.get(idx) ?? [];
    arr.push(c);
    map.set(idx, arr);
  }
  return map;
}

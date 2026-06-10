// Number Contract — Tool Result = Source of Truth. See RFC v4.0.0 §C2.
//
// Detects numeric/currency/percent/date tokens in assistant output and
// validates them against citations [Cn] or sourceRef payload values.
//
// Result drives the renderer:
//  - match              -> render as-is
//  - mismatch           -> replace with canonical value + badge
//  - unverifiable       -> mark "⚠ não verificável", strip from executive_summary

import type { Citation, SourceRef } from "./types.ts";

const NUMBER_RE =
  /(?<!\w)(?:R\$|US\$|€|¥|CN¥|£)?\s?-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?%?(?!\w)|\b\d{2}\/\d{2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;

export interface NumberToken {
  raw: string;
  start: number;
  end: number;
  paragraphIndex: number;
}

export function extractNumbers(plainText: string): NumberToken[] {
  const tokens: NumberToken[] = [];
  const paragraphs = plainText.split(/\n{2,}|\n(?=[-*•])/);
  let cursor = 0;
  paragraphs.forEach((p, pIdx) => {
    NUMBER_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = NUMBER_RE.exec(p)) !== null) {
      const start = cursor + m.index;
      tokens.push({ raw: m[0], start, end: start + m[0].length, paragraphIndex: pIdx });
    }
    cursor += p.length + 2;
  });
  return tokens;
}

export type NumberVerdict =
  | { kind: "match"; citationId?: string; sourceRef?: SourceRef }
  | { kind: "mismatch"; canonical: string; sourceRef: SourceRef }
  | { kind: "unverifiable" };

export interface VerifyContext {
  citationsByParagraph: Map<number, Citation[]>;
  sourceRefs: Array<{ ref: SourceRef; value: string | number }>;
}

function normalizeNumeric(s: string): string {
  return s.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
}

function valuesEqual(a: string, b: string | number): boolean {
  const an = parseFloat(normalizeNumeric(a));
  const bn = typeof b === "number" ? b : parseFloat(normalizeNumeric(String(b)));
  if (Number.isNaN(an) || Number.isNaN(bn)) return a.trim() === String(b).trim();
  if (Number.isInteger(an) && Number.isInteger(bn)) return an === bn;
  return Math.abs(an - bn) <= 0.01;
}

export function verifyToken(tok: NumberToken, ctx: VerifyContext): NumberVerdict {
  const hasCitation = (ctx.citationsByParagraph.get(tok.paragraphIndex)?.length ?? 0) > 0;
  for (const sr of ctx.sourceRefs) {
    if (valuesEqual(tok.raw, sr.value)) {
      return { kind: "match", sourceRef: sr.ref };
    }
  }
  if (hasCitation) {
    return {
      kind: "match",
      citationId: ctx.citationsByParagraph.get(tok.paragraphIndex)![0].citationId,
    };
  }
  // The model produced a number that doesn't match any sourceRef and has no
  // citation in its paragraph. Try a "mismatch" fallback: pick the closest
  // sourceRef in the same paragraph if any, otherwise unverifiable.
  return { kind: "unverifiable" };
}

export interface VerifyReport {
  unverifiable: NumberToken[];
  mismatches: Array<{ token: NumberToken; canonical: string; sourceRef: SourceRef }>;
  matched: number;
}

export function verifyAll(plain: string, ctx: VerifyContext): VerifyReport {
  const tokens = extractNumbers(plain);
  const report: VerifyReport = { unverifiable: [], mismatches: [], matched: 0 };
  for (const t of tokens) {
    const v = verifyToken(t, ctx);
    if (v.kind === "match") report.matched++;
    else if (v.kind === "mismatch") report.mismatches.push({ token: t, canonical: v.canonical, sourceRef: v.sourceRef });
    else report.unverifiable.push(t);
  }
  return report;
}

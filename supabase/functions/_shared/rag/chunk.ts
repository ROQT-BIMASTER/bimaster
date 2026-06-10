// Text chunking for RAG. Target 500-800 tokens with ~15% overlap.
// Heuristic: ~4 chars per token, so 2400-3200 chars per chunk, 400-char overlap.

export interface Chunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
}

const TARGET_CHARS = 2800;
const OVERLAP_CHARS = 400;

export function chunkText(text: string): Chunk[] {
  if (!text) return [];
  const norm = text.replace(/\r\n?/g, "\n").trim();
  if (norm.length <= TARGET_CHARS) {
    return [{ text: norm, index: 0, startChar: 0, endChar: norm.length }];
  }
  const chunks: Chunk[] = [];
  let i = 0;
  let idx = 0;
  while (i < norm.length) {
    const end = Math.min(i + TARGET_CHARS, norm.length);
    const slice = breakOnBoundary(norm, i, end);
    chunks.push({ text: norm.slice(i, slice).trim(), index: idx, startChar: i, endChar: slice });
    if (slice >= norm.length) break;
    i = Math.max(slice - OVERLAP_CHARS, i + 1);
    idx++;
  }
  return chunks;
}

function breakOnBoundary(text: string, start: number, hardEnd: number): number {
  if (hardEnd >= text.length) return text.length;
  const window = text.slice(start, hardEnd);
  const paragraph = window.lastIndexOf("\n\n");
  if (paragraph > TARGET_CHARS * 0.5) return start + paragraph;
  const sentence = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf("。"),
  );
  if (sentence > TARGET_CHARS * 0.5) return start + sentence + 1;
  return hardEnd;
}

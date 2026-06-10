// Plain-text normalization used by BOTH backend and frontend to compute
// citation spans. See RFC v4.0.0 §C1.1.
//
// Rules (frozen):
// - Strip markdown to plain text.
// - NFC normalization.
// - Line endings normalized to "\n".
// - start/end are Unicode code-point offsets (not bytes).
//
// IMPORTANT: src/lib/copilot/text.ts MUST mirror this implementation
// character-for-character or spans will not align cross-boundary.

const FENCE = /```[\s\S]*?```/g;
const INLINE_CODE = /`([^`]+)`/g;
const IMAGES = /!\[([^\]]*)\]\([^)]*\)/g;
const LINKS = /\[([^\]]+)\]\([^)]*\)/g;
const HEADINGS = /^#{1,6}\s+/gm;
const BLOCKQUOTE = /^>\s?/gm;
const HR = /^\s*[-*_]{3,}\s*$/gm;
const BOLD_IT = /(\*\*|__|\*|_)(.+?)\1/g;
const STRIKE = /~~(.+?)~~/g;
const LIST_BULLET = /^\s*[-*+]\s+/gm;
const LIST_NUMBER = /^\s*\d+\.\s+/gm;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;

export function getPlainText(markdown: string): string {
  if (!markdown) return "";
  let out = markdown.replace(/\r\n?/g, "\n");
  out = out.replace(FENCE, (m) => m.replace(/```[a-zA-Z0-9_-]*\n?/g, "").replace(/```/g, ""));
  out = out.replace(IMAGES, "$1");
  out = out.replace(LINKS, "$1");
  out = out.replace(HEADINGS, "");
  out = out.replace(BLOCKQUOTE, "");
  out = out.replace(HR, "");
  out = out.replace(BOLD_IT, "$2");
  out = out.replace(STRIKE, "$1");
  out = out.replace(LIST_BULLET, "");
  out = out.replace(LIST_NUMBER, "");
  out = out.replace(INLINE_CODE, "$1");
  out = out.replace(HTML_TAG, "");
  out = out.normalize("NFC");
  return out;
}

export function spanOf(plain: string, snippet: string): { start: number; end: number } | null {
  if (!snippet) return null;
  const n = snippet.normalize("NFC");
  const idx = plain.indexOf(n);
  if (idx < 0) return null;
  // Convert UTF-16 code-unit index to code-point offset.
  const start = [...plain.slice(0, idx)].length;
  const end = start + [...n].length;
  return { start, end };
}

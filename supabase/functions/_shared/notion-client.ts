// supabase/functions/_shared/notion-client.ts
// Centralized Notion REST client with retry + pagination.
// Used by notion-export-briefing and notion-pull-briefing.

export const NOTION_VERSION = "2022-06-28";
export const NOTION_API = "https://api.notion.com/v1";

export interface NotionResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  errorText?: string;
}

/** Minimal block shape we care about for round-trip. */
export interface NotionBlock {
  id?: string;
  object?: string;
  type?: string;
  has_children?: boolean;
  archived?: boolean;
  [k: string]: unknown;
}

export interface NotionPage {
  id: string;
  url: string;
  archived?: boolean;
  in_trash?: boolean;
  last_edited_time?: string;
  properties?: Record<string, unknown>;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch with retry on 429 / 5xx. Honors `Retry-After` header. */
export async function notion<T = unknown>(
  token: string,
  path: string,
  init: RequestInit = {},
  attempt = 0,
): Promise<NotionResult<T>> {
  const resp = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (resp.status === 429 || resp.status >= 500) {
    if (attempt < 3) {
      const retryAfterHeader = resp.headers.get("Retry-After");
      const retryAfter = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
      const backoff = retryAfter || 400 * Math.pow(2, attempt);
      await sleep(backoff);
      return notion<T>(token, path, init, attempt + 1);
    }
  }

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`[notion ${path}] ${resp.status}`, errorText.slice(0, 500));
    return { ok: false, status: resp.status, data: null, errorText };
  }
  return { ok: true, status: resp.status, data: await resp.json() as T };
}

/** Paginate /blocks/{id}/children. Returns all top-level blocks. */
export async function listAllChildren(
  token: string,
  blockId: string,
): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const qs = cursor ? `?start_cursor=${encodeURIComponent(cursor)}&page_size=100` : `?page_size=100`;
    const r = await notion<{ results: NotionBlock[]; next_cursor: string | null; has_more: boolean }>(
      token,
      `/blocks/${blockId}/children${qs}`,
    );
    if (!r.ok || !r.data) break;
    out.push(...r.data.results);
    if (!r.data.has_more || !r.data.next_cursor) break;
    cursor = r.data.next_cursor;
  }
  return out;
}

/** Delete a list of blocks with limited concurrency. Ignores per-block failures. */
export async function deleteBlocks(
  token: string,
  blockIds: string[],
  concurrency = 3,
): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < blockIds.length) {
      const idx = i++;
      const id = blockIds[idx];
      await notion(token, `/blocks/${id}`, { method: "DELETE" }).catch(() => null);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, blockIds.length) }, worker);
  await Promise.all(workers);
}

/** Append children in chunks of 100 (Notion's hard limit). */
export async function appendChildrenInChunks(
  token: string,
  blockId: string,
  blocks: unknown[],
): Promise<{ ok: boolean; errorText?: string }> {
  for (let i = 0; i < blocks.length; i += 100) {
    const chunk = blocks.slice(i, i + 100);
    const r = await notion(token, `/blocks/${blockId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children: chunk }),
    });
    if (!r.ok) {
      return { ok: false, errorText: r.errorText };
    }
  }
  return { ok: true };
}

/** Extract a stable plain-text from a Notion rich_text array. */
export function richTextToPlain(rt: unknown): string {
  if (!Array.isArray(rt)) return "";
  return rt
    .map((node: { plain_text?: string; text?: { content?: string } }) =>
      node.plain_text ?? node.text?.content ?? ""
    )
    .join("");
}

/** Simple SHA-256 hex; used to detect content drift between syncs. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

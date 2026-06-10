// proxy-legacy.ts — internal HTTP call to a legacy copilot edge function,
// forwarding the caller's JWT so RLS continues to apply. Used by the v2 wrappers.

export interface ProxyOpts {
  legacyName: string;
  authHeader: string; // raw "Bearer ..."
  body: unknown;
  timeoutMs?: number;
}

export async function callLegacyCopilot<T = Record<string, unknown>>(
  opts: ProxyOpts,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) return { ok: false, status: 500, error: "missing SUPABASE_URL" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(`${base}/functions/v1/${opts.legacyName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: opts.authHeader,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify(opts.body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 500) };
    try {
      return { ok: true, data: JSON.parse(text) as T };
    } catch {
      return { ok: false, status: 502, error: "legacy response not JSON" };
    }
  } catch (e) {
    return { ok: false, status: 504, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

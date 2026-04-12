// api-health-check — Verifica status de Edge Functions
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const cors = getCorsHeaders(req);
  const headers = withSecurityHeaders(
    { ...cors, "Content-Type": "application/json" },
    false
  );

  // Health check status
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", service: "api-health-check" }),
      { headers }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const { paths } = await req.json();
    if (!Array.isArray(paths) || paths.length === 0) {
      return new Response(
        JSON.stringify({ error: "paths array required" }),
        { status: 400, headers }
      );
    }

    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    // Helper: try a single URL, return {ok, latency}
    async function probe(url: string): Promise<{ ok: boolean; latency: number }> {
      const start = performance.now();
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: anonKey ? { "apikey": anonKey, "Authorization": `Bearer ${anonKey}` } : {},
          signal: AbortSignal.timeout(5000),
        });
        await res.text().catch(() => {});
        const latency = Math.round(performance.now() - start);
        // Any response that isn't a network error means function is alive
        const alive = res.ok || res.status === 401 || res.status === 403 || res.status === 405 || res.status === 400 || res.status === 404;
        return { ok: alive, latency };
      } catch {
        return { ok: false, latency: 0 };
      }
    }

    const results = await Promise.all(
      paths.map(async (path: string) => {
        // Strategy 1: try /status sub-path
        const statusProbe = await probe(`${baseUrl}/functions/v1${path}/status`);
        if (statusProbe.ok) {
          return { path, status: "online", latency: statusProbe.latency };
        }

        // Strategy 2: try root path (handles functions without /status route)
        const rootProbe = await probe(`${baseUrl}/functions/v1${path}`);
        if (rootProbe.ok) {
          return { path, status: "online", latency: rootProbe.latency };
        }

        return { path, status: "offline", latency: 0 };
      })
    );

    return new Response(JSON.stringify({ results }), { headers });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers }
    );
  }
});

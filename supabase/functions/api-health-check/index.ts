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

    // Single probe per path — any HTTP response = alive (function is deployed)
    // Only network errors / timeouts mark as offline
    async function probe(url: string): Promise<{ ok: boolean; latency: number }> {
      const start = performance.now();
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: anonKey ? { "apikey": anonKey, "Authorization": `Bearer ${anonKey}` } : {},
          signal: AbortSignal.timeout(10000),
        });
        await res.text().catch(() => {});
        const latency = Math.round(performance.now() - start);
        return { ok: true, latency }; // Any HTTP response = alive
      } catch {
        return { ok: false, latency: 0 };
      }
    }

    const results = await Promise.all(
      paths.map(async (path: string) => {
        const result = await probe(`${baseUrl}/functions/v1${path}`);
        return { path, status: result.ok ? "online" : "offline", latency: result.latency };
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

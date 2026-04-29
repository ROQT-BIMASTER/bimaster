import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(
  secureHandler(
    { auth: "any", rateLimit: 600, rateLimitPrefix: "api-health-check", skipWaf: true },
    async (req) => {
      const cors = getCorsHeaders(req);
      const headers = { ...cors, "Content-Type": "application/json" };

      if (req.method === "GET") {
        return new Response(
          JSON.stringify({ status: "ok", service: "api-health-check" }),
          { headers }
        );
      }

      if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
          status: 405,
          headers,
        });
      }

      const body = await req.json().catch(() => ({}));
      const paths = (body as { paths?: unknown }).paths;
      if (!Array.isArray(paths) || paths.length === 0 || paths.length > 50) {
        return new Response(
          JSON.stringify({ error: "paths array required (1-50 items)" }),
          { status: 400, headers }
        );
      }

      const baseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

      async function probe(url: string): Promise<{ ok: boolean; latency: number }> {
        const start = performance.now();
        try {
          const res = await fetch(url, {
            method: "GET",
            headers: anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {},
            signal: AbortSignal.timeout(10000),
          });
          await res.text().catch(() => {});
          const latency = Math.round(performance.now() - start);
          return { ok: true, latency };
        } catch {
          return { ok: false, latency: 0 };
        }
      }

      const results = await Promise.all(
        paths.map(async (path: unknown) => {
          if (typeof path !== "string" || !path.startsWith("/")) {
            return { path: String(path), status: "invalid", latency: 0 };
          }
          const result = await probe(`${baseUrl}/functions/v1${path}`);
          return { path, status: result.ok ? "online" : "offline", latency: result.latency };
        })
      );

      return new Response(JSON.stringify({ results }), { headers });
    }
  )
);

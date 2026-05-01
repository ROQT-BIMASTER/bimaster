// shipsgo-list-carriers — Proxy cacheado da lista de armadores Ocean.
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { shipsgoFetch } from "../_shared/shipsgo.ts";

let cache: { at: number; data: unknown } | null = null;
const TTL_MS = 24 * 60 * 60 * 1000; // 1 dia

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "shipsgo-carriers" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const now = Date.now();
      if (!cache || now - cache.at > TTL_MS) {
        const data = await shipsgoFetch<any>("/ocean/carriers", {
          query: { take: 200 },
        });
        cache = { at: now, data };
      }
      return new Response(JSON.stringify(cache.data), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    },
  ),
);

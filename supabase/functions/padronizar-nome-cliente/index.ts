import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const PadronizarSchema = z
  .object({
    name: z.string().min(1).max(500),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 120, rateLimitPrefix: "padronizar-nome-cliente" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const headers = { ...cors, "Content-Type": "application/json" };

      const body = await req.json().catch(() => ({}));
      const { name } = validateBody(body, PadronizarSchema);

      let normalized = name
        .trim()
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");

      normalized = normalized.replace(/[^\w\s-]/g, "");

      const patterns = [
        { from: /LTDA\.?$/i, to: "LTDA" },
        { from: /S\.?A\.?$/i, to: "SA" },
        { from: /ME\.?$/i, to: "ME" },
        { from: /EPP\.?$/i, to: "EPP" },
        { from: /EIRELI\.?$/i, to: "EIRELI" },
        { from: /CIA\.?/i, to: "CIA" },
        { from: /\bEMP\b/i, to: "EMPRESA" },
        { from: /\bCOM\b/i, to: "COMERCIO" },
        { from: /\bIND\b/i, to: "INDUSTRIA" },
      ];

      for (const { from, to } of patterns) {
        normalized = normalized.replace(from, to);
      }

      normalized = normalized.replace(/\s+/g, " ").trim();

      return new Response(
        JSON.stringify({ original: name, normalized, success: true }),
        { headers }
      );
    }
  )
);

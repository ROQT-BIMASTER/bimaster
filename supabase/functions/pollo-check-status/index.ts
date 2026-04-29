import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const CheckStatusSchema = z
  .object({
    taskId: z.string().min(1).max(200),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 120, rateLimitPrefix: "pollo-check-status" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const headers = { ...cors, "Content-Type": "application/json" };

      const POLLO_API_KEY = Deno.env.get("POLLO_API_KEY");
      if (!POLLO_API_KEY) {
        throw new Error("POLLO_API_KEY não configurada");
      }

      const body = await req.json().catch(() => ({}));
      const { taskId } = validateBody(body, CheckStatusSchema);

      const response = await fetch(`https://pollo.ai/api/platform/query/${encodeURIComponent(taskId)}`, {
        method: "GET",
        headers: { "x-api-key": POLLO_API_KEY },
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Erro ao verificar status: ${response.status}` }),
          { status: response.status, headers }
        );
      }

      const data = await response.json();

      return new Response(
        JSON.stringify({
          status: data.status,
          videoUrl: data.output?.video || null,
          progress: data.progress || 0,
        }),
        { headers }
      );
    }
  )
);

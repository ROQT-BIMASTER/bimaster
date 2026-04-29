import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validateExternalUrl } from "../_shared/ssrf-guard.ts";

const AnalyzeWebsiteSchema = z
  .object({
    url: z.string().url().max(2000),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "pollo-analyze" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const headers = { ...cors, "Content-Type": "application/json" };

      const body = await req.json().catch(() => ({}));
      const { url } = validateBody(body, AnalyzeWebsiteSchema);

      validateExternalUrl(url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro ao acessar site: ${response.status}`);
      }

      const html = await response.text();

      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const descMatch = html.match(/<meta\s+name="description"\s+content="(.*?)"/i);
      const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);

      const title = titleMatch ? titleMatch[1] : "Sem título";
      const description = descMatch ? descMatch[1] : "";
      const h1 = h1Match ? h1Match[1].replace(/<[^>]*>/g, "") : "";

      const analysis = `Site: ${title}
${description ? `Descrição: ${description}` : ""}
${h1 ? `Título principal: ${h1}` : ""}

Baseado neste site, crie conteúdo visual relevante e profissional.`;

      return new Response(
        JSON.stringify({ analysis, metadata: { title, description, h1, url } }),
        { headers }
      );
    }
  )
);

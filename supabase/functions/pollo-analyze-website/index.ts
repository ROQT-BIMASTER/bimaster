import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { validateJWT } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { handleError } from "../_shared/error-handler.ts";
import { validateExternalUrl } from "../_shared/ssrf-guard.ts";
import { withSecurityHeaders } from "../_shared/security-headers.ts";

const AnalyzeWebsiteSchema = z.object({
  url: z.string().url().max(2000),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await validateJWT(req);
    await checkRateLimit({ prefix: "pollo-analyze", limit: 20, req, userId: auth.userId });

    const body = await req.json();
    const { url } = validateBody(body, AnalyzeWebsiteSchema);

    // ADV-3: SSRF guard — block internal/private URLs
    validateExternalUrl(url);

    console.log('Analisando site:', url);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erro ao acessar site: ${response.status}`);

    const html = await response.text();

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const descMatch = html.match(/<meta\s+name="description"\s+content="(.*?)"/i);
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);

    const title = titleMatch ? titleMatch[1] : 'Sem título';
    const description = descMatch ? descMatch[1] : '';
    const h1 = h1Match ? h1Match[1].replace(/<[^>]*>/g, '') : '';

    const analysis = `Site: ${title}
${description ? `Descrição: ${description}` : ''}
${h1 ? `Título principal: ${h1}` : ''}

Baseado neste site, crie conteúdo visual relevante e profissional.`;

    return new Response(
      JSON.stringify({ analysis, metadata: { title, description, h1, url } }),
      { headers: withSecurityHeaders({ ...getCorsHeaders(req), 'Content-Type': 'application/json' }) }
    );
  } catch (error) {
    return handleError(error, getCorsHeaders(req));
  }
});

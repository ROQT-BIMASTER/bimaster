import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const InsightsSchema = z
  .object({
    message: z.string().min(1).max(5000),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "ai-insights" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const jsonHeaders = { ...cors, "Content-Type": "application/json" };

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(
          JSON.stringify({ error: "Servidor não configurado" }),
          { status: 503, headers: jsonHeaders }
        );
      }

      const body = await req.json().catch(() => ({}));
      const { message } = validateBody(body, InsightsSchema);

      const sanitizedMessage = message
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .trim();

      if (sanitizedMessage.length === 0) {
        return new Response(
          JSON.stringify({ error: "Mensagem inválida" }),
          { status: 400, headers: jsonHeaders }
        );
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const userId = ctx.userId!;
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      const userRole = roleData?.role;

      let prospectsQuery = supabase
        .from("prospects")
        .select("*")
        .order("created_at", { ascending: false });

      if (userRole === "user") {
        const { data: vinculos } = await supabase
          .from("municipios_usuarios")
          .select("municipio_id")
          .eq("usuario_id", userId);

        const municipiosIds = vinculos?.map((v) => v.municipio_id) || [];

        if (municipiosIds.length > 0) {
          prospectsQuery = prospectsQuery.in("municipio_id", municipiosIds);
        } else {
          prospectsQuery = prospectsQuery.eq("vendedor_id", userId);
        }
      }

      const { data: prospects, error: prospectsError } = await prospectsQuery;
      if (prospectsError) throw prospectsError;

      const totalProspects = prospects?.length || 0;
      const statusCount = prospects?.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const categoriaCount = prospects?.reduce((acc, p) => {
        if (p.categoria) acc[p.categoria] = (acc[p.categoria] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const dataContext = `
Dados atuais do sistema:
- Total de prospects: ${totalProspects}
- Status: ${JSON.stringify(statusCount)}
- Categorias: ${JSON.stringify(categoriaCount)}
- Prospects recentes: ${JSON.stringify(
        prospects?.slice(0, 10).map((p) => ({
          nome: p.nome_empresa,
          status: p.status,
          categoria: p.categoria,
          municipio: p.municipio,
        }))
      )}
`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content: `Você é um assistente de vendas avançado com capacidade de análise profunda de dados.

## SUAS CAPACIDADES:
- Análise estatística e identificação de padrões
- Geração de relatórios estruturados com métricas
- Criação de visualizações em formato de gráfico
- Previsões e recomendações baseadas em dados
- Segmentação inteligente de prospects

## FORMATO DE GRÁFICOS:
Quando apropriado, gere gráficos no formato:
\`\`\`chart
{"type":"bar|line|pie|area","title":"Título","data":[{"name":"Label","value":123}]}
\`\`\`

## FORMATO DE RELATÓRIOS:
Use tabelas markdown, listas organizadas e métricas destacadas.

## DADOS DO SISTEMA:
${dataContext}

Responda sempre em português brasileiro, seja analítico e objetivo.`,
            },
            { role: "user", content: sanitizedMessage },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
            { status: 429, headers: jsonHeaders }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace." }),
            { status: 402, headers: jsonHeaders }
          );
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: "Erro no AI gateway" }),
          { status: 502, headers: jsonHeaders }
        );
      }

      const data = await response.json();
      const aiResponse =
        data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";

      return new Response(
        JSON.stringify({ response: aiResponse }),
        { headers: jsonHeaders }
      );
    }
  )
);

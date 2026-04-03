import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { validateJWT } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z, validateBody, sanitizeString } from "../_shared/validate.ts";
import { handleError } from "../_shared/error-handler.ts";

const ChatSchema = z.object({
  sessionId: z.string().min(1).max(200),
  message: z.string().min(1).max(10000),
  history: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).max(50).optional().default([]),
  department: z.string().max(200).optional(),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await validateJWT(req);
    await checkRateLimit({ prefix: "huggs-agent", limit: 20, req, userId: auth.userId });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { sessionId, message, history, department } = validateBody(body, ChatSchema);

    // Load agent config
    const { data: config } = await supabase
      .from("huggs_agent_config")
      .select("*")
      .limit(1)
      .single();

    if (!config?.is_active) {
      return new Response(
        JSON.stringify({ error: "Agente desativado" }),
        { status: 503, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Build context based on department
    let contextData = "";
    if (department) {
      const { data: deptData } = await supabase
        .from("departamentos")
        .select("*")
        .eq("nome", department)
        .single();

      if (deptData) {
        contextData += `\n\nDepartamento selecionado: ${deptData.nome} (${deptData.codigo})`;
      }
    }

    const systemPrompt = `${config.system_prompt || "Você é o Agente Huggs, um assistente de análise de dados empresariais."}

## Contexto Atual:
- Usuário: ${auth.email}
- Sessão: ${sessionId}
${department ? `- Departamento: ${department}` : ""}
${contextData}

## Instruções:
- Responda de forma clara e objetiva
- Use markdown para formatação
- Quando solicitado relatórios, use tabelas e listas
- Para gráficos, descreva os dados e sugira visualizações
- Sempre ofereça insights acionáveis`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10),
      { role: "user", content: sanitizeString(message, 10000) }
    ];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: config.temperature || 0.7,
        max_tokens: config.max_tokens || 4000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido" }),
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json", "Retry-After": "60" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes" }),
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseContent = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";
    const usage = aiData.usage || {};

    return new Response(
      JSON.stringify({
        response: responseContent,
        contentType: "markdown",
        tokensInput: usage.prompt_tokens || 0,
        tokensOutput: usage.completion_tokens || 0,
        tokensUsed: usage.total_tokens || 0,
        model: "google/gemini-2.5-flash"
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleError(error, getCorsHeaders(req));
  }
});

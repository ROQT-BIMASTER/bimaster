import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatRequest {
  sessionId: string;
  message: string;
  history?: { role: string; content: string }[];
  department?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sessionId, message, history = [], department }: ChatRequest = await req.json();

    // Load agent config
    const { data: config } = await supabase
      .from("huggs_agent_config")
      .select("*")
      .limit(1)
      .single();

    if (!config?.is_active) {
      return new Response(
        JSON.stringify({ error: "Agente desativado" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context based on department
    let contextData = "";
    if (department) {
      // Fetch department-specific data
      const { data: deptData } = await supabase
        .from("departamentos")
        .select("*")
        .eq("nome", department)
        .single();
      
      if (deptData) {
        contextData += `\n\nDepartamento selecionado: ${deptData.nome} (${deptData.codigo})`;
      }
    }

    // Build system prompt
    const systemPrompt = `${config.system_prompt || "Você é o Agente Huggs, um assistente de análise de dados empresariais."}

## Contexto Atual:
- Usuário: ${user.email}
- Sessão: ${sessionId}
${department ? `- Departamento: ${department}` : ""}
${contextData}

## Instruções:
- Responda de forma clara e objetiva
- Use markdown para formatação
- Quando solicitado relatórios, use tabelas e listas
- Para gráficos, descreva os dados e sugira visualizações
- Sempre ofereça insights acionáveis`;

    // Prepare messages for AI
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10), // Keep last 10 messages for context
      { role: "user", content: message }
    ];

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          JSON.stringify({ error: "Rate limit excedido, tente novamente em alguns segundos" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const responseContent = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";
    
    // Extract usage info
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in huggs-agent-chat:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

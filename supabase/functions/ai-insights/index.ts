import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const body = await req.json();
    const { message } = body;
    
    // Input validation
    if (!message || typeof message !== 'string') {
      throw new Error('Message is required and must be a string');
    }
    
    // Length validation
    if (message.length === 0) {
      throw new Error('Message cannot be empty');
    }
    
    if (message.length > 5000) {
      throw new Error('Message too long. Maximum 5000 characters allowed');
    }
    
    // Sanitize message (remove control characters but keep normal text)
    const sanitizedMessage = message
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
      .trim();
    
    if (sanitizedMessage.length === 0) {
      throw new Error('Message contains only invalid characters');
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Get user from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get user ID from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid user token");

    // Get user role from user_roles table
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const userRole = roleData?.role;

    // Fetch prospects data based on user role
    let prospectsQuery = supabase
      .from("prospects")
      .select("*")
      .order("created_at", { ascending: false });

    // Filter by user role - vendedor (user role) sees only their prospects
    // Admin and supervisor roles will see all prospects (no filter applied)
    if (userRole === "user") {
      const { data: vinculos } = await supabase
        .from("municipios_usuarios")
        .select("municipio_id")
        .eq("usuario_id", user.id);

      const municipiosIds = vinculos?.map(v => v.municipio_id) || [];
      
      if (municipiosIds.length > 0) {
        prospectsQuery = prospectsQuery.in("municipio_id", municipiosIds);
      } else {
        prospectsQuery = prospectsQuery.eq("vendedor_id", user.id);
      }
    }

    const { data: prospects, error: prospectsError } = await prospectsQuery;
    if (prospectsError) throw prospectsError;

    // Prepare context with data summary
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
- Prospects recentes: ${JSON.stringify(prospects?.slice(0, 10).map(p => ({
  nome: p.nome_empresa,
  status: p.status,
  categoria: p.categoria,
  municipio: p.municipio
})))}
`;

    console.log("Calling Lovable AI Gateway...");
    
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

Responda sempre em português brasileiro, seja analítico e objetivo.` 
          },
          { role: "user", content: sanitizedMessage }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), 
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos no workspace Lovable AI." }), 
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";

    console.log("AI Response generated successfully");

    return new Response(
      JSON.stringify({ response: aiResponse }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-insights function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

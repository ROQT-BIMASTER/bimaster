import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { brand_id, competitor_ids } = await req.json();

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: "brand_id é obrigatório" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // Get user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }

    // Fetch brand
    const { data: brand, error: brandError } = await supabaseAdmin
      .from("our_brands")
      .select("*")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand) {
      return new Response(JSON.stringify({ error: "Marca não encontrada" }), {
        status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }

    // Fetch competitors
    let competitorsQuery = supabaseAdmin.from("competitors").select("*").eq("active", true);
    if (competitor_ids?.length > 0) {
      competitorsQuery = competitorsQuery.in("id", competitor_ids);
    }
    const { data: competitors } = await competitorsQuery.limit(10);

    // Fetch competitor intelligence
    const competitorNames = (competitors || []).map(c => c.name);
    const { data: intelligence } = await supabaseAdmin
      .from("competitor_intelligence")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    console.log(`🔍 Analisando posicionamento: ${brand.brand_name} vs ${competitors?.length || 0} concorrentes`);

    // Build AI prompt
    const brandInfo = `
Marca Própria: ${brand.brand_name}
Descrição: ${brand.description || "Sem descrição"}
Website: ${brand.website_url || "N/A"}
Categorias: ${brand.categories?.join(", ") || "N/A"}
`;

    const competitorsInfo = (competitors || []).map(c => `
- ${c.name} (Marca: ${c.brand || "N/A"})
  Categoria: ${c.category || "N/A"}
  Market Share: ${c.market_share ? c.market_share + "%" : "N/A"}
  Nível de Ameaça: ${c.threat_level || "N/A"}
  Concorrente Direto: ${c.is_direct_competitor ? "Sim" : "Não"}
`).join("\n");

    const intelligenceInfo = (intelligence || []).slice(0, 20).map(i => 
      `- ${i.competitor_name}: ${i.intel_type} - ${i.description || ""} (${i.source || "campo"})`
    ).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: "Você é um analista de inteligência competitiva e posicionamento de marca. Analise dados de mercado e gere insights estratégicos comparativos detalhados. Sempre responda em português brasileiro."
          },
          {
            role: "user",
            content: `Analise o posicionamento competitivo da seguinte marca em relação aos seus concorrentes.

${brandInfo}

CONCORRENTES:
${competitorsInfo || "Nenhum concorrente cadastrado"}

INTELIGÊNCIA DE CAMPO:
${intelligenceInfo || "Sem dados de campo"}

Gere uma análise completa de posicionamento com:
1. Scores de 0 a 100 para cada marca nos eixos: Preço, Qualidade, Presença Digital, Inovação, Brand Awareness
2. Pontos fortes e fracos de cada marca
3. Oportunidades estratégicas para nossa marca
4. Recomendações de ação
5. Fontes/canais que seriam relevantes pesquisar para aprofundar`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "brand_positioning_analysis",
            description: "Retorna análise estruturada de posicionamento de marca vs concorrentes",
            parameters: {
              type: "object",
              properties: {
                our_brand: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    scores: {
                      type: "object",
                      properties: {
                        preco: { type: "number" },
                        qualidade: { type: "number" },
                        presenca_digital: { type: "number" },
                        inovacao: { type: "number" },
                        brand_awareness: { type: "number" }
                      },
                      required: ["preco", "qualidade", "presenca_digital", "inovacao", "brand_awareness"]
                    },
                    pontos_fortes: { type: "array", items: { type: "string" } },
                    pontos_fracos: { type: "array", items: { type: "string" } }
                  },
                  required: ["name", "scores", "pontos_fortes", "pontos_fracos"]
                },
                competitors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      scores: {
                        type: "object",
                        properties: {
                          preco: { type: "number" },
                          qualidade: { type: "number" },
                          presenca_digital: { type: "number" },
                          inovacao: { type: "number" },
                          brand_awareness: { type: "number" }
                        },
                        required: ["preco", "qualidade", "presenca_digital", "inovacao", "brand_awareness"]
                      },
                      pontos_fortes: { type: "array", items: { type: "string" } },
                      pontos_fracos: { type: "array", items: { type: "string" } }
                    },
                    required: ["name", "scores", "pontos_fortes", "pontos_fracos"]
                  }
                },
                oportunidades: { type: "array", items: { type: "string" } },
                recomendacoes: { type: "array", items: { type: "string" } },
                fontes_sugeridas: { type: "array", items: { type: "string" } },
                resumo_executivo: { type: "string" }
              },
              required: ["our_brand", "competitors", "oportunidades", "recomendacoes", "fontes_sugeridas", "resumo_executivo"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "brand_positioning_analysis" } }
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      throw new Error("Erro na análise de IA");
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("IA não retornou dados estruturados");

    const analysisResult = JSON.parse(toolCall.function.arguments);
    console.log("✅ Análise concluída");

    // Persist
    const { data: saved, error: saveError } = await supabaseAdmin
      .from("brand_positioning_analyses")
      .insert({
        user_id: user.id,
        our_brand_id: brand_id,
        competitor_ids: competitor_ids || (competitors || []).map((c: any) => c.id),
        analysis_result: analysisResult,
        sources_searched: analysisResult.fontes_sugeridas || [],
      })
      .select()
      .single();

    if (saveError) console.error("Erro ao salvar:", saveError);

    return new Response(JSON.stringify({
      success: true,
      analysis: analysisResult,
      analysis_id: saved?.id,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Erro:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erro desconhecido"
    }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });
  }
});

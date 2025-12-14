import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `Você é um assistente especializado em filtrar dados de Trade Marketing.
O usuário vai descrever o que quer ver em linguagem natural, e você deve retornar critérios de filtro estruturados.

Retorne um objeto JSON com os seguintes campos possíveis:
{
  "dateRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "status": ["status1", "status2"],
  "type": "tipo",
  "aiProcessed": true/false,
  "priority": "alta/media/baixa",
  "category": "categoria",
  "completed": true/false,
  "timeframe": "hoje/semana/mes"
}

Exemplos:
- "visitas da última semana" → { "timeframe": "semana", "entityType": "visits" }
- "promoções ativas" → { "status": ["active"], "entityType": "promotions" }
- "fotos não processadas pela IA" → { "aiProcessed": false, "entityType": "photos" }
- "investimentos pendentes de aprovação" → { "status": ["pending"], "entityType": "investments" }
- "concorrentes de ameaça alta" → { "priority": "alta", "entityType": "competitors" }`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido, tente novamente em alguns instantes" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Extract JSON from response
    let criteria;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      criteria = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      criteria = {};
    }

    return new Response(
      JSON.stringify({ criteria, rawQuery: query }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in ai-filter function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

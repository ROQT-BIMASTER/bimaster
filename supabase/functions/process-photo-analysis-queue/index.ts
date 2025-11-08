import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurado");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar até 5 itens pendentes na fila
    const { data: queueItems, error: fetchError } = await supabase
      .from("photo_analysis_queue")
      .select("*")
      .eq("status", "pending")
      .lt("attempts", 3)
      .order("created_at", { ascending: true })
      .limit(5);

    if (fetchError) throw fetchError;

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhum item na fila", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processando ${queueItems.length} itens da fila`);

    const results = await Promise.allSettled(
      queueItems.map(async (item) => {
        try {
          // Marcar como processando
          await supabase
            .from("photo_analysis_queue")
            .update({ 
              status: "processing", 
              attempts: item.attempts + 1 
            })
            .eq("id", item.id);

          // Usar URL diretamente (já é pública)
          const photoUrl = item.photo_url;

          // Chamar API de análise
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `Você é um especialista em análise de Trade Marketing. 
Analise a foto de gôndola e forneça insights sobre:
1. Produtos visíveis e share de prateleira
2. Qualidade da exposição
3. Oportunidades de melhoria
4. Problemas identificados

Seja específico e objetivo. Retorne em formato JSON com as chaves:
- insights: string resumida
- products_detected: array de nomes de produtos
- our_facings: número estimado de faces dos nossos produtos
- competitor_facings: número estimado de faces concorrentes
- issues: array de problemas encontrados
- compliance_score: nota de 0-100`
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Analise esta foto de gôndola:"
                    },
                    {
                      type: "image_url",
                      image_url: { url: photoUrl }
                    }
                  ]
                }
              ],
              max_tokens: 1000,
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`Erro na API: ${errorText}`);
          }

          const aiData = await aiResponse.json();
          const analysisText = aiData.choices?.[0]?.message?.content || "";

          // Tentar extrair JSON do texto
          let analysisResult;
          try {
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            analysisResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { insights: analysisText };
          } catch {
            analysisResult = { insights: analysisText };
          }

          // Atualizar foto com resultado
          await supabase
            .from("photos")
            .update({
              ai_processed: true,
              ai_analysis: analysisResult,
            })
            .eq("id", item.photo_id);

          // Marcar como concluído na fila
          await supabase
            .from("photo_analysis_queue")
            .update({
              status: "completed",
              result: analysisResult,
              processed_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          console.log(`✅ Foto ${item.photo_id} analisada com sucesso`);
          return { success: true, photoId: item.photo_id };
        } catch (error: any) {
          console.error(`❌ Erro ao processar ${item.photo_id}:`, error);

          // Marcar como falho
          await supabase
            .from("photo_analysis_queue")
            .update({
              status: item.attempts >= 2 ? "failed" : "pending",
              error_message: error.message,
            })
            .eq("id", item.id);

          return { success: false, photoId: item.photo_id, error: error.message };
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failed = results.length - successful;

    return new Response(
      JSON.stringify({
        message: "Processamento concluído",
        processed: results.length,
        successful,
        failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro no processamento:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

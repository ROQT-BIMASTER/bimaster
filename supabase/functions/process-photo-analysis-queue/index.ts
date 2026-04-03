import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Verify secret token for background processor security
    const queueSecret = Deno.env.get('QUEUE_PROCESSOR_SECRET');
    const requestSecret = req.headers.get('x-queue-secret');

    if (!queueSecret) {
      console.error('❌ QUEUE_PROCESSOR_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Queue processor secret not configured' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    if (requestSecret !== queueSecret) {
      console.error('❌ Invalid queue processor secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Queue processor authentication verified');
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
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
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

          // Chamar API de análise com tool calling para estrutura robusta
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
                  content: `Você é um especialista em análise de Trade Marketing e merchandising no ponto de venda.
Sua função é analisar fotos de gôndolas e prateleiras para identificar:
1. Produtos visíveis, marcas e categorias
2. Share de prateleira (espaço ocupado por cada marca)
3. Qualidade da exposição e organização
4. Precificação e promoções visíveis
5. Problemas como rupturas, produtos mal posicionados ou vencidos
6. Oportunidades de melhoria na execução

Seja objetivo, específico e forneça métricas quando possível.`
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Analise esta foto de gôndola/prateleira de loja e forneça insights detalhados sobre a execução de trade marketing:"
                    },
                    {
                      type: "image_url",
                      image_url: { url: photoUrl }
                    }
                  ]
                }
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "analyze_shelf_photo",
                    description: "Retorna análise estruturada de uma foto de gôndola/prateleira",
                    parameters: {
                      type: "object",
                      properties: {
                        insights: {
                          type: "string",
                          description: "Resumo executivo da análise em 2-3 frases"
                        },
                        products_detected: {
                          type: "array",
                          items: { type: "string" },
                          description: "Lista de produtos/marcas identificados na foto"
                        },
                        our_facings: {
                          type: "number",
                          description: "Número estimado de faces dos produtos da empresa (Ruby Rose, Melu, etc)"
                        },
                        competitor_facings: {
                          type: "number",
                          description: "Número estimado de faces de produtos concorrentes"
                        },
                        shelf_share_percentage: {
                          type: "number",
                          description: "Porcentagem estimada do espaço de prateleira ocupado pelos nossos produtos (0-100)"
                        },
                        issues: {
                          type: "array",
                          items: { type: "string" },
                          description: "Problemas identificados (rupturas, má organização, precificação incorreta, etc)"
                        },
                        opportunities: {
                          type: "array",
                          items: { type: "string" },
                          description: "Oportunidades de melhoria identificadas"
                        },
                        compliance_score: {
                          type: "number",
                          description: "Nota de conformidade da execução de 0 a 100"
                        },
                        quality_assessment: {
                          type: "string",
                          enum: ["excelente", "bom", "regular", "ruim"],
                          description: "Avaliação geral da qualidade da exposição"
                        },
                        has_promotion: {
                          type: "boolean",
                          description: "Se há promoções visíveis na foto"
                        },
                        has_rupture: {
                          type: "boolean",
                          description: "Se há rupturas (espaços vazios) visíveis"
                        }
                      },
                      required: ["insights", "products_detected", "compliance_score", "quality_assessment"]
                    }
                  }
                }
              ],
              tool_choice: { type: "function", function: { name: "analyze_shelf_photo" } },
              max_tokens: 1500,
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            console.error(`❌ AI API error: ${errorText}`);
            throw new Error(`Erro na API de IA: ${aiResponse.status}`);
          }

          const aiData = await aiResponse.json();
          
          // Extract tool call result
          let analysisResult;
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          
          if (toolCall && toolCall.function?.arguments) {
            try {
              analysisResult = JSON.parse(toolCall.function.arguments);
              console.log(`✅ Tool call parsed successfully for photo ${item.photo_id}`);
            } catch (parseError) {
              console.error(`⚠️ Failed to parse tool call arguments:`, parseError);
              // Fallback to content extraction
              const content = aiData.choices?.[0]?.message?.content || "";
              analysisResult = { insights: content, compliance_score: 50 };
            }
          } else {
            // Fallback: try to extract from content
            const content = aiData.choices?.[0]?.message?.content || "";
            console.log(`⚠️ No tool call found, using content fallback for photo ${item.photo_id}`);
            
            // Try to extract JSON from markdown code blocks
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                analysisResult = JSON.parse(jsonStr.trim());
              } catch {
                analysisResult = { insights: content, compliance_score: 50 };
              }
            } else {
              analysisResult = { insights: content, compliance_score: 50 };
            }
          }
          
          // Ensure required fields exist
          analysisResult = {
            insights: analysisResult.insights || "Análise não disponível",
            products_detected: analysisResult.products_detected || [],
            our_facings: analysisResult.our_facings || 0,
            competitor_facings: analysisResult.competitor_facings || 0,
            shelf_share_percentage: analysisResult.shelf_share_percentage || 0,
            issues: analysisResult.issues || [],
            opportunities: analysisResult.opportunities || [],
            compliance_score: analysisResult.compliance_score || 50,
            quality_assessment: analysisResult.quality_assessment || "regular",
            has_promotion: analysisResult.has_promotion || false,
            has_rupture: analysisResult.has_rupture || false,
          };

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
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro no processamento:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { meetingId, transcription: providedTranscription } = await req.json();

    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status
    await supabaseAdmin.from("meetings").update({ status: "processing" }).eq("id", meetingId);

    // Get meeting data
    const { data: meetingData, error: meetingError } = await supabaseAdmin
      .from("meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meetingData) {
      throw new Error("Reunião não encontrada");
    }

    let transcription = providedTranscription || meetingData.transcription;

    // ============ STEP 1: TRANSCRIBE AUDIO IF NEEDED ============
    if (!transcription && meetingData.audio_url) {
      console.log("[meeting-analyze] No transcription found, transcribing audio...");

      // Download audio from storage
      // Extract the file path from the signed URL or audio_url
      const audioUrl = meetingData.audio_url as string;
      let audioBase64: string | null = null;

      try {
        // Download the audio via the signed URL
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) {
          throw new Error(`Failed to download audio: ${audioResponse.status}`);
        }

        const audioBuffer = await audioResponse.arrayBuffer();
        audioBase64 = base64Encode(new Uint8Array(audioBuffer));
        console.log("[meeting-analyze] Audio downloaded, size:", audioBuffer.byteLength, "bytes");
      } catch (downloadErr) {
        console.error("[meeting-analyze] Audio download error:", downloadErr);
        throw new Error("Erro ao baixar áudio para transcrição. Tente colar a transcrição manualmente.");
      }

      if (audioBase64) {
        // Send audio to Gemini for transcription
        const transcribeResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `Você é um transcritor profissional de áudio. Transcreva o áudio fornecido de forma precisa e completa em português do Brasil. 
Inclua:
- Tudo que foi falado, palavra por palavra
- Identificação de diferentes falantes quando possível (Falante 1, Falante 2, etc.)
- Pausas significativas marcadas com [pausa]
Não adicione interpretações, resumos ou comentários. Apenas a transcrição fiel do que foi dito.`,
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Transcreva completamente este áudio de reunião. Retorne APENAS a transcrição, sem comentários adicionais.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:audio/webm;base64,${audioBase64}`,
                    },
                  },
                ],
              },
            ],
            temperature: 0.1,
          }),
        });

        if (!transcribeResponse.ok) {
          const errText = await transcribeResponse.text();
          console.error("[meeting-analyze] Transcription error:", transcribeResponse.status, errText);
          
          if (transcribeResponse.status === 429) {
            await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
            return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (transcribeResponse.status === 402) {
            await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
            return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw new Error("Erro na transcrição do áudio");
        }

        const transcribeData = await transcribeResponse.json();
        transcription = transcribeData.choices?.[0]?.message?.content?.trim();
        console.log("[meeting-analyze] Transcription completed, length:", transcription?.length || 0);

        if (!transcription || transcription.length < 10) {
          await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
          return new Response(JSON.stringify({ error: "Não foi possível transcrever o áudio. O áudio pode estar vazio ou muito curto. Tente colar a transcrição manualmente." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Save transcription
        await supabaseAdmin.from("meetings").update({
          transcription,
          updated_at: new Date().toISOString(),
        }).eq("id", meetingId);
      }
    }

    if (!transcription) {
      await supabaseAdmin.from("meetings").update({ status: "draft" }).eq("id", meetingId);
      return new Response(JSON.stringify({ error: "Nenhuma transcrição ou áudio disponível para análise." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ STEP 2: ANALYZE TRANSCRIPTION ============
    console.log("[meeting-analyze] Starting analysis, transcription length:", transcription.length);

    // Get departments
    const { data: departments } = await supabaseAdmin.from("departamentos").select("nome").eq("ativo", true);
    const deptNames = departments?.map((d: any) => d.nome).join(", ") || "Comercial, Marketing, Operações, Financeiro, Tecnologia, Produto";

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um analista de reuniões corporativas. Analise a transcrição fornecida e extraia informações estruturadas. Use os departamentos disponíveis na empresa: ${deptNames}. Responda SEMPRE em português do Brasil.`,
          },
          {
            role: "user",
            content: `Analise esta transcrição de reunião:\n\n${transcription}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_meeting",
              description: "Analisa a reunião e retorna dados estruturados com resumo, insights, tarefas e riscos.",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Resumo executivo da reunião em 2-4 parágrafos, baseado fielmente no que foi discutido",
                  },
                  mindmap_data: {
                    type: "object",
                    description: "Mapa mental estruturado em JSON com root e children. Cada child tem label, type (problema|oportunidade|decisao|tarefa|risco) e opcionalmente children.",
                    properties: {
                      root: { type: "string", description: "Tema central da reunião" },
                      children: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label: { type: "string" },
                            type: { type: "string", enum: ["problema", "oportunidade", "decisao", "tarefa", "risco"] },
                            children: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  label: { type: "string" },
                                  type: { type: "string", enum: ["problema", "oportunidade", "decisao", "tarefa", "risco"] },
                                },
                                required: ["label", "type"],
                              },
                            },
                          },
                          required: ["label", "type"],
                        },
                      },
                    },
                    required: ["root", "children"],
                  },
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        insight_type: { type: "string", enum: ["risco", "oportunidade", "decisao", "bloqueio", "problema"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        department: { type: "string" },
                        impact_level: { type: "string", enum: ["baixo", "medio", "alto", "critico"] },
                        urgency_level: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
                      },
                      required: ["insight_type", "title", "description"],
                    },
                  },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        task: { type: "string" },
                        department: { type: "string" },
                        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                      },
                      required: ["task"],
                    },
                  },
                  risks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        department: { type: "string" },
                        risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        impact_level: { type: "string", enum: ["baixo", "medio", "alto", "critico"] },
                        urgency_level: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
                        recommended_action: { type: "string" },
                      },
                      required: ["title", "description", "risk_level"],
                    },
                  },
                },
                required: ["summary", "mermaid_mindmap", "insights", "tasks", "risks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_meeting" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[meeting-analyze] AI Gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let analysis: any;

    if (toolCall?.function?.arguments) {
      let argsStr = toolCall.function.arguments;
      if (typeof argsStr === "string") {
        argsStr = argsStr.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        analysis = JSON.parse(argsStr);
      } else {
        analysis = argsStr;
      }
    } else {
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const jsonStart = cleaned.search(/[\{\[]/);
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        }
        analysis = JSON.parse(cleaned);
      } else {
        throw new Error("IA não retornou dados estruturados");
      }
    }

    console.log("[meeting-analyze] Analysis parsed OK:", {
      summary: !!analysis.summary,
      insights: analysis.insights?.length,
      tasks: analysis.tasks?.length,
      risks: analysis.risks?.length,
    });

    // ============ STEP 3: SAVE RESULTS ============

    // Save summary and mindmap
    await supabaseAdmin.from("meetings").update({
      transcription: transcription,
      summary: analysis.summary,
      mermaid_mindmap: analysis.mermaid_mindmap,
      status: "analyzed",
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    // Delete old insights/tasks/risks for re-analysis
    await Promise.all([
      supabaseAdmin.from("meeting_insights").delete().eq("meeting_id", meetingId),
      supabaseAdmin.from("meeting_tasks").delete().eq("meeting_id", meetingId),
      supabaseAdmin.from("meeting_risks").delete().eq("meeting_id", meetingId),
    ]);

    // Insert insights
    if (analysis.insights?.length > 0) {
      const insightsRows = analysis.insights.map((i: any) => ({
        meeting_id: meetingId,
        insight_type: i.insight_type,
        title: i.title,
        description: i.description,
        department: i.department || null,
        impact_level: i.impact_level || null,
        urgency_level: i.urgency_level || null,
      }));
      await supabaseAdmin.from("meeting_insights").insert(insightsRows);
    }

    // Insert tasks
    if (analysis.tasks?.length > 0) {
      const tasksRows = analysis.tasks.map((t: any) => ({
        meeting_id: meetingId,
        task: t.task,
        department: t.department || null,
        priority: t.priority || "medium",
      }));
      await supabaseAdmin.from("meeting_tasks").insert(tasksRows);
    }

    // Insert risks
    if (analysis.risks?.length > 0) {
      const risksRows = analysis.risks.map((r: any) => ({
        meeting_id: meetingId,
        title: r.title,
        description: r.description,
        department: r.department || null,
        risk_level: r.risk_level || "medium",
        impact_level: r.impact_level || null,
        urgency_level: r.urgency_level || null,
        recommended_action: r.recommended_action || null,
      }));
      await supabaseAdmin.from("meeting_risks").insert(risksRows);
    }

    // Notify about HIGH/CRITICAL risks
    const highRisks = (analysis.risks || []).filter((r: any) => r.risk_level === "high" || r.risk_level === "critical");
    if (highRisks.length > 0) {
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "meeting_risk",
        title: `⚠️ ${highRisks.length} risco(s) identificado(s)`,
        message: `A análise da reunião "${meetingData.title}" identificou ${highRisks.length} risco(s) de nível alto/crítico.`,
        action_url: `/dashboard/reunioes/${meetingId}`,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      transcribed: !providedTranscription && !meetingData.transcription,
      summary: analysis.summary,
      insights_count: analysis.insights?.length || 0,
      tasks_count: analysis.tasks?.length || 0,
      risks_count: analysis.risks?.length || 0,
      high_risks_count: highRisks.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[meeting-analyze] error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro ao analisar reunião" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { meetingId, transcription: providedTranscription } = await req.json();
    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("meetings").update({ status: "processing" }).eq("id", meetingId);

    const { data: meetingData, error: meetingError } = await supabaseAdmin
      .from("meetings").select("*").eq("id", meetingId).single();
    if (meetingError || !meetingData) throw new Error("Reunião não encontrada");

    let transcription = providedTranscription || meetingData.transcription;

    // ============ STEP 1: TRANSCRIBE AUDIO/VIDEO IF NEEDED ============
    if (!transcription && meetingData.audio_url) {
      console.log("[meeting-analyze] No transcription found, transcribing media...");
      const audioUrl = meetingData.audio_url as string;
      let audioBase64: string | null = null;

      try {
        const audioResponse = await fetch(audioUrl);
        if (!audioResponse.ok) throw new Error(`Failed to download media: ${audioResponse.status}`);
        const audioBuffer = await audioResponse.arrayBuffer();
        audioBase64 = base64Encode(new Uint8Array(audioBuffer));
        console.log("[meeting-analyze] Media downloaded, size:", audioBuffer.byteLength, "bytes");
      } catch (downloadErr) {
        console.error("[meeting-analyze] Media download error:", downloadErr);
        throw new Error("Erro ao baixar mídia para transcrição. Tente colar a transcrição manualmente.");
      }

      if (audioBase64) {
        // Detect MIME type from URL
        const isVideo = audioUrl.includes(".mp4") || audioUrl.includes(".mov") || audioUrl.includes(".avi") || audioUrl.includes(".mkv");
        const mimeType = isVideo ? "video/mp4" : "audio/webm";

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
                content: `Você é um transcritor profissional de áudio/vídeo com capacidade de DIARIZAÇÃO (identificação de falantes).

REGRAS DE TRANSCRIÇÃO:
1. Transcreva tudo que foi falado, palavra por palavra, em português do Brasil
2. IDENTIFIQUE CADA FALANTE DISTINTO — quando o nome é mencionado na conversa, use o nome real (ex: "João:", "Maria:")
3. Se o nome não for mencionado, use "Falante 1:", "Falante 2:", etc.
4. Indique mudanças de falante em cada fala
5. Marque pausas significativas com [pausa]
6. Inclua timestamps aproximados a cada 1-2 minutos no formato [MM:SS]
7. NÃO adicione interpretações, resumos ou comentários

FORMATO:
[00:00] João: Bom dia a todos, vamos começar a reunião...
[00:15] Maria: Obrigada João, eu queria falar sobre...`,
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Transcreva completamente este áudio/vídeo de reunião com identificação de cada falante. Retorne APENAS a transcrição diarizada." },
                  { type: "image_url", image_url: { url: `data:${mimeType};base64,${audioBase64}` } },
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
          throw new Error("Erro na transcrição da mídia");
        }

        const transcribeData = await transcribeResponse.json();
        transcription = transcribeData.choices?.[0]?.message?.content?.trim();
        console.log("[meeting-analyze] Transcription completed, length:", transcription?.length || 0);

        if (!transcription || transcription.length < 10) {
          await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
          return new Response(JSON.stringify({ error: "Não foi possível transcrever a mídia. Tente colar a transcrição manualmente." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabaseAdmin.from("meetings").update({
          transcription, updated_at: new Date().toISOString(),
        }).eq("id", meetingId);
      }
    }

    if (!transcription) {
      await supabaseAdmin.from("meetings").update({ status: "draft" }).eq("id", meetingId);
      return new Response(JSON.stringify({ error: "Nenhuma transcrição ou mídia disponível para análise." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ STEP 2: ANALYZE TRANSCRIPTION ============
    console.log("[meeting-analyze] Starting analysis, transcription length:", transcription.length);

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
            content: `Você é um analista de reuniões corporativas especializado em gerar análises profundas e atas formais. Analise a transcrição e extraia TODAS as informações estruturadas. Use os departamentos: ${deptNames}. Responda SEMPRE em português do Brasil.

IMPORTANTE para o MAPA MENTAL:
- Crie uma hierarquia PROFUNDA com 3-4 níveis de profundidade
- Use categorias intermediárias (tipo "processo") para agrupar subtemas
- Cada ramo deve ter 2-5 sub-itens detalhados
- Labels devem ser descritivos (frases curtas, não apenas uma palavra)
- Inclua TODOS os temas discutidos na reunião

IMPORTANTE para a ATA:
- Formato profissional de ata corporativa em Markdown
- Inclua: Data, Participantes, Pauta, Discussões, Deliberações, Encaminhamentos (com responsáveis), Próximos Passos

IMPORTANTE para HIGHLIGHTS (momentos importantes):
- Identifique 5-15 momentos-chave da reunião (decisões, conflitos, ideias, problemas levantados)
- Para cada momento, estime o timestamp em segundos baseado nos timestamps [MM:SS] da transcrição
- Se não houver timestamps, distribua proporcionalmente ao longo do texto
- Cada highlight deve ter: label descritivo, timestamp em segundos, tipo e falante`,
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
              description: "Analisa reunião e retorna dados estruturados completos incluindo ata formal e mapa mental profundo.",
              parameters: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "Resumo executivo da reunião em 2-4 parágrafos",
                  },
                  ata: {
                    type: "string",
                    description: "Ata formal da reunião em formato Markdown com seções: ## Participantes, ## Pauta, ## Discussões, ## Deliberações, ## Encaminhamentos (com responsáveis e prazos), ## Próximos Passos",
                  },
                  participants: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Nome do participante identificado" },
                        role: { type: "string", description: "Cargo ou papel na reunião, se identificável" },
                      },
                      required: ["name"],
                    },
                    description: "Lista de participantes identificados na reunião",
                  },
                  mindmap_data: {
                    type: "object",
                    description: "Mapa mental profundo com 3-4 níveis. Cada nó tem label, type e opcionalmente children.",
                    properties: {
                      root: { type: "string", description: "Tema central da reunião" },
                      children: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label: { type: "string" },
                            type: { type: "string", enum: ["problema", "oportunidade", "decisao", "tarefa", "risco", "processo"] },
                            children: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  label: { type: "string" },
                                  type: { type: "string", enum: ["problema", "oportunidade", "decisao", "tarefa", "risco", "processo"] },
                                  children: {
                                    type: "array",
                                    items: {
                                      type: "object",
                                      properties: {
                                        label: { type: "string" },
                                        type: { type: "string", enum: ["problema", "oportunidade", "decisao", "tarefa", "risco", "processo"] },
                                      },
                                      required: ["label", "type"],
                                    },
                                  },
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
                required: ["summary", "ata", "participants", "mindmap_data", "insights", "tasks", "risks"],
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
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
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
        if (jsonStart !== -1 && jsonEnd !== -1) cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        analysis = JSON.parse(cleaned);
      } else {
        throw new Error("IA não retornou dados estruturados");
      }
    }

    console.log("[meeting-analyze] Analysis parsed OK:", {
      summary: !!analysis.summary, ata: !!analysis.ata,
      participants: analysis.participants?.length,
      insights: analysis.insights?.length, tasks: analysis.tasks?.length, risks: analysis.risks?.length,
    });

    // ============ STEP 3: SAVE RESULTS ============
    await supabaseAdmin.from("meetings").update({
      transcription,
      summary: analysis.summary,
      ata: analysis.ata || null,
      participants: analysis.participants || null,
      mermaid_mindmap: JSON.stringify(analysis.mindmap_data),
      status: "analyzed",
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    // Delete old insights/tasks/risks for re-analysis
    await Promise.all([
      supabaseAdmin.from("meeting_insights").delete().eq("meeting_id", meetingId),
      supabaseAdmin.from("meeting_tasks").delete().eq("meeting_id", meetingId),
      supabaseAdmin.from("meeting_risks").delete().eq("meeting_id", meetingId),
    ]);

    if (analysis.insights?.length > 0) {
      await supabaseAdmin.from("meeting_insights").insert(
        analysis.insights.map((i: any) => ({
          meeting_id: meetingId, insight_type: i.insight_type, title: i.title,
          description: i.description, department: i.department || null,
          impact_level: i.impact_level || null, urgency_level: i.urgency_level || null,
        }))
      );
    }

    if (analysis.tasks?.length > 0) {
      await supabaseAdmin.from("meeting_tasks").insert(
        analysis.tasks.map((t: any) => ({
          meeting_id: meetingId, task: t.task, department: t.department || null, priority: t.priority || "medium",
        }))
      );
    }

    if (analysis.risks?.length > 0) {
      await supabaseAdmin.from("meeting_risks").insert(
        analysis.risks.map((r: any) => ({
          meeting_id: meetingId, title: r.title, description: r.description,
          department: r.department || null, risk_level: r.risk_level || "medium",
          impact_level: r.impact_level || null, urgency_level: r.urgency_level || null,
          recommended_action: r.recommended_action || null,
        }))
      );
    }

    // Notify about HIGH/CRITICAL risks
    const highRisks = (analysis.risks || []).filter((r: any) => r.risk_level === "high" || r.risk_level === "critical");
    if (highRisks.length > 0) {
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id, type: "meeting_risk",
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

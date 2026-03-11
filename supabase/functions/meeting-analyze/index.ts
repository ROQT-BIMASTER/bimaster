import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(lovableApiKey: string, messages: any[], tools: any[], toolName: string, timeoutMs = 120000, model = "google/gemini-2.5-pro", temperature?: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: any = {
      model,
      messages,
      tools,
      tool_choice: { type: "function", function: { name: toolName } },
    };
    if (temperature !== undefined) body.temperature = temperature;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

function parseToolCallResult(aiData: any): any {
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    let argsStr = toolCall.function.arguments;
    if (typeof argsStr === "string") {
      argsStr = argsStr.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      return JSON.parse(argsStr);
    }
    return argsStr;
  }
  const content = aiData.choices?.[0]?.message?.content;
  if (content) {
    let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const jsonStart = cleaned.search(/[\{\[]/);
    const jsonEnd = cleaned.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    return JSON.parse(cleaned);
  }
  throw new Error("IA não retornou dados estruturados");
}

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

    const { meetingId, transcription: providedTranscription, duration_seconds: providedDuration } = await req.json();
    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("meetings").update({ status: "processing", progress: 85, progress_detail: "Preparando análise..." }).eq("id", meetingId);

    const { data: meetingData, error: meetingError } = await supabaseAdmin
      .from("meetings").select("*").eq("id", meetingId).single();
    if (meetingError || !meetingData) throw new Error("Reunião não encontrada");

    const transcription = providedTranscription || meetingData.transcription;

    if (!transcription) {
      await supabaseAdmin.from("meetings").update({ status: "draft" }).eq("id", meetingId);
      return new Response(JSON.stringify({ error: "Nenhuma transcrição disponível. Use a etapa de transcrição primeiro." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Support up to ~1h of audio transcription (350K chars for diarized text)
    const MAX_TRANSCRIPTION_CHARS = 350000;
    let analysisTranscription = transcription;
    if (transcription.length > MAX_TRANSCRIPTION_CHARS) {
      const halfLimit = Math.floor(MAX_TRANSCRIPTION_CHARS / 2);
      analysisTranscription = transcription.substring(0, halfLimit)
        + "\n\n[... parte central da transcrição omitida por tamanho — total: " + transcription.length + " caracteres ...]\n\n"
        + transcription.substring(transcription.length - halfLimit);
      console.log(`[meeting-analyze] Transcription truncated: ${transcription.length} → ${analysisTranscription.length} chars`);
    }

    // ========================================================================
    // PHASE 1 ONLY: Structural Analysis (summary, ata, participants, mindmap)
    // Phase 2 is now a separate edge function (meeting-analyze-phase2)
    // ========================================================================
    await supabaseAdmin.from("meetings").update({ progress: 88, progress_detail: "Fase 1: Gerando ata e mapa mental..." }).eq("id", meetingId);

    const estimatedMinutes = providedDuration
      ? Math.max(5, Math.round(providedDuration / 60))
      : meetingData.duration_seconds 
        ? Math.max(5, Math.round(meetingData.duration_seconds / 60))
        : Math.max(5, Math.round(analysisTranscription.length / 650));
    const minAtaWords = Math.max(500, Math.round(estimatedMinutes * 100));

    console.log(`[meeting-analyze] Phase 1 analysis, transcription length: ${analysisTranscription.length}, estimated duration: ${estimatedMinutes} min`);

    const phase1Messages = [
      {
        role: "system",
        content: `Você é um analista sênior de reuniões corporativas. Gere uma ata formal COMPLETA e um mapa mental PROFUNDO da reunião. Analise a transcrição INTEIRA do início ao fim. Responda SEMPRE em português do Brasil.

DURAÇÃO ESTIMADA DA REUNIÃO: ~${estimatedMinutes} minutos.

IMPORTANTE para a ATA (MÍNIMO ${minAtaWords} palavras):
- Formato profissional de ata corporativa em Markdown
- Inclua: Data, Participantes, Pauta, Discussões detalhadas, Deliberações, Encaminhamentos (com responsáveis), Próximos Passos
- Cada tema discutido deve ter 3-5 PARÁGRAFOS de detalhamento — não resuma em uma frase
- Cite falas específicas dos participantes quando relevante
- A ata deve cobrir TODOS os assuntos discutidos, do início ao fim da transcrição
- Para cada 5 minutos de reunião, deve haver pelo menos 500 palavras na ata

IMPORTANTE para o MAPA MENTAL:
- Crie uma hierarquia PROFUNDA com 3-4 níveis de profundidade
- Use categorias intermediárias (tipo "processo") para agrupar subtemas
- Cada ramo deve ter 2-5 sub-itens detalhados
- Labels devem ser descritivos (frases curtas, não apenas uma palavra)
- Inclua TODOS os temas discutidos na reunião
- Para reuniões de ${estimatedMinutes}min, espera-se pelo menos ${Math.max(4, Math.round(estimatedMinutes / 3))} ramos principais

IMPORTANTE para PARTICIPANTES:
- Identifique TODOS os participantes mencionados na transcrição
- Infira o cargo/papel de cada um com base no contexto

INSTRUÇÃO CRÍTICA: Releia a transcrição INTEIRA antes de finalizar. Verifique se cobriu cada tópico. NÃO produza uma ata superficial.`,
      },
      {
        role: "user",
        content: `Analise esta transcrição de reunião (~${estimatedMinutes} minutos) e gere a ata completa (mínimo ${minAtaWords} palavras), resumo executivo, participantes e mapa mental profundo:\n\n${analysisTranscription}`,
      },
    ];

    const phase1Tools = [
      {
        type: "function",
        function: {
          name: "phase1_analysis",
          description: "Retorna ata formal, resumo executivo, participantes e mapa mental profundo da reunião.",
          parameters: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "Resumo executivo da reunião em 3-5 parágrafos detalhados",
              },
              ata: {
                type: "string",
                description: "Ata formal COMPLETA da reunião em formato Markdown com seções: ## Participantes, ## Pauta, ## Discussões (detalhadas para cada tema), ## Deliberações, ## Encaminhamentos (com responsáveis e prazos), ## Próximos Passos",
              },
              participants: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Nome do participante identificado" },
                    role: { type: "string", description: "Cargo ou papel na reunião" },
                  },
                  required: ["name"],
                },
              },
              mindmap_data: {
                type: "object",
                description: "Mapa mental profundo com 3-4 níveis.",
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
            },
            required: ["summary", "ata", "participants", "mindmap_data"],
            additionalProperties: false,
          },
        },
      },
    ];

    let phase1Response: Response;
    try {
      phase1Response = await callAI(lovableApiKey, phase1Messages, phase1Tools, "phase1_analysis", 180000);
    } catch (abortErr) {
      console.error("[meeting-analyze] Phase 1 timeout:", abortErr);
      await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
      return new Response(JSON.stringify({ error: "Timeout na Fase 1 da análise. Tente novamente." }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!phase1Response.ok) {
      const errorText = await phase1Response.text();
      console.error("[meeting-analyze] Phase 1 AI error:", phase1Response.status, errorText);
      if (phase1Response.status === 429) {
        await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (phase1Response.status === 402) {
        await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Phase 1 AI error: ${phase1Response.status}`);
    }

    const phase1Data = await phase1Response.json();
    const phase1Result = parseToolCallResult(phase1Data);

    console.log("[meeting-analyze] Phase 1 OK:", {
      summary: !!phase1Result.summary,
      ata: !!phase1Result.ata,
      ataLength: phase1Result.ata?.length || 0,
      participants: phase1Result.participants?.length,
      mindmapChildren: phase1Result.mindmap_data?.children?.length,
    });

    // Save Phase 1 results — set status to "phase1_complete" so frontend knows to call Phase 2
    await supabaseAdmin.from("meetings").update({
      summary: phase1Result.summary,
      ata: phase1Result.ata || null,
      participants: phase1Result.participants || null,
      mermaid_mindmap: JSON.stringify(phase1Result.mindmap_data),
      progress: 92,
      progress_detail: "Fase 1 concluída! Iniciando extração de insights...",
      status: "phase1_complete",
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    return new Response(JSON.stringify({
      success: true,
      phase: 1,
      summary: phase1Result.summary,
      estimatedMinutes,
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

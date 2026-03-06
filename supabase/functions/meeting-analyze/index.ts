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

    const { meetingId, transcription: providedTranscription } = await req.json();
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

    console.log("[meeting-analyze] Starting 2-phase analysis, transcription length:", transcription.length);

    // Support up to ~1h of audio transcription (200K chars)
    const MAX_TRANSCRIPTION_CHARS = 200000;
    let analysisTranscription = transcription;
    if (transcription.length > MAX_TRANSCRIPTION_CHARS) {
      const halfLimit = Math.floor(MAX_TRANSCRIPTION_CHARS / 2);
      analysisTranscription = transcription.substring(0, halfLimit)
        + "\n\n[... parte central da transcrição omitida por tamanho — total: " + transcription.length + " caracteres ...]\n\n"
        + transcription.substring(transcription.length - halfLimit);
      console.log(`[meeting-analyze] Transcription truncated: ${transcription.length} → ${analysisTranscription.length} chars`);
    }

    const { data: departments } = await supabaseAdmin.from("departamentos").select("nome").eq("ativo", true);
    const deptNames = departments?.map((d: any) => d.nome).join(", ") || "Comercial, Marketing, Operações, Financeiro, Tecnologia, Produto";

    // ========================================================================
    // PHASE 1: Structural Analysis (summary, ata, participants, mindmap)
    // ========================================================================
    await supabaseAdmin.from("meetings").update({ progress: 88, progress_detail: "Fase 1: Gerando ata e mapa mental..." }).eq("id", meetingId);

    // Estimate meeting duration from transcription length (~120 chars/min of speech)
    const estimatedMinutes = Math.max(5, Math.round(analysisTranscription.length / 120));
    const minAtaWords = Math.max(500, Math.round(estimatedMinutes * 100)); // ~100 palavras/min

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
      phase1Response = await callAI(lovableApiKey, phase1Messages, phase1Tools, "phase1_analysis", 120000);
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

    // Save Phase 1 results immediately (so user sees progress)
    await supabaseAdmin.from("meetings").update({
      summary: phase1Result.summary,
      ata: phase1Result.ata || null,
      participants: phase1Result.participants || null,
      mermaid_mindmap: JSON.stringify(phase1Result.mindmap_data),
      progress: 92,
      progress_detail: "Fase 2: Extraindo insights, tarefas e riscos...",
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    // ========================================================================
    // PHASE 2: Exhaustive Extraction (insights, tasks, risks, highlights)
    // ========================================================================
    // Proportional targets based on meeting duration
    const targetInsights = Math.max(15, Math.round(estimatedMinutes * 1.5)); // ~1.5 per minute
    const targetTasks = Math.max(10, Math.round(estimatedMinutes * 1)); // ~1 per minute
    const targetRisks = Math.max(6, Math.round(estimatedMinutes * 0.6)); // ~0.6 per minute
    const targetHighlights = Math.max(12, Math.round(estimatedMinutes * 1.2)); // ~1.2 per minute

    const phase2Messages = [
      {
        role: "system",
        content: `Você é um analista sênior especializado em extrair EXAUSTIVAMENTE todos os insights, tarefas, riscos e momentos-chave de reuniões corporativas.

DURAÇÃO ESTIMADA DA REUNIÃO: ~${estimatedMinutes} minutos.
Departamentos disponíveis: ${deptNames}

🎯 METAS PROPORCIONAIS (baseadas na duração — NÃO pare antes de atingir):

📊 INSIGHTS — META: ${targetInsights}+ itens
- Extraia ~1 insight para cada 1-2 minutos de reunião
- Tipos: "decisao", "problema", "oportunidade", "bloqueio", "risco"
- Cada decisão tomada → insight. Cada problema discutido → insight. Cada oportunidade → insight.
- INCLUA insights granulares: processos internos, pessoas, tecnologia, finanças, clientes, mercado, operações, cultura
- Prefira MUITOS insights específicos a POUCOS insights genéricos
- Atribua departamento, impacto e urgência para CADA insight

📋 TAREFAS — META: ${targetTasks}+ itens
- Extraia ~1 tarefa para cada 1-2 minutos de reunião
- Cada ação comprometida, cada "vamos fazer", "precisamos", "alguém precisa", cada follow-up, cada deadline → tarefa SEPARADA
- Desmembre tarefas compostas em sub-tarefas individuais
- Atribua departamento e prioridade

⚠️ RISCOS — META: ${targetRisks}+ itens
- Cada preocupação, desafio, obstáculo, incerteza, dependência externa, potencial problema futuro → risco INDIVIDUAL
- Inclua riscos implícitos (o que pode dar errado mesmo que não dito explicitamente)
- Inclua ação recomendada para CADA risco

🔖 HIGHLIGHTS — META: ${targetHighlights}+ itens
- Decisões, conflitos, ideias novas, problemas críticos, mudanças de direção, compromissos
- Estime timestamp em segundos; distribua proporcionalmente se não houver timestamps

⚠️ INSTRUÇÃO ANTI-PREGUIÇA — LEIA COM ATENÇÃO:
1. NÃO pare após gerar os primeiros 10 itens de cada tipo. Continue até ESGOTAR o conteúdo.
2. Releia CADA parágrafo da transcrição e pergunte-se: "Extraí tudo daqui?"
3. Se um parágrafo contém uma decisão E um risco E uma tarefa, gere os 3 itens separados.
4. Prefira 30 itens granulares a 10 itens genéricos.
5. Ao terminar, revise mentalmente: "Cobri o início, meio e fim da transcrição?"`,
      },
      {
        role: "user",
        content: `Esta reunião tem ~${estimatedMinutes} minutos. Extraia EXAUSTIVAMENTE todos os insights (meta: ${targetInsights}+), tarefas (meta: ${targetTasks}+), riscos (meta: ${targetRisks}+) e highlights (meta: ${targetHighlights}+). NÃO pare nos primeiros itens — continue até esgotar o conteúdo:\n\n${analysisTranscription}`,
      },
    ];

    const phase2Tools = [
      {
        type: "function",
        function: {
          name: "phase2_extraction",
          description: `Extrai exaustivamente insights (${targetInsights}+), tarefas (${targetTasks}+), riscos (${targetRisks}+) e highlights (${targetHighlights}+) da reunião de ~${estimatedMinutes} minutos.`,
          parameters: {
            type: "object",
            properties: {
              insights: {
                type: "array",
                description: `${targetInsights}+ insights extraídos exaustivamente da reunião`,
                items: {
                  type: "object",
                  properties: {
                    insight_type: { type: "string", enum: ["risco", "oportunidade", "decisao", "bloqueio", "problema"] },
                    title: { type: "string", description: "Título conciso do insight" },
                    description: { type: "string", description: "Descrição detalhada do insight em 2-3 frases" },
                    department: { type: "string", description: "Departamento relacionado" },
                    impact_level: { type: "string", enum: ["baixo", "medio", "alto", "critico"] },
                    urgency_level: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
                  },
                  required: ["insight_type", "title", "description", "department", "impact_level", "urgency_level"],
                },
              },
              tasks: {
                type: "array",
                description: `${targetTasks}+ tarefas extraídas exaustivamente da reunião`,
                items: {
                  type: "object",
                  properties: {
                    task: { type: "string", description: "Descrição clara da tarefa/ação" },
                    department: { type: "string", description: "Departamento responsável" },
                    priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                    responsible: { type: "string", description: "Pessoa responsável, se mencionada" },
                  },
                  required: ["task", "department", "priority"],
                },
              },
              risks: {
                type: "array",
                description: `${targetRisks}+ riscos identificados exaustivamente na reunião`,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string", description: "Descrição detalhada do risco" },
                    department: { type: "string" },
                    risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
                    impact_level: { type: "string", enum: ["baixo", "medio", "alto", "critico"] },
                    urgency_level: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
                    recommended_action: { type: "string", description: "Ação recomendada para mitigar o risco" },
                  },
                  required: ["title", "description", "department", "risk_level", "recommended_action"],
                },
              },
              highlights: {
                type: "array",
                description: "10-20 momentos-chave da reunião com timestamps (MÍNIMO 10)",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Descrição do momento importante" },
                    timestamp_seconds: { type: "number", description: "Posição estimada em segundos" },
                    type: { type: "string", enum: ["decisao", "problema", "tarefa", "oportunidade", "informacao", "conflito", "risco"] },
                    speaker: { type: "string", description: "Quem estava falando" },
                  },
                  required: ["label", "timestamp_seconds", "type"],
                },
              },
            },
            required: ["insights", "tasks", "risks", "highlights"],
            additionalProperties: false,
          },
        },
      },
    ];

    let phase2Response: Response;
    try {
      phase2Response = await callAI(lovableApiKey, phase2Messages, phase2Tools, "phase2_extraction", 120000);
    } catch (abortErr) {
      console.error("[meeting-analyze] Phase 2 timeout:", abortErr);
      // Phase 1 already saved — mark as partially analyzed
      await supabaseAdmin.from("meetings").update({ 
        status: "analyzed", progress: 100, 
        progress_detail: "Análise parcial (ata e mapa mental OK, extração de insights incompleta)" 
      }).eq("id", meetingId);
      return new Response(JSON.stringify({ 
        success: true, partial: true,
        summary: phase1Result.summary,
        insights_count: 0, tasks_count: 0, risks_count: 0, high_risks_count: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!phase2Response.ok) {
      const errorText = await phase2Response.text();
      console.error("[meeting-analyze] Phase 2 AI error:", phase2Response.status, errorText);
      if (phase2Response.status === 429 || phase2Response.status === 402) {
        // Phase 1 saved — return partial success
        await supabaseAdmin.from("meetings").update({ 
          status: "analyzed", progress: 100, 
          progress_detail: "Análise parcial concluída" 
        }).eq("id", meetingId);
        return new Response(JSON.stringify({ 
          success: true, partial: true,
          error: phase2Response.status === 429 ? "Limite excedido na Fase 2" : "Créditos insuficientes na Fase 2",
          summary: phase1Result.summary,
          insights_count: 0, tasks_count: 0, risks_count: 0, high_risks_count: 0,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Phase 2 AI error: ${phase2Response.status}`);
    }

    const phase2Data = await phase2Response.json();
    const phase2Result = parseToolCallResult(phase2Data);

    console.log("[meeting-analyze] Phase 2 OK:", {
      insights: phase2Result.insights?.length,
      tasks: phase2Result.tasks?.length,
      risks: phase2Result.risks?.length,
      highlights: phase2Result.highlights?.length,
    });

    // ========================================================================
    // SAVE PHASE 2 RESULTS
    // ========================================================================
    await supabaseAdmin.from("meetings").update({
      highlights: phase2Result.highlights || null,
      status: "analyzed",
      progress: 100,
      progress_detail: "Análise concluída!",
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    // Delete old insights/tasks/risks for re-analysis
    await Promise.all([
      supabaseAdmin.from("meeting_insights").delete().eq("meeting_id", meetingId),
      supabaseAdmin.from("meeting_tasks").delete().eq("meeting_id", meetingId),
      supabaseAdmin.from("meeting_risks").delete().eq("meeting_id", meetingId),
    ]);

    if (phase2Result.insights?.length > 0) {
      await supabaseAdmin.from("meeting_insights").insert(
        phase2Result.insights.map((i: any) => ({
          meeting_id: meetingId, insight_type: i.insight_type, title: i.title,
          description: i.description, department: i.department || null,
          impact_level: i.impact_level || null, urgency_level: i.urgency_level || null,
        }))
      );
    }

    if (phase2Result.tasks?.length > 0) {
      await supabaseAdmin.from("meeting_tasks").insert(
        phase2Result.tasks.map((t: any) => ({
          meeting_id: meetingId, task: t.task, department: t.department || null, priority: t.priority || "medium",
        }))
      );
    }

    if (phase2Result.risks?.length > 0) {
      await supabaseAdmin.from("meeting_risks").insert(
        phase2Result.risks.map((r: any) => ({
          meeting_id: meetingId, title: r.title, description: r.description,
          department: r.department || null, risk_level: r.risk_level || "medium",
          impact_level: r.impact_level || null, urgency_level: r.urgency_level || null,
          recommended_action: r.recommended_action || null,
        }))
      );
    }

    // Notify about HIGH/CRITICAL risks
    const highRisks = (phase2Result.risks || []).filter((r: any) => r.risk_level === "high" || r.risk_level === "critical");
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
      summary: phase1Result.summary,
      insights_count: phase2Result.insights?.length || 0,
      tasks_count: phase2Result.tasks?.length || 0,
      risks_count: phase2Result.risks?.length || 0,
      highlights_count: phase2Result.highlights?.length || 0,
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

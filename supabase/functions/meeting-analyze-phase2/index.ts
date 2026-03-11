import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(lovableApiKey: string, messages: any[], tools: any[], toolName: string, timeoutMs = 120000, model = "google/gemini-2.5-flash", temperature?: number) {
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

    const { meetingId } = await req.json();
    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: meetingData, error: meetingError } = await supabaseAdmin
      .from("meetings").select("*").eq("id", meetingId).single();
    if (meetingError || !meetingData) throw new Error("Reunião não encontrada");

    const transcription = meetingData.transcription;
    if (!transcription) {
      return new Response(JSON.stringify({ error: "Nenhuma transcrição disponível." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("meetings").update({
      status: "processing",
      progress: 93,
      progress_detail: "Fase 2: Extraindo insights, tarefas e riscos...",
    }).eq("id", meetingId);

    // Truncate if needed
    const MAX_TRANSCRIPTION_CHARS = 350000;
    let analysisTranscription = transcription;
    if (transcription.length > MAX_TRANSCRIPTION_CHARS) {
      const halfLimit = Math.floor(MAX_TRANSCRIPTION_CHARS / 2);
      analysisTranscription = transcription.substring(0, halfLimit)
        + "\n\n[... parte central omitida — total: " + transcription.length + " chars ...]\n\n"
        + transcription.substring(transcription.length - halfLimit);
    }

    const estimatedMinutes = meetingData.duration_seconds
      ? Math.max(5, Math.round(meetingData.duration_seconds / 60))
      : Math.max(5, Math.round(analysisTranscription.length / 650));

    const { data: departments } = await supabaseAdmin.from("departamentos").select("nome").eq("ativo", true);
    const deptNames = departments?.map((d: any) => d.nome).join(", ") || "Comercial, Marketing, Operações, Financeiro, Tecnologia, Produto";

    console.log(`[meeting-analyze-phase2] Starting Phase 2 for meeting ${meetingId}, ~${estimatedMinutes} min, ${analysisTranscription.length} chars`);

    // Proportional targets
    const targetInsights = Math.max(15, Math.round(estimatedMinutes * 1.5));
    const targetTasks = Math.max(10, Math.round(estimatedMinutes * 1));
    const targetRisks = Math.max(6, Math.round(estimatedMinutes * 0.6));
    const targetHighlights = Math.max(12, Math.round(estimatedMinutes * 1.2));

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
- DURAÇÃO TOTAL DA REUNIÃO: ${meetingData.duration_seconds || Math.round(estimatedMinutes * 60)} segundos
- Os timestamps DEVEM ser distribuídos UNIFORMEMENTE ao longo de toda a duração (de 0 até ${meetingData.duration_seconds || Math.round(estimatedMinutes * 60)} segundos)
- NÃO concentre timestamps no início. Garanta que haja highlights no primeiro terço, terço do meio e terço final da reunião
- Se a transcrição tem timestamps [MM:SS], use-os. Senão, distribua proporcionalmente

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
                description: `${targetHighlights}+ momentos-chave da reunião com timestamps`,
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Descrição do momento importante" },
                    timestamp_seconds: { type: "number", description: `Posição em segundos (de 0 a ${meetingData.duration_seconds || Math.round(estimatedMinutes * 60)}). Distribua uniformemente.` },
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
      phase2Response = await callAI(lovableApiKey, phase2Messages, phase2Tools, "phase2_extraction", 180000, "google/gemini-2.5-flash", 0.3);
    } catch (abortErr) {
      console.error("[meeting-analyze-phase2] Phase 2 timeout:", abortErr);
      await supabaseAdmin.from("meetings").update({ 
        status: "analyzed", progress: 100, 
        progress_detail: "Análise parcial (ata e mapa mental OK, extração de insights incompleta)" 
      }).eq("id", meetingId);
      return new Response(JSON.stringify({ 
        success: true, partial: true,
        insights_count: 0, tasks_count: 0, risks_count: 0, high_risks_count: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!phase2Response.ok) {
      const errorText = await phase2Response.text();
      console.error("[meeting-analyze-phase2] Phase 2 AI error:", phase2Response.status, errorText);
      if (phase2Response.status === 429 || phase2Response.status === 402) {
        await supabaseAdmin.from("meetings").update({ 
          status: "analyzed", progress: 100, 
          progress_detail: "Análise parcial concluída" 
        }).eq("id", meetingId);
        return new Response(JSON.stringify({ 
          success: true, partial: true,
          error: phase2Response.status === 429 ? "Limite excedido na Fase 2" : "Créditos insuficientes na Fase 2",
          insights_count: 0, tasks_count: 0, risks_count: 0, high_risks_count: 0,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`Phase 2 AI error: ${phase2Response.status}`);
    }

    const phase2Data = await phase2Response.json();
    const phase2Result = parseToolCallResult(phase2Data);

    console.log("[meeting-analyze-phase2] Phase 2 OK:", {
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
          responsible_name: t.responsible || null,
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
        message: `A análise da reunião identificou ${highRisks.length} risco(s) de nível alto/crítico.`,
        action_url: `/dashboard/reunioes/${meetingId}`,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      insights_count: phase2Result.insights?.length || 0,
      tasks_count: phase2Result.tasks?.length || 0,
      risks_count: phase2Result.risks?.length || 0,
      highlights_count: phase2Result.highlights?.length || 0,
      high_risks_count: highRisks.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[meeting-analyze-phase2] error:", error);
    // Try to mark as partially analyzed so user isn't stuck
    try {
      const { meetingId } = await req.clone().json();
      if (meetingId) {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabaseAdmin.from("meetings").update({
          status: "analyzed", progress: 100,
          progress_detail: "Análise parcial (extração de insights falhou)",
        }).eq("id", meetingId);
      }
    } catch (_) { /* ignore */ }
    return new Response(JSON.stringify({ error: error.message || "Erro ao extrair insights" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

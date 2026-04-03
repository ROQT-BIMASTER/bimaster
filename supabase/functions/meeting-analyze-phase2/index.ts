import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


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

function extractAndRepairJson(raw: string): unknown {
  let cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonStart = cleaned.search(/[\[{]/);
  if (jsonStart !== -1) {
    cleaned = cleaned.slice(jsonStart);
  }

  const firstChar = cleaned[0];
  const closingChar = firstChar === "[" ? "]" : "}";
  const lastClosingIndex = cleaned.lastIndexOf(closingChar);
  if (lastClosingIndex !== -1) {
    cleaned = cleaned.slice(0, lastClosingIndex + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, "");

    try {
      return JSON.parse(cleaned);
    } catch {
      if (cleaned.startsWith("[") && !cleaned.endsWith("]")) {
        const lastBrace = cleaned.lastIndexOf("}");
        if (lastBrace > 0) {
          return JSON.parse(`${cleaned.slice(0, lastBrace + 1)}]`);
        }
      }
      if (cleaned.startsWith("{") && !cleaned.endsWith("}")) {
        const lastBrace = cleaned.lastIndexOf("}");
        if (lastBrace > 0) {
          return JSON.parse(cleaned.slice(0, lastBrace + 1));
        }
      }
      throw new Error("Não foi possível interpretar o JSON retornado pela IA");
    }
  }
}

function parseToolCallResult(aiData: any): any {
  const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const args = toolCall.function.arguments;
    if (typeof args === "string") return extractAndRepairJson(args);
    return args;
  }

  const content = aiData.choices?.[0]?.message?.content;
  if (content) {
    return extractAndRepairJson(content);
  }

  throw new Error("IA não retornou dados estruturados");
}

function normalizePhase2Result(result: any) {
  const insights = Array.isArray(result?.insights)
    ? result.insights.filter((item: any) => item?.title && item?.insight_type).map((item: any) => ({
        insight_type: String(item.insight_type).trim(),
        title: String(item.title).trim(),
        description: item.description ? String(item.description).trim() : null,
        department: item.department ? String(item.department).trim() : null,
        impact_level: item.impact_level ? String(item.impact_level).trim() : null,
        urgency_level: item.urgency_level ? String(item.urgency_level).trim() : null,
      }))
    : [];

  const tasks = Array.isArray(result?.tasks)
    ? result.tasks.filter((item: any) => item?.task).map((item: any) => ({
        task: String(item.task).trim(),
        department: item.department ? String(item.department).trim() : null,
        priority: item.priority ? String(item.priority).trim() : "medium",
        responsible: item.responsible ? String(item.responsible).trim() : null,
      }))
    : [];

  const risks = Array.isArray(result?.risks)
    ? result.risks.filter((item: any) => item?.title).map((item: any) => ({
        title: String(item.title).trim(),
        description: item.description ? String(item.description).trim() : null,
        department: item.department ? String(item.department).trim() : null,
        risk_level: item.risk_level ? String(item.risk_level).trim() : "medium",
        impact_level: item.impact_level ? String(item.impact_level).trim() : null,
        urgency_level: item.urgency_level ? String(item.urgency_level).trim() : null,
        recommended_action: item.recommended_action ? String(item.recommended_action).trim() : null,
      }))
    : [];

  const highlights = Array.isArray(result?.highlights)
    ? result.highlights
        .filter((item: any) => item?.label && Number.isFinite(Number(item.timestamp_seconds)))
        .map((item: any) => ({
          label: String(item.label).trim(),
          timestamp_seconds: Number(item.timestamp_seconds),
          type: item.type ? String(item.type).trim() : "informacao",
          speaker: item.speaker ? String(item.speaker).trim() : null,
        }))
    : [];

  return { insights, tasks, risks, highlights };
}

async function assertNoError<T>(promise: PromiseLike<{ data: T; error: any }>, label: string) {
  const { data, error } = await promise;
  if (error) {
    console.error(`[meeting-analyze-phase2] ${label} error:`, error);
    throw new Error(`${label}: ${error.message || "falha ao persistir dados"}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const authHeader = req.headers.get("Authorization");
    const internalCall = req.headers.get("x-internal-call") === "true";

    if (!authHeader && !internalCall) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    if (!internalCall) {
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader! } },
      });
      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Usuário inválido" }), {
          status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const { meetingId } = await req.json();
    if (!meetingId) {
      return new Response(JSON.stringify({ error: "meetingId é obrigatório" }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const meetingData = await assertNoError(
      supabaseAdmin.from("meetings").select("*").eq("id", meetingId).single(),
      "carregar reunião"
    );

    const transcription = meetingData.transcription;
    if (!transcription) {
      return new Response(JSON.stringify({ error: "Nenhuma transcrição disponível." }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    await assertNoError(
      supabaseAdmin.from("meetings").update({
        status: "processing",
        progress: 93,
        progress_detail: "Fase 2: Extraindo insights, tarefas e riscos...",
      }).eq("id", meetingId),
      "atualizar progresso da reunião"
    );

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

    const departments = await assertNoError(
      supabaseAdmin.from("departamentos").select("nome").eq("ativo", true),
      "carregar departamentos"
    );
    const deptNames = departments?.map((d: any) => d.nome).join(", ") || "Comercial, Marketing, Operações, Financeiro, Tecnologia, Produto";

    console.log(`[meeting-analyze-phase2] Starting Phase 2 for meeting ${meetingId}, ~${estimatedMinutes} min, ${analysisTranscription.length} chars`);

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

⚠️ INSTRUÇÃO ANTI-PREGUIÇA:
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
                  required: ["insight_type", "title", "description", "department", "impact_level", "urgency_level"],
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
                    responsible: { type: "string" },
                  },
                  required: ["task", "department", "priority"],
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
                  required: ["title", "description", "department", "risk_level", "recommended_action"],
                },
              },
              highlights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    timestamp_seconds: { type: "number" },
                    type: { type: "string", enum: ["decisao", "problema", "tarefa", "oportunidade", "informacao", "conflito", "risco"] },
                    speaker: { type: "string" },
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
      await assertNoError(
        supabaseAdmin.from("meetings").update({
          status: "analyzed",
          progress: 100,
          progress_detail: "Análise parcial (ata e mapa mental OK, extração de insights incompleta)",
        }).eq("id", meetingId),
        "marcar reunião como parcial"
      );
      return new Response(JSON.stringify({ success: true, partial: true, insights_count: 0, tasks_count: 0, risks_count: 0, high_risks_count: 0 }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!phase2Response.ok) {
      const errorText = await phase2Response.text();
      console.error("[meeting-analyze-phase2] Phase 2 AI error:", phase2Response.status, errorText);
      if (phase2Response.status === 429 || phase2Response.status === 402) {
        await assertNoError(
          supabaseAdmin.from("meetings").update({
            status: "analyzed",
            progress: 100,
            progress_detail: "Análise parcial concluída",
          }).eq("id", meetingId),
          "marcar reunião como parcial"
        );
        return new Response(JSON.stringify({
          success: true,
          partial: true,
          error: phase2Response.status === 429 ? "Limite excedido na Fase 2" : "Créditos insuficientes na Fase 2",
          insights_count: 0,
          tasks_count: 0,
          risks_count: 0,
          high_risks_count: 0,
        }), { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
      }
      throw new Error(`Phase 2 AI error: ${phase2Response.status}`);
    }

    const phase2Data = await phase2Response.json();
    const phase2Result = normalizePhase2Result(parseToolCallResult(phase2Data));

    console.log("[meeting-analyze-phase2] Phase 2 normalized:", {
      insights: phase2Result.insights.length,
      tasks: phase2Result.tasks.length,
      risks: phase2Result.risks.length,
      highlights: phase2Result.highlights.length,
    });

    await Promise.all([
      assertNoError(supabaseAdmin.from("meeting_insights").delete().eq("meeting_id", meetingId), "limpar insights antigos"),
      assertNoError(supabaseAdmin.from("meeting_tasks").delete().eq("meeting_id", meetingId), "limpar tarefas antigas"),
      assertNoError(supabaseAdmin.from("meeting_risks").delete().eq("meeting_id", meetingId), "limpar riscos antigos"),
    ]);

    if (phase2Result.insights.length > 0) {
      await assertNoError(
        supabaseAdmin.from("meeting_insights").insert(
          phase2Result.insights.map((i: any) => ({
            meeting_id: meetingId,
            insight_type: i.insight_type,
            title: i.title,
            description: i.description,
            department: i.department,
            impact_level: i.impact_level,
            urgency_level: i.urgency_level,
          }))
        ),
        "salvar insights"
      );
    }

    if (phase2Result.tasks.length > 0) {
      await assertNoError(
        supabaseAdmin.from("meeting_tasks").insert(
          phase2Result.tasks.map((t: any) => ({
            meeting_id: meetingId,
            task: t.task,
            department: t.department,
            priority: t.priority,
            responsible_name: t.responsible,
          }))
        ),
        "salvar tarefas"
      );
    }

    if (phase2Result.risks.length > 0) {
      await assertNoError(
        supabaseAdmin.from("meeting_risks").insert(
          phase2Result.risks.map((r: any) => ({
            meeting_id: meetingId,
            title: r.title,
            description: r.description,
            department: r.department,
            risk_level: r.risk_level,
            impact_level: r.impact_level,
            urgency_level: r.urgency_level,
            recommended_action: r.recommended_action,
          }))
        ),
        "salvar riscos"
      );
    }

    await assertNoError(
      supabaseAdmin.from("meetings").update({
        highlights: phase2Result.highlights.length > 0 ? phase2Result.highlights : null,
        status: "analyzed",
        progress: 100,
        progress_detail: "Análise concluída!",
        updated_at: new Date().toISOString(),
      }).eq("id", meetingId),
      "finalizar reunião"
    );

    const highRisks = phase2Result.risks.filter((r: any) => r.risk_level === "high" || r.risk_level === "critical");
    const notificationUserId = userId || meetingData.created_by || null;
    if (highRisks.length > 0 && notificationUserId) {
      const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
        user_id: notificationUserId,
        type: "meeting_risk",
        title: `⚠️ ${highRisks.length} risco(s) identificado(s)`,
        message: `A análise da reunião identificou ${highRisks.length} risco(s) de nível alto/crítico.`,
        action_url: `/dashboard/reunioes/${meetingId}`,
      });
      if (notificationError) {
        console.error("[meeting-analyze-phase2] notification error:", notificationError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      insights_count: phase2Result.insights.length,
      tasks_count: phase2Result.tasks.length,
      risks_count: phase2Result.risks.length,
      highlights_count: phase2Result.highlights.length,
      high_risks_count: highRisks.length,
    }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[meeting-analyze-phase2] error:", error);
    try {
      const { meetingId } = await req.clone().json();
      if (meetingId) {
        const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabaseAdmin.from("meetings").update({
          status: "analyzed",
          progress: 100,
          progress_detail: "Análise parcial (extração de insights falhou)",
        }).eq("id", meetingId);
      }
    } catch (_) {}

    return new Response(JSON.stringify({ error: error.message || "Erro ao extrair insights" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

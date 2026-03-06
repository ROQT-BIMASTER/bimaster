import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Verificar usuário
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { meetingId, transcription } = await req.json();

    if (!meetingId || !transcription) {
      return new Response(JSON.stringify({ error: "meetingId e transcription são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualizar status para processando
    await supabaseAdmin.from("meetings").update({ status: "processing" }).eq("id", meetingId);

    // Buscar departamentos existentes
    const { data: departments } = await supabaseAdmin.from("departamentos").select("nome").eq("ativo", true);
    const deptNames = departments?.map((d: any) => d.nome).join(", ") || "Comercial, Marketing, Operações, Financeiro, Tecnologia, Produto";

    // Chamar Lovable AI Gateway com tool calling
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
                    description: "Resumo executivo da reunião em 2-4 parágrafos",
                  },
                  mermaid_mindmap: {
                    type: "string",
                    description: "Mapa mental em sintaxe Mermaid mindmap. Exemplo: mindmap\\n  root((Tema))\\n    Subtema1\\n      Item\\n    Subtema2",
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
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        await supabaseAdmin.from("meetings").update({ status: "error" }).eq("id", meetingId);
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("IA não retornou dados estruturados");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // Salvar resumo e mapa mental na reunião
    await supabaseAdmin.from("meetings").update({
      transcription,
      summary: analysis.summary,
      mermaid_mindmap: analysis.mermaid_mindmap,
      status: "analyzed",
      updated_at: new Date().toISOString(),
    }).eq("id", meetingId);

    // Inserir insights
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

    // Inserir tarefas
    if (analysis.tasks?.length > 0) {
      const tasksRows = analysis.tasks.map((t: any) => ({
        meeting_id: meetingId,
        task: t.task,
        department: t.department || null,
        priority: t.priority || "medium",
      }));
      await supabaseAdmin.from("meeting_tasks").insert(tasksRows);
    }

    // Inserir riscos
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

    // Notificar sobre riscos HIGH/CRITICAL
    const highRisks = (analysis.risks || []).filter((r: any) => r.risk_level === "high" || r.risk_level === "critical");
    if (highRisks.length > 0) {
      // Buscar o título da reunião
      const { data: meetingData } = await supabaseAdmin.from("meetings").select("title").eq("id", meetingId).single();
      
      // Notificar o criador da reunião
      await supabaseAdmin.from("notifications").insert({
        user_id: user.id,
        type: "meeting_risk",
        title: `⚠️ ${highRisks.length} risco(s) identificado(s)`,
        message: `A análise da reunião "${meetingData?.title || ''}" identificou ${highRisks.length} risco(s) de nível alto/crítico.`,
        action_url: `/dashboard/reunioes/${meetingId}`,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      summary: analysis.summary,
      insights_count: analysis.insights?.length || 0,
      tasks_count: analysis.tasks?.length || 0,
      risks_count: analysis.risks?.length || 0,
      high_risks_count: highRisks.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("meeting-analyze error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro ao analisar reunião" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

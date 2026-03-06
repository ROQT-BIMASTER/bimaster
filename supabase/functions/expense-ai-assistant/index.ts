import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://bimaster.lovable.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ────────── helpers ──────────
async function callAI(
  messages: { role: string; content: string | object[] }[],
  tools?: unknown[],
  toolChoice?: unknown,
  model = "google/gemini-2.5-flash"
) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const body: Record<string, unknown> = { model, messages };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("AI gateway error", res.status, t);
    if (res.status === 429) throw { status: 429, message: "Rate limit exceeded" };
    if (res.status === 402) throw { status: 402, message: "Payment required" };
    throw new Error(`AI error: ${res.status}`);
  }
  return res.json();
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

// ────────── ACTION: extract_receipt ──────────
async function handleExtractReceipt(imageBase64: string) {
  const tools = [
    {
      type: "function",
      function: {
        name: "extract_receipt_data",
        description: "Extrai dados estruturados de uma foto de nota fiscal, recibo, cupom ou boleto.",
        parameters: {
          type: "object",
          properties: {
            supplier_name: { type: "string", description: "Nome do fornecedor ou estabelecimento" },
            supplier_document: { type: "string", description: "CNPJ ou CPF do fornecedor, se visível" },
            total_value: { type: "number", description: "Valor total do documento" },
            emission_date: { type: "string", description: "Data de emissão no formato YYYY-MM-DD" },
            document_type: {
              type: "string",
              enum: ["nf", "nfse", "boleto", "recibo", "fatura", "duplicata", "outros"],
              description: "Tipo do documento",
            },
            document_number: { type: "string", description: "Número do documento, se visível" },
            suggested_category: {
              type: "string",
              enum: [
                "viagem", "transporte", "material", "equipamento", "servicos",
                "treinamento", "software", "marketing", "alimentacao", "manutencao",
                "local", "equipamento_evento", "decoracao", "catering",
                "comunicacao", "brindes", "palestrante", "outros",
              ],
              description: "Categoria sugerida baseada no conteúdo",
            },
            description: { type: "string", description: "Breve descrição do que se trata o documento" },
            confidence: { type: "number", description: "Nível de confiança da extração, de 0 a 1" },
          },
          required: ["supplier_name", "total_value", "suggested_category", "confidence"],
          additionalProperties: false,
        },
      },
    },
  ];

  const result = await callAI(
    [
      {
        role: "system",
        content:
          "Você é um especialista em leitura de documentos fiscais brasileiros. Extraia com precisão todos os dados visíveis do documento. Retorne a categoria mais apropriada e um nível de confiança.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analise este documento fiscal e extraia todos os dados relevantes.",
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
        ],
      },
    ],
    tools,
    { type: "function", function: { name: "extract_receipt_data" } },
    "google/gemini-2.5-flash" // multimodal
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No data extracted");

  return JSON.parse(toolCall.function.arguments);
}

// ────────── ACTION: chat ──────────
async function handleChat(
  messages: { role: string; content: string }[],
  context: Record<string, unknown>,
  authHeader: string
) {
  const sb = getUserClient(authHeader);

  // Build context text from real data
  let contextText = "Contexto do sistema:\n";

  if (context.event_id) {
    const { data: evt } = await sb
      .from("corporate_events")
      .select("name, code, budget_amount, budget_status, event_date, location")
      .eq("id", context.event_id)
      .single();
    if (evt) contextText += `Evento: ${evt.name} (${evt.code}), Verba: R$ ${evt.budget_amount || 0}, Status: ${evt.budget_status}, Data: ${evt.event_date || "N/A"}\n`;

    const { data: expenses } = await sb
      .from("corporate_event_expenses")
      .select("category, valor_previsto, valor_realizado, status, description, expense_date")
      .eq("event_id", context.event_id);
    if (expenses?.length) {
      const totalGasto = expenses.reduce((s, e) => s + (e.valor_realizado || e.valor_previsto || 0), 0);
      const pending = expenses.filter(e => e.status === "pending").length;
      contextText += `Despesas: ${expenses.length} total, ${pending} pendentes, Total gasto: R$ ${totalGasto.toFixed(2)}\n`;
    }
  }

  if (context.department_id) {
    const { data: dept } = await sb
      .from("departamentos")
      .select("nome")
      .eq("id", context.department_id)
      .single();
    if (dept) contextText += `Departamento: ${dept.nome}\n`;

    const { data: expenses } = await sb
      .from("department_expenses")
      .select("category, valor_previsto, valor_realizado, status, description")
      .eq("department_id", context.department_id);
    if (expenses?.length) {
      const totalGasto = expenses.reduce((s, e) => s + (e.valor_realizado || e.valor_previsto || 0), 0);
      const pending = expenses.filter(e => e.status === "pending").length;
      contextText += `Despesas dept: ${expenses.length} total, ${pending} pendentes, Total: R$ ${totalGasto.toFixed(2)}\n`;
    }
  }

  // Financial policy
  const admin = getSupabaseAdmin();
  const { data: policy } = await admin
    .from("financial_payment_policies")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (policy) {
    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    contextText += `Política financeira: Corte ${dias[policy.cutoff_day_of_week]} às ${policy.cutoff_time}, Pagamento ${dias[policy.payment_day_of_week]}. Exceções: ${policy.allows_exceptions ? "Sim" : "Não"}\n`;
  }

  const result = await callAI([
    {
      role: "system",
      content: `Você é o assistente de despesas corporativas. Responda de forma clara e objetiva, sempre em português brasileiro.
Use os dados reais fornecidos abaixo para responder. Não invente dados.
Se não souber algo, diga que não tem essa informação.
Formate valores em R$ com 2 casas decimais.

${contextText}`,
    },
    ...messages,
  ]);

  return { reply: result.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua pergunta." };
}

// ────────── ACTION: approval_summary ──────────
async function handleApprovalSummary(
  entityType: "event" | "department",
  entityId: string,
  authHeader: string
) {
  const sb = getUserClient(authHeader);
  let expenses: unknown[] = [];
  let entityName = "";
  let budgetAmount = 0;

  if (entityType === "event") {
    const { data: evt } = await sb
      .from("corporate_events")
      .select("name, budget_amount")
      .eq("id", entityId)
      .single();
    entityName = evt?.name || "";
    budgetAmount = evt?.budget_amount || 0;

    const { data } = await sb
      .from("corporate_event_expenses")
      .select("category, valor_previsto, valor_realizado, status, description, expense_date, supplier_name")
      .eq("event_id", entityId)
      .eq("status", "pending");
    expenses = data || [];
  } else {
    const { data: dept } = await sb
      .from("departamentos")
      .select("nome")
      .eq("id", entityId)
      .single();
    entityName = dept?.nome || "";

    const { data: budgets } = await sb
      .from("department_budgets")
      .select("approved_amount")
      .eq("department_id", entityId)
      .eq("status", "active");
    budgetAmount = (budgets || []).reduce((s, b) => s + (b.approved_amount || 0), 0);

    const { data } = await sb
      .from("department_expenses")
      .select("category, valor_previsto, valor_realizado, status, description, expense_date, supplier_name")
      .eq("department_id", entityId)
      .eq("status", "pending");
    expenses = data || [];
  }

  const tools = [
    {
      type: "function",
      function: {
        name: "generate_approval_summary",
        description: "Gera um resumo executivo para o aprovador com alertas.",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Resumo executivo em 2-3 frases" },
            total_pending: { type: "number", description: "Valor total pendente" },
            budget_used_percent: { type: "number", description: "Percentual da verba utilizado" },
            alerts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["warning", "danger", "info"] },
                  message: { type: "string" },
                },
                required: ["type", "message"],
                additionalProperties: false,
              },
              description: "Lista de alertas identificados",
            },
            recommendation: { type: "string", description: "Recomendação geral para o aprovador" },
          },
          required: ["summary", "total_pending", "alerts", "recommendation"],
          additionalProperties: false,
        },
      },
    },
  ];

  const result = await callAI(
    [
      {
        role: "system",
        content:
          "Você é um analista financeiro. Analise as despesas pendentes e gere um resumo executivo para o aprovador. Identifique valores fora do padrão, duplicidades e possíveis problemas.",
      },
      {
        role: "user",
        content: `Entidade: ${entityName}\nVerba aprovada: R$ ${budgetAmount.toFixed(2)}\nDespesas pendentes:\n${JSON.stringify(expenses, null, 2)}`,
      },
    ],
    tools,
    { type: "function", function: { name: "generate_approval_summary" } }
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { summary: "Sem dados para análise", alerts: [], recommendation: "" };
  return JSON.parse(toolCall.function.arguments);
}

// ────────── ACTION: detect_anomalies ──────────
async function handleDetectAnomalies(expenseData: Record<string, unknown>) {
  const tools = [
    {
      type: "function",
      function: {
        name: "detect_expense_anomalies",
        description: "Detecta anomalias em uma despesa.",
        parameters: {
          type: "object",
          properties: {
            has_anomaly: { type: "boolean", description: "Se há alguma anomalia detectada" },
            anomalies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["duplicate", "high_value", "vague_description", "budget_exceeded", "suspicious"] },
                  severity: { type: "string", enum: ["low", "medium", "high"] },
                  message: { type: "string" },
                },
                required: ["type", "severity", "message"],
                additionalProperties: false,
              },
            },
          },
          required: ["has_anomaly", "anomalies"],
          additionalProperties: false,
        },
      },
    },
  ];

  const result = await callAI(
    [
      {
        role: "system",
        content:
          "Analise esta despesa corporativa e identifique possíveis anomalias: valores fora do padrão para a categoria, descrições vagas, valores suspeitos. Parâmetros de referência: alimentação <R$200, transporte <R$500, material <R$1000, equipamento <R$5000, serviços <R$10000.",
      },
      {
        role: "user",
        content: JSON.stringify(expenseData),
      },
    ],
    tools,
    { type: "function", function: { name: "detect_expense_anomalies" } }
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { has_anomaly: false, anomalies: [] };
  return JSON.parse(toolCall.function.arguments);
}

// ────────── ACTION: suggest_financial_fields ──────────
async function handleSuggestFields(expenseId: string, authHeader: string) {
  const sb = getUserClient(authHeader);

  const { data: expense } = await sb
    .from("corporate_event_expenses")
    .select("category, description, valor_realizado, valor_previsto, supplier_name")
    .eq("id", expenseId)
    .single();

  // Also try department_expenses
  let expData = expense;
  if (!expData) {
    const { data: deptExp } = await sb
      .from("department_expenses")
      .select("category, description, valor_realizado, valor_previsto, supplier_name")
      .eq("id", expenseId)
      .single();
    expData = deptExp;
  }

  if (!expData) return { suggestions: {} };

  // Get historical data for suggestions
  const admin = getSupabaseAdmin();
  const { data: history } = await admin
    .from("financial_payment_queue")
    .select("supplier_name, document_type, portador")
    .not("supplier_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const tools = [
    {
      type: "function",
      function: {
        name: "suggest_financial_data",
        description: "Sugere preenchimento do formulário de envio ao financeiro.",
        parameters: {
          type: "object",
          properties: {
            suggested_document_type: { type: "string", enum: ["nf", "nfse", "boleto", "recibo", "fatura", "duplicata", "outros"] },
            suggested_portador: { type: "string" },
            suggested_due_date_offset_days: { type: "number", description: "Dias a partir de hoje para vencimento sugerido" },
            reasoning: { type: "string", description: "Breve justificativa para as sugestões" },
          },
          required: ["suggested_document_type", "reasoning"],
          additionalProperties: false,
        },
      },
    },
  ];

  const result = await callAI(
    [
      {
        role: "system",
        content: "Baseado na despesa e no histórico de pagamentos, sugira o tipo de documento, portador e prazo de vencimento mais adequados.",
      },
      {
        role: "user",
        content: `Despesa: ${JSON.stringify(expData)}\nHistórico recente: ${JSON.stringify(history?.slice(0, 10))}`,
      },
    ],
    tools,
    { type: "function", function: { name: "suggest_financial_data" } }
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { suggestions: {} };
  return { suggestions: JSON.parse(toolCall.function.arguments) };
}

// ────────── ACTION: generate_report ──────────
async function handleGenerateReport(eventId: string, authHeader: string) {
  const sb = getUserClient(authHeader);

  const { data: event } = await sb
    .from("corporate_events")
    .select("*")
    .eq("id", eventId)
    .single();

  const { data: expenses } = await sb
    .from("corporate_event_expenses")
    .select("category, description, valor_previsto, valor_realizado, status, expense_date, supplier_name")
    .eq("event_id", eventId);

  if (!event) throw new Error("Evento não encontrado");

  const result = await callAI([
    {
      role: "system",
      content:
        "Você é um analista de eventos corporativos. Gere um relatório completo e profissional em Markdown sobre o evento. Inclua: resumo executivo, tabela de despesas, análise de aderência ao orçamento, e sugestões para eventos futuros. Use formato em português brasileiro. Formate valores em R$.",
    },
    {
      role: "user",
      content: `Evento: ${JSON.stringify(event)}\nDespesas: ${JSON.stringify(expenses)}`,
    },
  ]);

  return { report: result.choices?.[0]?.message?.content || "Erro ao gerar relatório." };
}

// ────────── MAIN HANDLER ──────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // JWT Authentication
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, ...params } = await req.json();

    console.log(`[expense-ai-assistant] action=${action}`);

    let result: unknown;

    switch (action) {
      case "extract_receipt":
        result = await handleExtractReceipt(params.imageBase64);
        break;
      case "chat":
        result = await handleChat(params.messages, params.context || {}, authHeader);
        break;
      case "approval_summary":
        result = await handleApprovalSummary(params.entityType, params.entityId, authHeader);
        break;
      case "detect_anomalies":
        result = await handleDetectAnomalies(params.expenseData);
        break;
      case "suggest_financial_fields":
        result = await handleSuggestFields(params.expenseId, authHeader);
        break;
      case "generate_report":
        result = await handleGenerateReport(params.eventId, authHeader);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[expense-ai-assistant] error:", e);
    const err = e as { status?: number; message?: string };
    const status = err.status || 500;
    const message = err.message || (e instanceof Error ? e.message : "Unknown error");

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

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
    "google/gemini-2.5-flash"
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

// ────────── ACTION: audit_document ──────────
async function handleAuditDocument(params: {
  attachmentUrl: string;
  supplierName?: string;
  supplierDocument?: string;
  amount?: number;
  documentNumber?: string;
  documentType?: string;
}) {
  const admin = getSupabaseAdmin();

  let fileBase64: string;
  let mimeType = "image/jpeg";

  try {
    const url = params.attachmentUrl;
    let bucket = "";
    let filePath = "";

    console.log("[audit_document] parsing URL:", url.substring(0, 200));

    // Parse URL - handle signed URLs, public URLs, and authenticated URLs
    try {
      const urlObj = new URL(url);
      // Match: /storage/v1/object/(public|sign|authenticated)/BUCKET/PATH
      const match = urlObj.pathname.match(
        /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/
      );
      if (match) {
        bucket = match[1];
        filePath = decodeURIComponent(match[2]);
      }
    } catch {
      // Not a full URL — try bucket/path format
      if (url.includes("/")) {
        const parts = url.split("/");
        bucket = parts[0];
        filePath = parts.slice(1).join("/");
      }
    }

    console.log("[audit_document] resolved bucket:", bucket, "filePath:", filePath);

    if (!bucket || !filePath) {
      throw new Error(`Could not parse attachment URL: ${url.substring(0, 150)}`);
    }

    // Determine mime type from extension
    const ext = filePath.split(".").pop()?.toLowerCase();
    if (ext === "pdf") mimeType = "application/pdf";
    else if (ext === "png") mimeType = "image/png";
    else if (ext === "webp") mimeType = "image/webp";
    else if (ext === "gif") mimeType = "image/gif";

    console.log("[audit_document] downloading from bucket:", bucket, "path:", filePath, "mimeType:", mimeType);

    const { data: fileData, error: dlError } = await admin.storage
      .from(bucket)
      .download(filePath);

    if (dlError || !fileData) {
      console.error("[audit_document] download error:", dlError);
      throw dlError || new Error("Download failed");
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    fileBase64 = btoa(binary);
    console.log("[audit_document] file downloaded, base64 length:", fileBase64.length);
  } catch (err) {
    console.error("[audit_document] download error:", err);
    throw new Error("Não foi possível baixar o documento anexado para auditoria.");
  }

  // Build the expected data for comparison
  const expectedData = {
    cnpj: params.supplierDocument || "",
    supplier_name: params.supplierName || "",
    amount: params.amount || 0,
    document_number: params.documentNumber || "",
  };

  const tools = [
    {
      type: "function",
      function: {
        name: "audit_document_result",
        description: "Retorna os dados extraídos do documento fiscal com análise de divergências em relação ao lançamento esperado.",
        parameters: {
          type: "object",
          properties: {
            extracted_cnpj: { type: "string", description: "CNPJ/CPF encontrado no documento" },
            extracted_name: { type: "string", description: "Nome/razão social do emitente no documento" },
            extracted_amount: { type: "number", description: "Valor total encontrado no documento" },
            extracted_document_number: { type: "string", description: "Número do documento fiscal" },
            extracted_chave_acesso: { type: "string", description: "Chave de acesso da NF-e (44 dígitos numéricos), se visível no documento" },
            confidence: { type: "number", description: "Confiança na extração, de 0 a 1" },
            ai_divergences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string", description: "Campo divergente: cnpj, supplier_name, amount, document_number" },
                  expected: { type: "string", description: "Valor esperado (do lançamento)" },
                  found: { type: "string", description: "Valor encontrado no documento" },
                  severity: { type: "string", enum: ["low", "medium", "high"], description: "Gravidade da divergência" },
                  justification: { type: "string", description: "Justificativa da IA para a divergência" },
                },
                required: ["field", "expected", "found", "severity"],
                additionalProperties: false,
              },
              description: "Divergências identificadas pela IA entre o documento e o lançamento",
            },
          },
          required: ["extracted_cnpj", "extracted_name", "extracted_amount", "confidence"],
          additionalProperties: false,
        },
      },
    },
  ];

  const contextLines = [
    `Analise este documento fiscal e confronte com os dados do lançamento no sistema.`,
    ``,
    `DADOS DO LANÇAMENTO (esperados):`,
    expectedData.cnpj ? `- CNPJ/CPF do fornecedor: ${expectedData.cnpj}` : `- CNPJ/CPF do fornecedor: NÃO INFORMADO`,
    expectedData.supplier_name ? `- Nome do fornecedor: ${expectedData.supplier_name}` : `- Nome do fornecedor: NÃO INFORMADO`,
    expectedData.amount ? `- Valor: R$ ${expectedData.amount.toFixed(2)}` : `- Valor: NÃO INFORMADO`,
    expectedData.document_number ? `- Nº do documento: ${expectedData.document_number}` : `- Nº do documento: NÃO INFORMADO`,
    params.documentType ? `- Tipo de documento: ${params.documentType}` : ``,
    ``,
    `INSTRUÇÕES:`,
    `1. Extraia os dados visíveis do documento (CNPJ, nome, valor, número do documento, chave de acesso NF-e se presente).`,
    `2. Compare cada campo extraído com os dados esperados do lançamento acima.`,
    `3. Se houver divergências, liste-as em "ai_divergences" com severidade:`,
    `   - high: CNPJ diferente ou valor com diferença >10%`,
    `   - medium: nome do fornecedor diferente ou valor com diferença entre 2% e 10%`,
    `   - low: número do documento diferente`,
    `4. Se encontrar a chave de acesso da NF-e (44 dígitos numéricos), extraia em "extracted_chave_acesso".`,
  ].filter(Boolean).join("\n");

  // Always use image_url format — Gemini supports PDF via data URI with correct mime type
  const contentParts: any[] = [
    { type: "text", text: contextLines },
    {
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${fileBase64}` },
    },
  ];

  console.log("[audit_document] calling AI with mimeType:", mimeType, "contentParts:", contentParts.length);

  const result = await callAI(
    [
      {
        role: "system",
        content: "Você é um auditor fiscal especializado em documentos fiscais brasileiros. Sua tarefa é extrair dados do documento E confrontá-los com os dados do lançamento fornecidos pelo usuário. Aponte divergências com precisão, incluindo justificativa. Extraia a chave de acesso da NF-e (44 dígitos) se estiver visível.",
      },
      { role: "user", content: contentParts },
    ],
    tools,
    { type: "function", function: { name: "audit_document_result" } },
    "google/gemini-2.5-flash"
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.error("[audit_document] No tool call in AI response:", JSON.stringify(result.choices?.[0]?.message).substring(0, 500));
    throw new Error("Não foi possível extrair dados do documento.");
  }

  const extracted = JSON.parse(toolCall.function.arguments);
  console.log("[audit_document] AI extracted:", JSON.stringify(extracted).substring(0, 500));

  // Compare extracted vs expected
  const divergences: { field: string; expected: string; found: string; severity: "low" | "medium" | "high" }[] = [];

  if (expectedData.cnpj && extracted.extracted_cnpj) {
    const normExpected = expectedData.cnpj.replace(/\D/g, "");
    const normFound = extracted.extracted_cnpj.replace(/\D/g, "");
    if (normExpected && normFound && normExpected !== normFound) {
      divergences.push({
        field: "cnpj",
        expected: expectedData.cnpj,
        found: extracted.extracted_cnpj,
        severity: "high",
      });
    }
  }

  if (expectedData.supplier_name && extracted.extracted_name) {
    const normExp = expectedData.supplier_name.toLowerCase().trim();
    const normFound = extracted.extracted_name.toLowerCase().trim();
    if (!normExp.includes(normFound) && !normFound.includes(normExp) && normExp !== normFound) {
      divergences.push({
        field: "supplier_name",
        expected: expectedData.supplier_name,
        found: extracted.extracted_name,
        severity: "medium",
      });
    }
  }

  if (expectedData.amount && extracted.extracted_amount) {
    const diff = Math.abs(expectedData.amount - extracted.extracted_amount);
    const threshold = expectedData.amount * 0.02;
    if (diff > threshold && diff > 1) {
      divergences.push({
        field: "amount",
        expected: `R$ ${expectedData.amount.toFixed(2)}`,
        found: `R$ ${extracted.extracted_amount.toFixed(2)}`,
        severity: diff / expectedData.amount > 0.1 ? "high" : "medium",
      });
    }
  }

  if (expectedData.document_number && extracted.extracted_document_number) {
    const normExp = expectedData.document_number.replace(/\D/g, "");
    const normFound = extracted.extracted_document_number.replace(/\D/g, "");
    if (normExp && normFound && normExp !== normFound) {
      divergences.push({
        field: "document_number",
        expected: expectedData.document_number,
        found: extracted.extracted_document_number,
        severity: "low",
      });
    }
  }

  // Merge AI divergences with code-based divergences
  const aiDivs = extracted.ai_divergences || [];
  const aiFields = new Set(aiDivs.map((d: any) => d.field));
  const mergedDivergences = [
    ...aiDivs.map((d: any) => ({
      field: d.field,
      expected: d.expected,
      found: d.found,
      severity: d.severity as "low" | "medium" | "high",
    })),
    ...divergences.filter(d => !aiFields.has(d.field)),
  ];

  return {
    matches: mergedDivergences.length === 0,
    divergences: mergedDivergences,
    confidence: extracted.confidence || 0,
    extracted_cnpj: extracted.extracted_cnpj,
    extracted_name: extracted.extracted_name,
    extracted_amount: extracted.extracted_amount,
    extracted_document_number: extracted.extracted_document_number,
    extracted_chave_acesso: extracted.extracted_chave_acesso || null,
  };
}

// ────────── ACTION: audit_reduction_plan ──────────
async function handleAuditReductionPlan(planoId: string) {
  const admin = getSupabaseAdmin();

  // 1. Fetch plan info
  const { data: plano, error: planoErr } = await admin
    .from("planos_reducao")
    .select("id, nome, descricao, created_at")
    .eq("id", planoId)
    .single();
  if (planoErr || !plano) throw new Error("Plano não encontrado");

  // 2. Fetch revision items with joins
  const { data: itens, error: itensErr } = await admin
    .from("contas_pagar_revisao")
    .select("*")
    .eq("plano_id", planoId);
  if (itensErr) throw new Error("Erro ao buscar itens: " + itensErr.message);
  if (!itens || itens.length === 0) throw new Error("Nenhum item encontrado neste plano");

  // 3. Fetch departments & chart of accounts for enrichment
  const deptIds = [...new Set(itens.filter(i => i.departamento_id).map(i => i.departamento_id))];
  const pcIds = [...new Set(itens.filter(i => i.plano_contas_id).map(i => i.plano_contas_id))];
  const [deptRes, pcRes] = await Promise.all([
    deptIds.length > 0 ? admin.from("departamentos").select("id, nome").in("id", deptIds) : { data: [] },
    pcIds.length > 0 ? admin.from("trade_chart_of_accounts").select("id, name, code").in("id", pcIds) : { data: [] },
  ]);
  const deptMap = Object.fromEntries((deptRes.data || []).map(d => [d.id, d.nome]));
  const pcMap = Object.fromEntries((pcRes.data || []).map(p => [p.id, { name: p.name, code: p.code }]));

  // 4. Fetch last 12 months payments for relevant suppliers
  const fornCodigos = [...new Set(itens.filter(i => i.fornecedor_codigo).map(i => i.fornecedor_codigo))] as string[];
  let historicoData: any[] = [];
  if (fornCodigos.length > 0) {
    const { data: metricas } = await admin.rpc("get_fornecedor_metricas_reducao", { p_codigos: fornCodigos });
    historicoData = metricas || [];
  }

  // 5. Build enriched items summary
  const itensSummary = itens.map(item => ({
    fornecedor: item.fornecedor_nome,
    fornecedor_codigo: item.fornecedor_codigo,
    categoria: pcMap[item.plano_contas_id]?.name || item.categoria_nome,
    departamento: deptMap[item.departamento_id] || "N/A",
    empresa: item.empresa_nome,
    tipo_revisao: item.tipo_revisao,
    prioridade: item.prioridade,
    status: item.status,
    valor_atual: item.valor_atual,
    meta_reducao_percentual: item.meta_reducao_percentual,
    meta_reducao_valor: item.meta_reducao_valor,
    resultado_obtido: item.resultado_obtido,
    prazo_revisao: item.prazo_revisao,
    data_vencimento: item.data_vencimento,
    observacoes: item.observacoes,
  }));

  const metricasSummary = historicoData.map((m: any) => ({
    fornecedor_codigo: m.fornecedor_codigo,
    total_12m: m.total_12m,
    media_mensal: m.media_mensal,
    qtd_pagamentos: m.qtd_pagamentos,
    ultimo_pagamento: m.ultimo_pagamento,
    ativo: m.ativo,
    historico_mensal: m.historico_mensal,
  }));

  // 6. Call AI with tool calling
  const tools = [{
    type: "function",
    function: {
      name: "audit_result",
      description: "Resultado da auditoria de anomalias do plano de redução de gastos",
      parameters: {
        type: "object",
        properties: {
          risk_score: { type: "number", description: "Score geral de risco do plano, de 0 a 100" },
          summary: { type: "string", description: "Resumo executivo da auditoria em 3-5 frases" },
          anomalies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["cost_spike", "stalled_item", "overdue", "unrealistic_target", "duplicate", "concentration"] },
                severity: { type: "string", enum: ["high", "medium", "low"] },
                fornecedor: { type: "string" },
                item: { type: "string" },
                description: { type: "string" },
                recommendation: { type: "string" },
                impact_value: { type: "number", description: "Valor financeiro do impacto estimado" },
              },
              required: ["type", "severity", "description", "recommendation"],
              additionalProperties: false,
            },
          },
          trend_data: {
            type: "array",
            items: {
              type: "object",
              properties: {
                mes: { type: "string" },
                fornecedor: { type: "string" },
                valor_real: { type: "number" },
                valor_medio: { type: "number" },
              },
              required: ["mes", "fornecedor", "valor_real", "valor_medio"],
              additionalProperties: false,
            },
          },
          radar_dimensions: {
            type: "object",
            properties: {
              custos_crescentes: { type: "number", description: "Score 0-100" },
              prazos_vencidos: { type: "number", description: "Score 0-100" },
              metas_irrealistas: { type: "number", description: "Score 0-100" },
              duplicidades: { type: "number", description: "Score 0-100" },
              concentracao: { type: "number", description: "Score 0-100" },
              itens_parados: { type: "number", description: "Score 0-100" },
            },
            required: ["custos_crescentes", "prazos_vencidos", "metas_irrealistas", "duplicidades", "concentracao", "itens_parados"],
            additionalProperties: false,
          },
          uncaptured_savings: { type: "number", description: "Potencial de economia não capturado em R$" },
          critical_items_count: { type: "number", description: "Número de itens com severidade alta" },
        },
        required: ["risk_score", "summary", "anomalies", "trend_data", "radar_dimensions", "uncaptured_savings", "critical_items_count"],
        additionalProperties: false,
      },
    },
  }];

  const result = await callAI(
    [
      {
        role: "system",
        content: `Você é um auditor financeiro sênior especializado em planos de redução de custos corporativos.
Analise os dados do plano de redução e o histórico de pagamentos para identificar anomalias, riscos e oportunidades.

REGRAS DE ANÁLISE:
1. CUSTOS CRESCENTES: Compare os valores mensais de cada fornecedor. Se há tendência de alta nos últimos 3+ meses, é anomalia.
2. ITENS PARADOS: Itens com status "pendente" há mais de 30 dias sem progresso.
3. PRAZOS VENCIDOS: Itens com prazo_revisao no passado e status diferente de concluido/cancelado.
4. METAS IRREALISTAS: Metas de redução >50% sem histórico que justifique, ou metas sem valor definido.
5. DUPLICIDADES: Mesmo fornecedor aparecendo em departamentos diferentes com categorias similares.
6. CONCENTRAÇÃO: Fornecedor representando >30% do valor total do plano.

Para trend_data, use o historico_mensal real fornecido. Preencha com dados reais dos fornecedores que apresentam anomalias.
Para radar_dimensions, atribua scores de 0 (sem risco) a 100 (risco máximo) para cada dimensão.
Calcule uncaptured_savings como a soma das metas de redução dos itens ainda não concluídos.
Seja preciso nos valores. Use os dados reais fornecidos.`,
      },
      {
        role: "user",
        content: `PLANO: ${plano.nome}
ITENS DO PLANO (${itens.length}):
${JSON.stringify(itensSummary, null, 2)}

MÉTRICAS DE FORNECEDORES (últimos 12 meses):
${JSON.stringify(metricasSummary, null, 2)}`,
      },
    ],
    tools,
    { type: "function", function: { name: "audit_result" } },
    "google/gemini-2.5-pro"
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("IA não retornou resultado da auditoria");

  const auditResult = JSON.parse(toolCall.function.arguments);
  return { ...auditResult, plano_nome: plano.nome, audit_date: new Date().toISOString() };
}

// ────────── MAIN HANDLER ──────────
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // JWT Authentication
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
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
      case "audit_document":
        result = await handleAuditDocument(params);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[expense-ai-assistant] error:", e);
    const err = e as { status?: number; message?: string };
    const status = err.status || 500;
    const message = err.message || (e instanceof Error ? e.message : "Unknown error");

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

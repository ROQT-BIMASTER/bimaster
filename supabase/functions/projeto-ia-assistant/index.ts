import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(
  messages: { role: string; content: string | unknown[] }[],
  tools?: unknown[],
  toolChoice?: unknown,
  model = "google/gemini-3-flash-preview"
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
    if (res.status === 429) throw { status: 429, message: "Limite de requisições excedido. Tente novamente em instantes." };
    if (res.status === 402) throw { status: 402, message: "Créditos insuficientes para IA." };
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

// ─── TOOL SCHEMAS ───
const TASK_SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string", description: "Título conciso da tarefa" },
    descricao: { type: "string", description: "Descrição detalhada" },
    secao_id: { type: "string", description: "ID da seção existente, ou vazio se nova seção" },
    secao_nome: { type: "string", description: "Nome da seção (para novas seções ou referência)" },
    prioridade: { type: "string", enum: ["baixa", "media", "alta"] },
    estagio: { type: "string", enum: ["briefing", "em_criacao", "revisao", "aprovado", "producao", "lancamento"] },
    data_prazo: { type: "string", description: "Data prazo YYYY-MM-DD" },
    produto_mencionado: { type: "string", description: "Nome do produto mencionado, se houver" },
  },
  required: ["titulo", "prioridade"],
  additionalProperties: false,
};

const SECAO_SCHEMA = {
  type: "object",
  properties: {
    nome: { type: "string", description: "Nome da seção" },
  },
  required: ["nome"],
  additionalProperties: false,
};

function buildToolSchema(createType: string) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  if (createType === "secoes" || createType === "ambos") {
    properties.secoes = { type: "array", items: SECAO_SCHEMA };
    required.push("secoes");
  }
  if (createType === "tarefas" || createType === "ambos") {
    properties.tasks = { type: "array", items: TASK_SCHEMA };
    required.push("tasks");
  }

  return [{
    type: "function",
    function: {
      name: "create_items",
      description: "Cria seções e/ou tarefas estruturadas a partir da descrição ou arquivo.",
      parameters: {
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    },
  }];
}

// ─── ACTION: create_tasks ───
async function handleCreateTasks(
  prompt: string,
  projetoId: string,
  secoes: { id: string; nome: string }[],
  createType = "tarefas"
) {
  const secoesStr = secoes.map(s => `- ${s.nome} (id: ${s.id})`).join("\n");

  const systemPrompt = `Você é um assistente de projetos de lançamento de produtos (cosméticos/higiene). 
O usuário vai descrever o que precisa. Você deve criar ${createType === "secoes" ? "seções" : createType === "ambos" ? "seções e tarefas" : "tarefas"} estruturadas.

Seções existentes no projeto:
${secoesStr}

Estágios disponíveis: briefing, em_criacao, revisao, aprovado, producao, lancamento
Prioridades: baixa, media, alta

Regras:
${createType !== "secoes" ? `- Crie entre 1 e 10 tarefas
- Use secao_id para seções existentes. Se sugerir nova seção, deixe secao_id vazio e preencha secao_nome
- Sugira prazos realistas (formato YYYY-MM-DD) a partir da data atual
- Se o usuário mencionar um produto, inclua o nome no campo produto_mencionado
- Títulos devem ser concisos e acionáveis` : ""}
${createType !== "tarefas" ? `- Sugira seções que organizem logicamente o trabalho
- Nomes de seção devem ser curtos e descritivos` : ""}`;

  const tools = buildToolSchema(createType);

  const result = await callAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    tools,
    { type: "function", function: { name: "create_items" } }
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("IA não retornou resultados");

  const parsed = JSON.parse(toolCall.function.arguments);
  return {
    secoes: parsed.secoes || [],
    tasks: parsed.tasks || [],
  };
}

// ─── ACTION: create_from_file ───
async function handleCreateFromFile(
  fileContent: string,
  fileType: string,
  createType: string,
  projetoId: string,
  secoes: { id: string; nome: string }[],
  prompt?: string
) {
  const secoesStr = secoes.map(s => `- ${s.nome} (id: ${s.id})`).join("\n");

  const systemPrompt = `Você é um assistente de projetos de lançamento de produtos (cosméticos/higiene).
O usuário enviou um arquivo (${fileType}) para que você interprete e crie ${createType === "secoes" ? "seções" : createType === "ambos" ? "seções e tarefas" : "tarefas"} estruturadas.

Seções existentes no projeto:
${secoesStr}

Estágios disponíveis: briefing, em_criacao, revisao, aprovado, producao, lancamento
Prioridades: baixa, media, alta

Regras:
${createType !== "secoes" ? `- Crie tarefas baseadas no conteúdo do arquivo
- Use secao_id para seções existentes. Se sugerir nova seção, deixe secao_id vazio e preencha secao_nome
- Sugira prazos realistas (formato YYYY-MM-DD)
- Se encontrar produtos mencionados, inclua no campo produto_mencionado
- Títulos devem ser concisos e acionáveis` : ""}
${createType !== "tarefas" ? `- Sugira seções que organizem logicamente o conteúdo do arquivo
- Nomes de seção devem ser curtos e descritivos` : ""}
${prompt ? `\nInstrução adicional do usuário: ${prompt}` : ""}`;

  const tools = buildToolSchema(createType);

  // Build message content - use multimodal if image
  const isImage = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(fileType);

  let userContent: string | unknown[];
  if (isImage) {
    userContent = [
      { type: "text", text: "Analise esta imagem e crie itens estruturados baseados no conteúdo:" },
      { type: "image_url", image_url: { url: `data:${fileType};base64,${fileContent}` } },
    ];
  } else {
    userContent = `Analise o conteúdo deste arquivo e crie itens estruturados:\n\n${fileContent}`;
  }

  const result = await callAI(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    tools,
    { type: "function", function: { name: "create_items" } },
    "google/gemini-2.5-flash"
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("IA não conseguiu interpretar o arquivo");

  const parsed = JSON.parse(toolCall.function.arguments);
  return {
    secoes: parsed.secoes || [],
    tasks: parsed.tasks || [],
  };
}

// ─── ACTION: suggest_fields ───
async function handleSuggestFields(
  titulo: string,
  descricaoAtual: string | null,
  projetoNome: string,
  secaoNome: string
) {
  const tools = [
    {
      type: "function",
      function: {
        name: "suggest_fields",
        description: "Sugere preenchimento para uma tarefa de projeto.",
        parameters: {
          type: "object",
          properties: {
            descricao: { type: "string", description: "Descrição detalhada sugerida" },
            prioridade: { type: "string", enum: ["baixa", "media", "alta"] },
            estagio: { type: "string", enum: ["briefing", "em_criacao", "revisao", "aprovado", "producao", "lancamento"] },
            dias_prazo_sugerido: { type: "number", description: "Quantidade de dias úteis sugeridos para prazo" },
          },
          required: ["descricao", "prioridade", "estagio", "dias_prazo_sugerido"],
          additionalProperties: false,
        },
      },
    },
  ];

  const result = await callAI(
    [
      {
        role: "system",
        content: `Você é um assistente de projetos de lançamento de produtos (cosméticos/higiene).
Analise o título da tarefa e sugira preenchimento inteligente.
Projeto: "${projetoNome}", Seção: "${secaoNome}".
${descricaoAtual ? `Descrição atual: "${descricaoAtual}"` : "Sem descrição ainda."}`
      },
      { role: "user", content: `Sugira campos para a tarefa: "${titulo}"` },
    ],
    tools,
    { type: "function", function: { name: "suggest_fields" } }
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("IA não retornou sugestões");

  return JSON.parse(toolCall.function.arguments);
}

// ─── ACTION: generate_checklist ───
async function handleGenerateChecklist(titulo: string, descricao: string | null, estagio: string | null) {
  const tools = [
    {
      type: "function",
      function: {
        name: "generate_checklist",
        description: "Gera uma checklist de subtarefas para uma tarefa de projeto.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  titulo: { type: "string" },
                  ordem: { type: "number" },
                },
                required: ["titulo", "ordem"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
  ];

  const result = await callAI(
    [
      {
        role: "system",
        content: `Você é um assistente de projetos de lançamento de produtos (cosméticos/higiene).
Dado o tipo de tarefa, gere uma checklist de 3-8 subtarefas necessárias para completá-la.
As subtarefas devem ser acionáveis e seguir uma ordem lógica.
${estagio ? `Estágio atual: ${estagio}` : ""}`
      },
      {
        role: "user",
        content: `Gere checklist para: "${titulo}"${descricao ? `. Descrição: ${descricao}` : ""}`,
      },
    ],
    tools,
    { type: "function", function: { name: "generate_checklist" } }
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("IA não retornou checklist");

  return JSON.parse(toolCall.function.arguments);
}

// ─── ACTION: project_summary ───
async function handleProjectSummary(projetoId: string) {
  const sb = getSupabaseAdmin();

  const { data: projeto } = await sb.from("projetos").select("nome, descricao").eq("id", projetoId).single();
  const { data: tarefas } = await sb
    .from("projeto_tarefas")
    .select("id, titulo, status, prioridade, data_prazo, estagio, responsavel_id, secao_id")
    .eq("projeto_id", projetoId);

  const { data: secoes } = await sb
    .from("projeto_secoes")
    .select("id, nome")
    .eq("projeto_id", projetoId)
    .order("ordem");

  if (!tarefas || tarefas.length === 0) {
    return { summary: "Este projeto ainda não possui tarefas." };
  }

  const total = tarefas.length;
  const concluidas = tarefas.filter((t: any) => t.status === "concluida").length;
  const atrasadas = tarefas.filter((t: any) => t.data_prazo && new Date(t.data_prazo) < new Date() && t.status !== "concluida").length;
  const semResponsavel = tarefas.filter((t: any) => !t.responsavel_id && t.status !== "concluida").length;
  const altaPrioridade = tarefas.filter((t: any) => t.prioridade === "alta" && t.status !== "concluida").length;

  const secaoMap: Record<string, string> = {};
  (secoes || []).forEach((s: any) => { secaoMap[s.id] = s.nome; });

  const context = `Projeto: ${projeto?.nome || "Sem nome"}
${projeto?.descricao ? `Descrição: ${projeto.descricao}` : ""}
Total de tarefas: ${total}
Concluídas: ${concluidas} (${Math.round((concluidas / total) * 100)}%)
Atrasadas: ${atrasadas}
Sem responsável: ${semResponsavel}
Alta prioridade pendentes: ${altaPrioridade}

Tarefas detalhadas:
${tarefas.map((t: any) => `- [${t.status}] ${t.titulo} | Prioridade: ${t.prioridade} | Prazo: ${t.data_prazo || "sem prazo"} | Seção: ${secaoMap[t.secao_id] || "?"} | ${t.responsavel_id ? "Com responsável" : "SEM RESPONSÁVEL"}`).join("\n")}`;

  const result = await callAI([
    {
      role: "system",
      content: `Você é um gerente de projetos de lançamento de produtos. Analise os dados do projeto e forneça:

1. **Status Geral**: Um parágrafo resumindo o estado do projeto
2. **Riscos Identificados**: Liste os principais riscos (tarefas atrasadas, sem responsável, gargalos)
3. **Próximos Passos**: 3-5 ações recomendadas em ordem de prioridade

Responda em markdown, de forma clara e objetiva.`
    },
    { role: "user", content: context },
  ]);

  const summary = result.choices?.[0]?.message?.content;
  if (!summary) throw new Error("IA não retornou resumo");

  return {
    summary,
    stats: { total, concluidas, atrasadas, semResponsavel, altaPrioridade },
  };
}

// ─── ACTION: classify_document ───
async function handleClassifyDocument(fileName: string, tipoArquivo: string | null) {
  const categorias = [
    "briefing", "arte_final", "rotulo", "ficha_tecnica", "laudo",
    "certificado", "orcamento", "nota_fiscal", "art", "outro"
  ];

  const tools = [
    {
      type: "function",
      function: {
        name: "classify_document",
        description: "Classifica a categoria de um documento de projeto.",
        parameters: {
          type: "object",
          properties: {
            categoria: { type: "string", enum: categorias },
            confianca: { type: "number", description: "Nível de confiança de 0 a 1" },
          },
          required: ["categoria", "confianca"],
          additionalProperties: false,
        },
      },
    },
  ];

  const result = await callAI(
    [
      {
        role: "system",
        content: `Você classifica documentos de projetos de lançamento de produtos (cosméticos/higiene).
Categorias: ${categorias.join(", ")}.
Analise o nome e tipo do arquivo para sugerir a categoria mais adequada.`
      },
      {
        role: "user",
        content: `Arquivo: "${fileName}", tipo: ${tipoArquivo || "desconhecido"}`,
      },
    ],
    tools,
    { type: "function", function: { name: "classify_document" } }
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return { categoria: "outro", confianca: 0 };

  return JSON.parse(toolCall.function.arguments);
}

// ─── MAIN ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // ── JWT validation ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    console.log(`[projeto-ia-assistant] user=${userId}`);

    const { action, ...params } = await req.json();
    console.log(`[projeto-ia-assistant] action=${action}`);

    let result: unknown;

    switch (action) {
      case "create_tasks":
        result = await handleCreateTasks(params.prompt, params.projetoId, params.secoes, params.createType || "tarefas");
        break;
      case "create_from_file":
        result = await handleCreateFromFile(
          params.fileContent, params.fileType, params.createType || "ambos",
          params.projetoId, params.secoes, params.prompt
        );
        break;
      case "suggest_fields":
        result = await handleSuggestFields(params.titulo, params.descricao, params.projetoNome, params.secaoNome);
        break;
      case "generate_checklist":
        result = await handleGenerateChecklist(params.titulo, params.descricao, params.estagio);
        break;
      case "project_summary":
        result = await handleProjectSummary(params.projetoId);
        break;
      case "classify_document":
        result = await handleClassifyDocument(params.fileName, params.tipoArquivo);
        break;
      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("[projeto-ia-assistant] error:", e);
    const err = e as { status?: number; message?: string };
    const status = err.status || 500;
    const message = err.message || (e instanceof Error ? e.message : "Erro desconhecido");

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

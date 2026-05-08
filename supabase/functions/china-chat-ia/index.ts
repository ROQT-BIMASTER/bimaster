// supabase/functions/china-chat-ia/index.ts
// Assistente avançado do chat China–Brasil. Operações:
//  - "ask"     : responde como participante "@IA" (gera mensagem visível)
//  - "suggest" : 2-3 rascunhos de resposta no idioma do usuário (não envia)
//  - "summary" : TL;DR + pendências + próximas ações
//  - "actions" : sugere ações estruturadas (aprovar / pedir ajuste / encaminhar)
//                via tool calling — NUNCA executa, devolve a "proposta".
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const Body = z.object({
  submissao_id: z.string().uuid(),
  modo: z.enum(["ask", "suggest", "summary", "actions"]),
  pergunta: z.string().max(2000).optional(),
  idioma: z.enum(["pt", "zh", "en"]).default("pt"),
}).strict();

const LANG_NAME: Record<string, string> = { pt: "Português", zh: "中文", en: "English" };

const SYSTEM_BASE = `Você é o assistente IA do chat China–Brasil de uma fábrica de cosméticos. Sua função é facilitar a comunicação entre as equipes do Brasil e da China em projetos de produtos.

PRINCÍPIOS:
- Tom profissional, objetivo, sem emojis.
- Sempre baseie respostas no contexto da submissão (produto, OC, status, documentos, mensagens anteriores).
- Quando algo estiver ambíguo, pergunte em vez de inventar.
- Mantenha códigos (LDS####, OC, INCI, EAN) sem alteração.
- Respeite menções @nome.`;

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "china-chat-ia" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { submissao_id, modo, pergunta, idioma } = parsed.data;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Carrega contexto: submissão + últimas 30 mensagens + documentos
    const { data: sub } = await sb
      .from("china_produto_submissoes")
      .select("id, produto_codigo, produto_nome, status, numero_ordem, formula_codigo, qty_total, observacoes_brasil, observacoes_china, submissao_status, doc_status, chat_status, created_at")
      .eq("id", submissao_id)
      .maybeSingle();
    if (!sub) {
      return new Response(JSON.stringify({ error: "Submissão não encontrada" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: msgsRaw } = await sb
      .from("china_chat_mensagens")
      .select("usuario_nome, tipo, conteudo, created_at")
      .eq("submissao_id", submissao_id)
      .order("created_at", { ascending: true })
      .limit(30);

    const { data: docs } = await sb
      .from("china_produto_documentos")
      .select("tipo_documento, status, observacoes")
      .eq("submissao_id", submissao_id)
      .limit(40);

    const contextoMsgs = (msgsRaw || []).map((m: any) =>
      `[${m.tipo === "ia" ? "IA" : m.tipo === "china" ? "China" : "Brasil"} · ${m.usuario_nome}]: ${m.conteudo}`
    ).join("\n");

    const contextoDocs = (docs || []).map((d: any) =>
      `- ${d.tipo_documento}: ${d.status || "—"}${d.observacoes ? ` (${d.observacoes})` : ""}`
    ).join("\n");

    const contextoSubmissao = `Produto: ${sub.produto_codigo} — ${sub.produto_nome}
OC: ${sub.numero_ordem || "—"}    Fórmula: ${sub.formula_codigo || "—"}    Qtd: ${sub.qty_total ?? "—"}
Status submissão: ${sub.submissao_status || sub.status}    Doc status: ${sub.doc_status || "—"}    Chat: ${sub.chat_status || "aberto"}
Observações Brasil: ${sub.observacoes_brasil || "—"}
Observações China: ${sub.observacoes_china || "—"}`;

    const userInstruction = (() => {
      switch (modo) {
        case "ask":
          return `O usuário perguntou no chat: "${pergunta || ""}". Responda diretamente, em ${LANG_NAME[idioma]}, no máximo 6 frases. Não repita o contexto, vá ao ponto.`;
        case "suggest":
          return `Gere 2 a 3 rascunhos curtos de resposta que o usuário poderia enviar agora ao outro lado (Brasil↔China), considerando o estado da submissão. Idioma de saída: ${LANG_NAME[idioma]}. Devolva como lista numerada (1., 2., 3.), uma frase por item, sem comentários.`;
        case "summary":
          return `Faça um TL;DR da conversa (2-4 bullets), depois liste "Pendências" e "Próximas ações sugeridas". Idioma: ${LANG_NAME[idioma]}. Use markdown leve (**negrito** e listas).`;
        case "actions":
          return `Analise a conversa e o estado da submissão. Se houver uma ação clara que o operador do Brasil pode executar agora (aprovar submissão, pedir ajuste com motivo, encaminhar a alguém, marcar como lida), proponha-a usando a tool apropriada. Se NÃO houver ação clara, responda em texto explicando o porquê em ${LANG_NAME[idioma]}.`;
      }
    })();

    const messages = [
      { role: "system", content: SYSTEM_BASE },
      {
        role: "user",
        content: `# Contexto da submissão\n${contextoSubmissao}\n\n# Documentos (resumo)\n${contextoDocs || "—"}\n\n# Conversa recente\n${contextoMsgs || "(sem mensagens)"}\n\n# Tarefa\n${userInstruction}`,
      },
    ];

    const tools = modo === "actions" ? [
      {
        type: "function",
        function: {
          name: "aprovar_submissao",
          description: "Aprovar a submissão atual da China.",
          parameters: { type: "object", additionalProperties: false, properties: {
            justificativa: { type: "string", description: "Justificativa breve (max 200 chars)." },
          }, required: ["justificativa"] },
        },
      },
      {
        type: "function",
        function: {
          name: "pedir_ajuste",
          description: "Solicitar ajuste à China com motivo claro.",
          parameters: { type: "object", additionalProperties: false, properties: {
            motivo: { type: "string", description: "Motivo do ajuste (obrigatório, em PT ou ZH)." },
            campos_afetados: { type: "array", items: { type: "string" }, description: "Lista de itens/documentos afetados." },
          }, required: ["motivo"] },
        },
      },
      {
        type: "function",
        function: {
          name: "encaminhar_responsavel",
          description: "Encaminhar a submissão a outro responsável interno.",
          parameters: { type: "object", additionalProperties: false, properties: {
            sugestao_nome: { type: "string", description: "Nome ou função sugerida (ex.: 'Regulatório', 'Maria')." },
            motivo: { type: "string" },
          }, required: ["sugestao_nome", "motivo"] },
        },
      },
      {
        type: "function",
        function: {
          name: "marcar_lida",
          description: "Marcar a submissão como lida sem mais ações.",
          parameters: { type: "object", additionalProperties: false, properties: {} },
        },
      },
    ] : undefined;

    const r = await callAIGateway({
      model: "google/gemini-3-flash-preview",
      timeoutMs: 45_000,
      messages,
      tools,
    });

    if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);

    const choice = r.data?.choices?.[0];
    const reply = (choice?.message?.content || "").trim();
    const tool_calls = choice?.message?.tool_calls || null;

    return new Response(JSON.stringify({
      ok: true,
      modo,
      reply,
      tool_calls,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  },
));

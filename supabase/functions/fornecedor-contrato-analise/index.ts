import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const Schema = z.object({
  contrato_id: z.string().uuid(),
}).strict();

const SYSTEM = `Você é um analista jurídico-financeiro. Receberá o conteúdo de um contrato de fornecedor.
Responda SEMPRE chamando a tool "registrar_analise_contrato" com JSON válido em português do Brasil.
Seja conciso, objetivo e não invente informações. Quando um campo não estiver no documento, use null ou string vazia.`;

const TOOL = {
  type: "function",
  function: {
    name: "registrar_analise_contrato",
    description: "Registra a análise estruturada do contrato",
    parameters: {
      type: "object",
      properties: {
        resumo: { type: "string", description: "Resumo executivo do contrato em 3-5 frases" },
        partes: {
          type: "object",
          properties: {
            contratante: { type: "string" },
            contratada: { type: "string" },
          },
        },
        objeto: { type: "string" },
        vigencia: {
          type: "object",
          properties: {
            inicio: { type: "string", description: "AAAA-MM-DD ou vazio" },
            fim: { type: "string", description: "AAAA-MM-DD ou vazio" },
            renovacao_automatica: { type: "boolean" },
          },
        },
        valores: {
          type: "object",
          properties: {
            mensal: { type: "string" },
            total: { type: "string" },
            reajuste: { type: "string" },
          },
        },
        multa_rescisao: { type: "string" },
        prazo_aviso_previo: { type: "string" },
        clausulas_criticas: { type: "array", items: { type: "string" } },
        alertas: { type: "array", items: { type: "string" } },
      },
      required: ["resumo"],
      additionalProperties: false,
    },
  },
};

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 10, rateLimitPrefix: "fornecedor-contrato-analise" },
  async (req) => {
    const cors = getCorsHeaders(req);
    const jsonHeaders = { ...cors, "Content-Type": "application/json" };

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const { contrato_id } = validateBody(body, Schema);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: contrato, error } = await supabase
      .from("fornecedor_contratos")
      .select("id, fornecedor_nome, arquivo_path, arquivo_mime, arquivo_nome")
      .eq("id", contrato_id)
      .maybeSingle();

    if (error || !contrato) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }),
        { status: 404, headers: jsonHeaders });
    }
    if (!contrato.arquivo_path) {
      return new Response(JSON.stringify({ error: "Contrato sem arquivo anexado" }),
        { status: 400, headers: jsonHeaders });
    }

    const { data: fileData, error: dlErr } = await supabase.storage
      .from("fornecedor-contratos")
      .download(contrato.arquivo_path);

    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Falha ao baixar arquivo" }),
        { status: 500, headers: jsonHeaders });
    }

    const buf = new Uint8Array(await fileData.arrayBuffer());
    // Limite defensivo: ~10MB para evitar payload gigante
    if (buf.byteLength > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({
        error: "Arquivo muito grande para análise (máx. 10MB)",
      }), { status: 413, headers: jsonHeaders });
    }

    // base64
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const mime = contrato.arquivo_mime || "application/pdf";

    const userContent: any[] = [
      {
        type: "text",
        text: `Analise o contrato em anexo do fornecedor "${contrato.fornecedor_nome ?? ""}". Use a tool para retornar o resultado.`,
      },
      {
        type: "image_url",
        image_url: { url: `data:${mime};base64,${b64}` },
      },
    ];

    const r = await callAIGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent },
      ],
      tools: [TOOL],
      tool_choice: { type: "function", function: { name: "registrar_analise_contrato" } },
      timeoutMs: 90_000,
    });

    if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);

    const toolCall = r.data?.choices?.[0]?.message?.tool_calls?.[0];
    let analise: any = null;
    try {
      analise = toolCall?.function?.arguments
        ? JSON.parse(toolCall.function.arguments)
        : null;
    } catch {
      analise = null;
    }

    if (!analise) {
      return new Response(JSON.stringify({
        error: "Não foi possível interpretar a resposta da IA",
      }), { status: 502, headers: jsonHeaders });
    }

    const resumo = typeof analise.resumo === "string" ? analise.resumo : null;

    const { error: upErr } = await supabase
      .from("fornecedor_contratos")
      .update({
        resumo_ia: resumo,
        analise_ia_json: analise,
        analise_ia_em: new Date().toISOString(),
      })
      .eq("id", contrato_id);

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }),
        { status: 500, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ ok: true, resumo, analise }),
      { headers: jsonHeaders });
  },
));

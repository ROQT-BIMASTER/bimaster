// Edge function: retrabalha um campo do briefing com base em comentários selecionados.
// mode = "apply"  -> atualiza o campo direto (com diff/undo no front)
// mode = "propose" -> insere proposta em briefing_mensagens para aceite no chat
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const Body = z.object({
  briefing_id: z.string().uuid(),
  campo_key: z.string().min(1).max(120),
  comment_ids: z.array(z.string().uuid()).min(1).max(20),
  mode: z.enum(["apply", "propose"]),
}).strict();

function buildSystemPrompt() {
  return [
    "Você é um editor sênior de briefings de marketing e trade.",
    "Reescreva APENAS o conteúdo do campo indicado, aplicando as instruções dos comentários.",
    "Mantenha tom profissional, objetivo, sem emojis. Preserve fatos já presentes salvo se um comentário pedir alteração explícita.",
    "Devolva o resultado pela função propose_rework com: novo_texto, racional curto e lista de mudancas (tipo: ajuste|adicao|remocao|reformulacao + descricao).",
  ].join(" ");
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 20, rateLimitPrefix: "briefing-rework-field" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    let parsed;
    try {
      parsed = Body.safeParse(await req.json());
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { briefing_id, campo_key, comment_ids, mode } = parsed.data;
    const userId = ctx.userId!;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Acesso
    const { data: canAccess } = await sb.rpc("can_access_briefing", {
      _briefing_id: briefing_id, _user_id: userId,
    });
    if (!canAccess) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Briefing + template
    const { data: briefing, error: bErr } = await sb
      .from("briefings")
      .select("id, tipo, payload, status, template_id")
      .eq("id", briefing_id)
      .maybeSingle();
    if (bErr || !briefing) {
      return new Response(JSON.stringify({ error: "briefing_not_found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (["enviado", "aprovado", "arquivado"].includes((briefing.status ?? "").toLowerCase())) {
      return new Response(JSON.stringify({ error: "briefing_read_only" }), {
        status: 409, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let sectionLabel = campo_key;
    let sectionPlaceholder = "";
    try {
      const { data: tpl } = await sb
        .from("briefing_templates")
        .select("sections")
        .eq("id", briefing.template_id)
        .maybeSingle();
      const sections = (tpl?.sections ?? []) as any[];
      const sec = sections.find((s) => s.key === campo_key);
      if (sec) {
        sectionLabel = sec.label ?? campo_key;
        sectionPlaceholder = sec.placeholder ?? "";
      }
    } catch { /* ignore */ }

    // Comentários
    const { data: comments, error: cErr } = await sb
      .from("briefing_comentarios")
      .select("id, body, author_id, created_at, parent_id")
      .in("id", comment_ids)
      .eq("briefing_id", briefing_id)
      .eq("campo_key", campo_key);
    if (cErr || !comments || comments.length === 0) {
      return new Response(JSON.stringify({ error: "comments_not_found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const textoAtual = String((briefing.payload as any)?.[campo_key] ?? "");

    const userMsg = [
      `CAMPO: ${sectionLabel}`,
      sectionPlaceholder ? `ORIENTAÇÃO ORIGINAL: ${sectionPlaceholder}` : "",
      "",
      "TEXTO ATUAL:",
      textoAtual || "(vazio)",
      "",
      "COMENTÁRIOS A APLICAR (em ordem):",
      ...comments.map((c, i) => `${i + 1}. ${c.body}`),
    ].filter(Boolean).join("\n");

    const tool = {
      type: "function" as const,
      function: {
        name: "propose_rework",
        description: "Retorna o novo texto do campo aplicando as instruções dos comentários.",
        parameters: {
          type: "object",
          properties: {
            novo_texto: { type: "string", description: "Texto reescrito do campo." },
            racional: { type: "string", description: "Resumo curto (1-3 frases) das mudanças." },
            mudancas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tipo: { type: "string", enum: ["ajuste", "adicao", "remocao", "reformulacao"] },
                  descricao: { type: "string" },
                },
                required: ["tipo", "descricao"],
                additionalProperties: false,
              },
            },
          },
          required: ["novo_texto", "racional", "mudancas"],
          additionalProperties: false,
        },
      },
    };

    const r = await callAIGateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: userMsg },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "propose_rework" } },
    });
    if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);

    const call = r.data?.choices?.[0]?.message?.tool_calls?.[0];
    let result: { novo_texto: string; racional: string; mudancas: any[] };
    try {
      result = JSON.parse(call?.function?.arguments ?? "{}");
      if (!result.novo_texto) throw new Error("missing novo_texto");
    } catch {
      return new Response(JSON.stringify({ error: "ai_invalid_output" }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const aiReqId = crypto.randomUUID();

    if (mode === "apply") {
      const novoPayload = { ...(briefing.payload as any), [campo_key]: result.novo_texto };
      const { error: upErr } = await sb
        .from("briefings")
        .update({ payload: novoPayload, status: "em_andamento" })
        .eq("id", briefing_id);
      if (upErr) {
        return new Response(JSON.stringify({ error: "save_failed", details: upErr.message }), {
          status: 500, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      await sb.from("briefing_comentarios")
        .update({
          ai_status: "applied",
          ai_request_id: aiReqId,
          resolved: true,
          resolved_by: userId,
          resolved_at: new Date().toISOString(),
        })
        .in("id", comment_ids);

      await sb.from("briefing_mensagens").insert({
        briefing_id,
        role: "assistant",
        content: `Campo **${sectionLabel}** retrabalhado a partir de ${comments.length} comentário(s).\n\n${result.racional}`,
        proposals: [],
        sources: [],
        model: "google/gemini-3-flash-preview",
      });

      return new Response(JSON.stringify({
        ok: true,
        mode,
        novo_texto: result.novo_texto,
        texto_anterior: textoAtual,
        racional: result.racional,
        mudancas: result.mudancas,
        ai_request_id: aiReqId,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // propose
    const { data: msg, error: mErr } = await sb.from("briefing_mensagens").insert({
      briefing_id,
      role: "assistant",
      content: `Proposta de retrabalho do campo **${sectionLabel}** baseada em ${comments.length} comentário(s).\n\n${result.racional}`,
      proposals: [{
        campo_key,
        label: sectionLabel,
        texto_atual: textoAtual,
        texto_proposto: result.novo_texto,
        racional: result.racional,
        mudancas: result.mudancas,
        source: "comentarios",
        comment_ids,
        ai_request_id: aiReqId,
      }],
      sources: [],
      model: "google/gemini-3-flash-preview",
    }).select("id").maybeSingle();

    if (mErr) {
      return new Response(JSON.stringify({ error: "save_failed", details: mErr.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    await sb.from("briefing_comentarios")
      .update({ ai_status: "proposed", ai_request_id: aiReqId })
      .in("id", comment_ids);

    return new Response(JSON.stringify({
      ok: true,
      mode,
      message_id: msg?.id,
      novo_texto: result.novo_texto,
      racional: result.racional,
      mudancas: result.mudancas,
      ai_request_id: aiReqId,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  },
));

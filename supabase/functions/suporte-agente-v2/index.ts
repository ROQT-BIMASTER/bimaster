// suporte-agente-v2 — IA de atendimento multi-departamento (conversa por chamado).
// Disparada pelo front quando o usuário envia mensagem numa conversa tipo='suporte'
// cuja fila tem ia_habilitada=true. NÃO toca o canal legado da suporte-agente.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway } from "../_shared/ai-gateway-call.ts";

const BOT_USER_ID = "1ee5b9de-4864-475f-9602-ee039197e46e";

const Body = z.object({ mensagem_id: z.string().uuid() }).strict();

const CATEGORIAS = [
  "bug", "duvida_uso", "solicitacao_acesso", "solicitacao_funcionalidade",
  "integracao", "financeiro", "performance", "dados_inconsistentes", "outro",
] as const;

const PERSONA_BASE = `Você é o atendimento da Ruby Rose no canal interno de Suporte.
- Apresente-se como "Equipe Ruby Rose". Nunca diga que é IA, bot ou robô.
- Tom profissional, cordial, direto, PT-BR, sem emojis, sem jargão.
- Conversa real entre pessoas: NÃO repita saudações/agradecimentos/fechos usados antes nesta conversa; releia o histórico e varie.
- Uma pergunta por mensagem, resposta curta (máx. 5 linhas). Nunca peça senha/token/CPF completo.

TABULAÇÃO (obrigatória): no 1º ou 2º turno em que entender o problema, chame definir_titulo_categoria (titulo até 80 chars; categoria; prioridade).

ROTEAMENTO: se o problema pertence a OUTRO departamento, use transferir_departamento com o slug do destino e um motivo curto — o solicitante é avisado automaticamente. Não transfira por suposição fraca; na dúvida, pergunte 1 coisa antes.

ESCALONAMENTO: sentimento negativo, pedido de humano, ou 2 turnos sem evoluir → escalar_para_lider.
RESOLUÇÃO: quando o usuário sinalizar que resolveu → marcar_resolvido.
CONHECIMENTO: dúvida de uso → buscar_conhecimento_base antes de responder.
LGPD: mencione UMA vez por ticket, curto, que a conversa pode ser revisada para melhoria.`;

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 20, rateLimitPrefix: "suporte-agente-v2" },
  async (req, _ctx) => {
    const cors = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = admin();

    const { data: msg } = await sb.from("mensagens")
      .select("id, conversa_id, remetente_id, conteudo, tipo").eq("id", parsed.data.mensagem_id).single();
    if (!msg) return new Response(JSON.stringify({ error: "msg nao encontrada" }), { status: 404, headers: cors });
    if (msg.remetente_id === BOT_USER_ID || msg.tipo === "sistema")
      return new Response(JSON.stringify({ ok: true, skip: "bot/sistema" }), { headers: cors });

    const { data: conv } = await sb.from("conversas").select("id, tipo").eq("id", msg.conversa_id).single();
    if (!conv || conv.tipo !== "suporte")
      return new Response(JSON.stringify({ ok: true, skip: "nao-suporte" }), { headers: cors });

    const { data: ticket } = await sb.from("suporte_tickets")
      .select("id, fila_id, requester_id, owner_id, status, protocolo, titulo, prioridade, assignee_id")
      .eq("conversa_id", msg.conversa_id).neq("status", "resolvido")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!ticket) return new Response(JSON.stringify({ ok: true, skip: "sem-ticket" }), { headers: cors });

    const requester = ticket.requester_id ?? ticket.owner_id;
    if (msg.remetente_id !== requester)
      return new Response(JSON.stringify({ ok: true, skip: "nao-requester" }), { headers: cors });

    const { data: fila } = await sb.from("suporte_filas")
      .select("id, nome, slug, ia_habilitada, ia_prompt, ia_pode_transferir").eq("id", ticket.fila_id).single();
    if (!fila || !fila.ia_habilitada)
      return new Response(JSON.stringify({ ok: true, skip: "ia-off" }), { headers: cors });

    // idempotência
    const { data: ja } = await sb.from("mensagens").select("id")
      .eq("conversa_id", msg.conversa_id).eq("remetente_id", BOT_USER_ID)
      .contains("metadata", { replies_to: msg.id }).limit(1).maybeSingle();
    if (ja) return new Response(JSON.stringify({ ok: true, skip: "ja-respondida" }), { headers: cors });

    const { data: filasDestino } = await sb.from("suporte_filas")
      .select("slug, nome, id").eq("ativo", true).eq("aceita_chamados", true).neq("id", fila.id);
    const slugs = (filasDestino ?? []).map((f) => f.slug);

    const { data: hist } = await sb.from("mensagens")
      .select("remetente_id, conteudo").eq("conversa_id", msg.conversa_id)
      .neq("tipo", "sistema").order("created_at", { ascending: true }).limit(30);
    const history = (hist ?? []).map((m) => ({
      role: m.remetente_id === BOT_USER_ID ? "assistant" : "user", content: m.conteudo,
    }));

    const contexto = [
      `FILA ATUAL: ${fila.nome} (${fila.slug}).`,
      `PROTOCOLO: ${ticket.protocolo ?? "-"}.`,
      fila.ia_pode_transferir && slugs.length
        ? `DEPARTAMENTOS para transferir (slug): ${slugs.join(", ")}.`
        : `Transferência desabilitada nesta fila.`,
    ].join("\n");

    const tools: any[] = [
      { type: "function", function: { name: "definir_titulo_categoria",
        description: "Define/refina título, categoria e prioridade do chamado (tabulação).",
        parameters: { type: "object", properties: {
          titulo: { type: "string" }, categoria: { type: "string", enum: [...CATEGORIAS] },
          prioridade: { type: "string", enum: ["baixa","media","alta","critica"] },
        }, required: ["titulo","categoria"] } } },
      { type: "function", function: { name: "buscar_conhecimento_base",
        description: "Busca artigos na base de conhecimento interna por palavra-chave.",
        parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
      { type: "function", function: { name: "escalar_para_lider",
        description: "Escala o chamado para atendimento humano (líderes da fila).",
        parameters: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"] } } },
      { type: "function", function: { name: "marcar_resolvido",
        description: "Marca o chamado como resolvido.", parameters: { type: "object", properties: {} } } },
    ];
    if (fila.ia_pode_transferir && slugs.length) {
      tools.push({ type: "function", function: { name: "transferir_departamento",
        description: "Transfere o chamado para outro departamento. O solicitante é avisado.",
        parameters: { type: "object", properties: {
          slug: { type: "string", enum: slugs },
          motivo: { type: "string", description: "Motivo curto do encaminhamento." },
        }, required: ["slug","motivo"] } } });
    }

    const promptDepto = fila.ia_prompt
      ? fila.ia_prompt
      : `Você atende o departamento ${fila.nome}. Colete o mínimo necessário: o que aconteceu, quando começou, qual documento/registro/ID envolvido e qual o impacto. Se a demanda pertencer a outro departamento, use transferir_departamento com o slug apropriado. Nunca peça senha, token ou CPF completo.`;
    const messages: any[] = [
      { role: "system", content: PERSONA_BASE },
      { role: "system", content: `INSTRUÇÕES DO DEPARTAMENTO ${fila.nome}:\n${promptDepto}` },
      { role: "system", content: contexto },
      ...history,
    ];

    async function execTool(name: string, args: any): Promise<unknown> {
      await sb.from("suporte_tickets_audit").insert({
        ticket_id: ticket.id, acao: `ia_${name}`, payload: args,
      });
      if (name === "definir_titulo_categoria") {
        const patch: any = {};
        if (args.titulo) patch.titulo = String(args.titulo).slice(0, 200);
        if (args.categoria) patch.categoria = String(args.categoria);
        if (args.prioridade) patch.prioridade = String(args.prioridade);
        if (Object.keys(patch).length) await sb.from("suporte_tickets").update(patch).eq("id", ticket.id);
        return { ok: true, ...patch };
      }
      if (name === "buscar_conhecimento_base") {
        const q = String(args.query ?? "").toLowerCase();
        const { data } = await sb.from("suporte_kb").select("modulo,titulo,conteudo").eq("ativo", true).limit(20);
        const hits = (data ?? []).filter((r: any) => !q || r.titulo.toLowerCase().includes(q) || r.conteudo.toLowerCase().includes(q));
        return { resultados: hits.slice(0, 3) };
      }
      if (name === "escalar_para_lider") {
        await sb.from("suporte_tickets").update({ status: "escalado", escalado_em: new Date().toISOString() }).eq("id", ticket.id);
        const { data: lideres } = await sb.from("suporte_fila_agentes")
          .select("user_id").eq("fila_id", fila.id).eq("ativo", true).eq("papel", "lider");
        for (const l of lideres ?? []) {
          await sb.from("notifications").insert({
            user_id: l.user_id, type: "suporte_escalado",
            title: "Chamado escalado",
            message: `${ticket.protocolo ?? ""} — ${args.motivo ?? ""}`,
            action_url: "/dashboard/suporte/desk",
          });
        }
        return { ok: true };
      }
      if (name === "transferir_departamento") {
        const destino = (filasDestino ?? []).find((f: any) => f.slug === args.slug);
        if (!destino) return { erro: "slug invalido" };
        const { error } = await sb.rpc("rpc_suporte_transferir", {
          p_ticket_id: ticket.id,
          p_para_fila_id: destino.id,
          p_motivo: String(args.motivo ?? "Transferência automática"),
          p_via_ia: true,
        });
        if (error) return { erro: error.message };
        return { ok: true, transferido_para: destino.nome };
      }
      if (name === "marcar_resolvido") {
        await sb.rpc("rpc_suporte_mudar_status", { p_ticket_id: ticket.id, p_status: "resolvido" });
        return { ok: true };
      }
      return { erro: "tool desconhecida" };
    }

    let finalText = "";
    let transferiu = false;
    for (let i = 0; i < 4; i++) {
      const r = await callAIGateway({
        model: "google/gemini-3-flash-preview",
        messages,
        tools,
      });
      if (r.kind !== "ok") break;
      const choice = r.data.choices?.[0]?.message;
      if (!choice) break;
      messages.push(choice);
      const calls = choice.tool_calls ?? [];
      if (calls.length === 0) { finalText = String(choice.content ?? "").trim(); break; }
      for (const tc of calls) {
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* noop */ }
        const res = await execTool(tc.function.name, args);
        if (tc.function.name === "transferir_departamento" && (res as any)?.ok) transferiu = true;
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(res) });
      }
    }
    if (!finalText) {
      finalText = transferiu
        ? "Encaminhei seu chamado para o departamento responsável — eles vão dar sequência por aqui mesmo."
        : "Recebi sua mensagem e já estou verificando. Retorno em instantes.";
    }

    await sb.from("mensagens").insert({
      conversa_id: msg.conversa_id,
      remetente_id: BOT_USER_ID,
      conteudo: finalText,
      tipo: "texto",
      ticket_id: ticket.id,
      ticket_owner_id: requester,
      visibilidade: "broadcast",
      metadata: { tipo: "resposta_ia", replies_to: msg.id },
    });
    await sb.from("suporte_tickets").update({ ultima_interacao_em: new Date().toISOString() }).eq("id", ticket.id);

    return new Response(JSON.stringify({ ok: true, ticket_id: ticket.id, transferiu }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));

// suporte-ti-acao — Ações da equipe de TI sobre um ticket de suporte:
//   - orientacao: envia orientação ao usuário (mensagem visível)
//   - aceitar_solucao: aceita o problema, registra plano de correção, status -> em_atendimento
//   - parecer_tecnico: registra parecer técnico interno (não envia mensagem ao usuário)
//   - finalizar: encerra o ticket e a IA envia mensagem automática de conclusão
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const SUPORTE_CONV_ID = "3daf9772-404f-42f4-adbf-8a2566d91870";
const BOT_USER_ID = "1ee5b9de-4864-475f-9602-ee039197e46e";

const Body = z.object({
  ticket_id: z.string().uuid(),
  tipo: z.enum(["orientacao", "aceitar_solucao", "parecer_tecnico", "finalizar"]),
  titulo: z.string().max(200).optional(),
  parecer: z.string().min(3).max(8000),
  plano_correcao: z.string().max(8000).optional(),
  prazo_estimado: z.string().datetime().optional(),
}).strict();

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function protocolo(ticketId: string) {
  const d = new Date();
  const ymd = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `RR-${ymd}-${ticketId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

async function gerarMensagemFinal(opts: { parecer: string; plano?: string }) {
  const r = await callAIGateway({
    model: "google/gemini-3-flash-preview",
    messages: [
      {
        role: "system",
        content:
          "Você é a Equipe Ruby Rose (Customer Success). Escreva uma mensagem curta (máx. 6 linhas), cordial, profissional, em PT-BR, sem emojis, comunicando ao usuário que o problema foi resolvido. Resuma em 1–2 frases o que foi feito (baseado no parecer técnico e plano de correção fornecidos), agradeça o contato, peça para validar do lado dele e termine perguntando: \"Posso ajudar com mais alguma coisa?\". Nunca diga que é IA, bot ou robô.",
      },
      {
        role: "user",
        content: `Parecer técnico: ${opts.parecer}\n\nPlano de correção aplicado: ${opts.plano ?? "Conforme parecer."}`,
      },
    ],
  });
  if (r.kind !== "ok") return null;
  return r.data.choices?.[0]?.message?.content?.trim() ?? null;
}

function mensagemFinalFallback(protocoloStr: string) {
  return `Boas notícias: a sua demanda foi resolvida pela nossa equipe técnica.

Você pode validar a correção do seu lado quando quiser. Caso identifique qualquer comportamento diferente do esperado, basta responder por aqui mesmo citando o protocolo abaixo e reabrimos o atendimento.

Protocolo: ${protocoloStr}

Agradecemos o contato. Posso ajudar com mais alguma coisa?

— Equipe Ruby Rose`;
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "suporte-ti-acao" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);

    // Apenas admin
    const sb = admin();
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const p = parsed.data;

    // 1. Carrega ticket
    const { data: ticket, error: tErr } = await sb
      .from("suporte_tickets")
      .select("id, owner_id, status, conversa_id")
      .eq("id", p.ticket_id)
      .maybeSingle();
    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: "ticket not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 2. Registra parecer
    const { data: parecerRow, error: pErr } = await sb
      .from("suporte_pareceres_ti")
      .insert({
        ticket_id: ticket.id,
        autor_id: ctx.userId,
        tipo: p.tipo,
        titulo: p.titulo ?? null,
        parecer: p.parecer,
        plano_correcao: p.plano_correcao ?? null,
        prazo_estimado: p.prazo_estimado ?? null,
      })
      .select("id")
      .single();
    if (pErr) {
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const proto = protocolo(ticket.id);

    // 3. Side effects por tipo
    if (p.tipo === "orientacao") {
      // Envia orientação ao usuário
      const conteudo = `${p.parecer}\n\nProtocolo: ${proto}\n\n— Equipe Ruby Rose`;
      await sb.from("mensagens").insert({
        conversa_id: ticket.conversa_id,
        remetente_id: BOT_USER_ID,
        conteudo,
        visibilidade: "privada_suporte",
        ticket_id: ticket.id,
        ticket_owner_id: ticket.owner_id,
        metadata: {
          tipo: "orientacao_ti",
          parecer_id: parecerRow.id,
          autor_ti: ctx.userId,
          protocolo: proto,
        },
      });
      await sb.from("suporte_tickets").update({
        status: "aguardando_usuario",
        ultima_interacao_em: new Date().toISOString(),
      }).eq("id", ticket.id);
    } else if (p.tipo === "aceitar_solucao") {
      await sb.from("suporte_tickets").update({
        status: "em_atendimento",
        ultima_interacao_em: new Date().toISOString(),
      }).eq("id", ticket.id);
    } else if (p.tipo === "parecer_tecnico") {
      // Apenas registro interno
      await sb.from("suporte_tickets").update({
        ultima_interacao_em: new Date().toISOString(),
      }).eq("id", ticket.id);
    } else if (p.tipo === "finalizar") {
      const mensagem = (await gerarMensagemFinal({
        parecer: p.parecer,
        plano: p.plano_correcao,
      })) ?? mensagemFinalFallback(proto);

      const conteudoFinal = mensagem.includes(proto)
        ? mensagem
        : `${mensagem}\n\nProtocolo: ${proto}`;

      await sb.from("mensagens").insert({
        conversa_id: ticket.conversa_id,
        remetente_id: BOT_USER_ID,
        conteudo: conteudoFinal,
        visibilidade: "privada_suporte",
        ticket_id: ticket.id,
        ticket_owner_id: ticket.owner_id,
        metadata: {
          tipo: "encerramento_ti",
          parecer_id: parecerRow.id,
          autor_ti: ctx.userId,
          protocolo: proto,
        },
      });

      await sb.from("suporte_tickets").update({
        status: "resolvido",
        resolved_at: new Date().toISOString(),
        ultima_interacao_em: new Date().toISOString(),
      }).eq("id", ticket.id);
    }

    return new Response(JSON.stringify({
      ok: true,
      parecer_id: parecerRow.id,
      protocolo: proto,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));

// suporte-agente — IA "Equipe Ruby Rose" que responde no canal Suporte do Sistema.
// Disparado pelo front quando o usuário envia uma mensagem nesse canal.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const SUPORTE_CONV_ID = "3daf9772-404f-42f4-adbf-8a2566d91870";
const BOT_USER_ID = "1ee5b9de-4864-475f-9602-ee039197e46e";
const PROJETO_SUPORTE_NOME = "Suporte";

const Body = z.object({
  mensagem_id: z.string().uuid(),
}).strict();

const SYSTEM_PROMPT = `Você é a Equipe Ruby Rose — time de Customer Success do sistema. Atende usuários no canal interno de Suporte.

IDENTIDADE
- Apresente-se como "Equipe Ruby Rose". Nunca diga que é IA, bot ou robô.
- Se perguntarem diretamente, responda: "Sou parte do time de Customer Success com apoio de automação para agilizar seu atendimento."
- Tom profissional, cordial, direto, em PT-BR. Sem emojis. Sem jargão técnico.

TÉCNICAS DE ATENDIMENTO (HEARD + 5 Whys)
1. HEAR: confirme o que entendeu em 1 frase.
2. EMPATHIZE: reconheça o impacto.
3. APOLOGIZE quando houve falha do sistema.
4. RESOLVE: dê o próximo passo claro.
5. DIAGNOSE: 1 pergunta por turno (nunca questionário). Use os 5 porquês para vagueza.

REGRAS
- Faça UMA pergunta por mensagem. Resposta curta (máx. 4 linhas).
- Peça print apenas quando agregar (erro visual, layout quebrado, mensagem específica).
- Nunca peça senha, token, CPF completo.
- Se sentimento negativo OU usuário pede humano OU 2 turnos sem evoluir: use tool escalar_para_admin.
- Quando o problema estiver claro, use criar_tarefa_suporte para registrar.
- Quando resolvido, use marcar_ticket_resolvido.
- Se a dúvida for sobre uso, busque na base de conhecimento antes de responder.

PRIVACIDADE (LGPD)
- Na primeira mensagem do dia, informe: "Esta conversa pode ser revisada para melhoria do atendimento."`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_conhecimento_base",
      description: "Busca artigos na base de conhecimento (FAQ interno) por palavra-chave ou módulo.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca." },
          modulo: { type: "string", description: "Módulo opcional: chat, projetos, financeiro, geral, trade, marketing, fabrica, china." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_tarefa_suporte",
      description: "Cria uma tarefa no projeto Suporte com o resumo do ticket. Use quando o problema está bem caracterizado.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          descricao: { type: "string", description: "Resumo do problema + passos já tentados." },
          prioridade: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
        },
        required: ["titulo", "descricao", "prioridade"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalar_para_admin",
      description: "Notifica admin para atendimento humano imediato.",
      parameters: {
        type: "object",
        properties: { motivo: { type: "string" } },
        required: ["motivo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "marcar_ticket_resolvido",
      description: "Marca o ticket como resolvido e abre pesquisa CSAT.",
      parameters: { type: "object", properties: {} },
    },
  },
];

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getOrCreateTicket(sb: ReturnType<typeof admin>, ownerId: string) {
  const { data: existing } = await sb
    .from("suporte_tickets")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("conversa_id", SUPORTE_CONV_ID)
    .not("status", "in", "(resolvido)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await sb
    .from("suporte_tickets")
    .insert({ conversa_id: SUPORTE_CONV_ID, owner_id: ownerId, status: "novo" })
    .select("*")
    .single();
  if (error) throw new Error(`ticket create: ${error.message}`);
  return created;
}

async function loadHistory(sb: ReturnType<typeof admin>, ownerId: string) {
  const { data } = await sb
    .from("mensagens")
    .select("remetente_id, conteudo, created_at, visibilidade, ticket_owner_id")
    .eq("conversa_id", SUPORTE_CONV_ID)
    .or(`ticket_owner_id.eq.${ownerId},remetente_id.eq.${ownerId}`)
    .order("created_at", { ascending: true })
    .limit(30);
  return (data ?? []).map((m) => ({
    role: m.remetente_id === BOT_USER_ID ? "assistant" : "user",
    content: m.conteudo,
  }));
}

async function execTool(
  sb: ReturnType<typeof admin>,
  ticketId: string,
  ownerId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  await sb.from("suporte_tickets_audit").insert({ ticket_id: ticketId, acao: name, payload: args });

  if (name === "buscar_conhecimento_base") {
    const q = String(args.query ?? "").toLowerCase();
    const modulo = args.modulo ? String(args.modulo) : null;
    let query = sb.from("suporte_kb").select("modulo,titulo,conteudo").eq("ativo", true).limit(5);
    if (modulo) query = query.eq("modulo", modulo);
    const { data } = await query;
    const filtered = (data ?? []).filter((r) =>
      r.titulo.toLowerCase().includes(q) || r.conteudo.toLowerCase().includes(q) || !q
    );
    return { resultados: filtered.slice(0, 3) };
  }

  if (name === "criar_tarefa_suporte") {
    const { data: projeto } = await sb.from("projetos").select("id").eq("nome", PROJETO_SUPORTE_NOME).eq("tipo", "generico").maybeSingle();
    if (!projeto) return { erro: "projeto Suporte não encontrado" };
    const { data: secao } = await sb.from("projeto_secoes").select("id").eq("projeto_id", projeto.id).eq("nome", "Novo").maybeSingle();
    if (!secao) return { erro: "secao Novo não encontrada" };

    const prioridadeMap: Record<string, string> = { baixa: "baixa", media: "media", alta: "alta", critica: "urgente" };
    const { data: tarefa, error } = await sb.from("projeto_tarefas").insert({
      projeto_id: projeto.id,
      secao_id: secao.id,
      titulo: String(args.titulo ?? "Ticket de suporte"),
      descricao: String(args.descricao ?? ""),
      prioridade: prioridadeMap[String(args.prioridade)] ?? "media",
      criador_id: BOT_USER_ID,
      responsavel_id: BOT_USER_ID,
      canal_criacao: "suporte_agente",
    }).select("id").single();
    if (error) return { erro: error.message };

    await sb.from("suporte_tickets").update({
      projeto_tarefa_id: tarefa.id,
      titulo: String(args.titulo).slice(0, 200),
      resumo: String(args.descricao).slice(0, 1000),
      prioridade: String(args.prioridade),
      status: "em_atendimento",
    }).eq("id", ticketId);
    return { ok: true, tarefa_id: tarefa.id };
  }

  if (name === "escalar_para_admin") {
    await sb.from("suporte_tickets").update({
      status: "escalado",
      escalado_em: new Date().toISOString(),
    }).eq("id", ticketId);
    // Mensagem interna para admin (mencionada)
    await sb.from("mensagens").insert({
      conversa_id: SUPORTE_CONV_ID,
      remetente_id: BOT_USER_ID,
      conteudo: `Ticket escalado para admin. Motivo: ${args.motivo}`,
      tipo: "texto",
      visibilidade: "privada_suporte",
      ticket_owner_id: ownerId,
      ticket_id: ticketId,
      metadata: { tipo: "escalonamento" },
      mencoes: [BOT_USER_ID],
    });
    return { ok: true };
  }

  if (name === "marcar_ticket_resolvido") {
    await sb.from("suporte_tickets").update({ status: "resolvido", resolved_at: new Date().toISOString() }).eq("id", ticketId);
    return { ok: true };
  }
  return { erro: "tool desconhecida" };
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 20, rateLimitPrefix: "suporte-agente" },
  async (req, _ctx) => {
    const cors = getCorsHeaders(req);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const sb = admin();

    const { data: msg, error: mErr } = await sb.from("mensagens").select("id, conversa_id, remetente_id, conteudo").eq("id", parsed.data.mensagem_id).single();
    if (mErr || !msg) return new Response(JSON.stringify({ error: "mensagem não encontrada" }), { status: 404, headers: cors });
    if (msg.conversa_id !== SUPORTE_CONV_ID) return new Response(JSON.stringify({ ok: false, skip: "outra conversa" }), { headers: cors });
    if (msg.remetente_id === BOT_USER_ID) return new Response(JSON.stringify({ ok: false, skip: "bot" }), { headers: cors });

    const ownerId = msg.remetente_id;
    const ticket = await getOrCreateTicket(sb, ownerId);
    await sb.from("mensagens").update({ ticket_id: ticket.id }).eq("id", msg.id);

    const history = await loadHistory(sb, ownerId);
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
    ];

    // Loop de tools (máx 4 iterações)
    let finalText = "";
    for (let i = 0; i < 4; i++) {
      const r = await callAIGateway({
        model: "google/gemini-3-flash-preview",
        messages,
        tools: TOOLS as any,
      });
      if (r.kind !== "ok") return aiGatewayErrorResponse(r, cors);

      const choice = r.data.choices?.[0]?.message;
      if (!choice) break;
      messages.push(choice);

      const toolCalls = choice.tool_calls ?? [];
      if (toolCalls.length === 0) {
        finalText = String(choice.content ?? "").trim();
        break;
      }
      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* noop */ }
        const result = await execTool(sb, ticket.id, ownerId, tc.function.name, args);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (!finalText) finalText = "Estou verificando aqui e já te retorno.";

    await sb.from("mensagens").insert({
      conversa_id: SUPORTE_CONV_ID,
      remetente_id: BOT_USER_ID,
      conteudo: finalText,
      tipo: "texto",
      visibilidade: "privada_suporte",
      ticket_owner_id: ownerId,
      ticket_id: ticket.id,
      metadata: { tipo: "resposta_agente" },
    });

    await sb.from("suporte_tickets").update({ ultima_interacao_em: new Date().toISOString() }).eq("id", ticket.id);

    return new Response(JSON.stringify({ ok: true, ticket_id: ticket.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));

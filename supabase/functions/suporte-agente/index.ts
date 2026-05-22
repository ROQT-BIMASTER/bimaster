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

const CATEGORIAS = [
  "bug",
  "duvida_uso",
  "solicitacao_acesso",
  "solicitacao_funcionalidade",
  "integracao",
  "financeiro",
  "performance",
  "dados_inconsistentes",
  "outro",
] as const;

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

CLASSIFICAÇÃO OBRIGATÓRIA (TABULAÇÃO)
- LOGO no primeiro turno em que tiver entendido o problema (1º ou 2º turno no máximo),
  chame a tool definir_titulo_categoria informando:
    titulo: frase curta (máx 80 chars) descrevendo o problema do ponto de vista do usuário
    categoria: uma de [${CATEGORIAS.join(", ")}]
    prioridade: baixa | media | alta | critica
- Sempre que entender melhor o caso, pode chamar de novo para refinar título/categoria.
- Nunca deixe um ticket sem título e sem categoria.

REGRAS DE RESPOSTA (obrigatórias)
- SEMPRE responda. Nunca deixe o usuário sem resposta.
- Faça UMA pergunta por mensagem. Resposta curta (máx. 5 linhas).
- Toda mensagem deve terminar perguntando se o usuário precisa de mais alguma coisa
  (variações: "Posso ajudar com mais alguma coisa?", "Tem mais algum ponto que possamos resolver agora?").
- Peça print apenas quando agregar (erro visual, layout quebrado, mensagem específica).
- Nunca peça senha, token, CPF completo.

ESCALONAMENTO E REGISTRO
- Se sentimento negativo OU usuário pede humano OU 2 turnos sem evoluir: use tool escalar_para_admin.
- Quando o problema estiver claro, use criar_tarefa_suporte para registrar (informe também a categoria).
- Quando a tarefa for criada OU o ticket escalado, na MESMA resposta:
  1. Agradeça o contato.
  2. Informe: "Sua demanda foi direcionada à nossa equipe técnica."
  3. Informe o PROTOCOLO exatamente como recebido na mensagem do sistema (campo PROTOCOLO).
  4. Informe o prazo: "Prazo de retorno: até 24 horas úteis."
  5. Termine perguntando: "Posso ajudar com mais alguma coisa?"
- Quando o usuário sinalizar que está resolvido OU se despedir: use marcar_ticket_resolvido e finalize
  agradecendo o contato + reforce o PROTOCOLO + prazo de 24h úteis caso precise retomar.

CONHECIMENTO
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
      name: "definir_titulo_categoria",
      description: "Define ou refina título, categoria e prioridade do ticket atual para tabulação. Use logo no início do atendimento.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Frase curta (até 80 chars) descrevendo o problema." },
          categoria: { type: "string", enum: [...CATEGORIAS] },
          prioridade: { type: "string", enum: ["baixa", "media", "alta", "critica"] },
        },
        required: ["titulo", "categoria"],
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
          categoria: { type: "string", enum: [...CATEGORIAS] },
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

  if (name === "definir_titulo_categoria") {
    const titulo = String(args.titulo ?? "").slice(0, 200);
    const categoria = String(args.categoria ?? "outro");
    const prioridade = args.prioridade ? String(args.prioridade) : undefined;
    const patch: Record<string, unknown> = {};
    if (titulo) patch.titulo = titulo;
    if (categoria) patch.categoria = categoria;
    if (prioridade) patch.prioridade = prioridade;
    if (Object.keys(patch).length) {
      await sb.from("suporte_tickets").update(patch).eq("id", ticketId);
    }
    return { ok: true, ...patch };

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
      categoria: args.categoria ? String(args.categoria) : undefined,
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
    const resolvidoEm = new Date().toISOString();
    await sb.from("suporte_tickets").update({ status: "resolvido", resolved_at: resolvidoEm }).eq("id", ticketId);
    // Backfill: para que o ProtocolCountdown pare em todas as mensagens do ticket.
    const { data: msgsAnteriores } = await sb
      .from("mensagens")
      .select("id, metadata")
      .eq("ticket_id", ticketId);
    for (const msg of msgsAnteriores ?? []) {
      const meta = (msg.metadata ?? {}) as Record<string, unknown>;
      if (meta.resolvido_em) continue;
      await sb
        .from("mensagens")
        .update({ metadata: { ...meta, resolvido_em: resolvidoEm } })
        .eq("id", msg.id);
    }
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

    // Idempotência: se já existe resposta do bot referenciando esta mensagem, sai.
    const { data: jaRespondida } = await sb
      .from("mensagens")
      .select("id")
      .eq("conversa_id", SUPORTE_CONV_ID)
      .eq("remetente_id", BOT_USER_ID)
      .contains("metadata", { replies_to: parsed.data.mensagem_id })
      .limit(1)
      .maybeSingle();
    if (jaRespondida) {
      return new Response(JSON.stringify({ ok: true, skip: "ja_respondida" }), { headers: cors });
    }

    const ownerId = msg.remetente_id;
    const ticket = await getOrCreateTicket(sb, ownerId);
    await sb.from("mensagens").update({ ticket_id: ticket.id }).eq("id", msg.id);

    // Protocolo determinístico por ticket: RR-YYYYMMDD-XXXXXX
    const created = new Date(ticket.created_at);
    const yyyymmdd = `${created.getUTCFullYear()}${String(created.getUTCMonth() + 1).padStart(2, "0")}${String(created.getUTCDate()).padStart(2, "0")}`;
    const protocolo = `RR-${yyyymmdd}-${String(ticket.id).replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    const SLA_TEXTO = "Prazo de retorno: até 24 horas úteis.";

    const history = await loadHistory(sb, ownerId);
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `CONTEXTO DESTA INTERAÇÃO\nPROTOCOLO: ${protocolo}\nSLA: ${SLA_TEXTO}\nUse esse protocolo literal quando precisar informá-lo ao usuário.`,
      },
      ...history,
    ];

    // Loop de tools (máx 4 iterações)
    let finalText = "";
    let usouRegistroOuEscalonamento = false;
    let aiFalhou = false;
    for (let i = 0; i < 4; i++) {
      const r = await callAIGateway({
        model: "google/gemini-3-flash-preview",
        messages,
        tools: TOOLS as any,
      });
      if (r.kind !== "ok") { aiFalhou = true; break; }

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
        if (tc.function.name === "criar_tarefa_suporte" || tc.function.name === "escalar_para_admin") {
          usouRegistroOuEscalonamento = true;
        }
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Fallback: nunca deixa o usuário sem resposta.
    if (!finalText) {
      finalText = [
        "Obrigada pelo contato. Recebi sua mensagem e já estou verificando aqui.",
        `Sua demanda foi direcionada à nossa equipe técnica. Protocolo: ${protocolo}.`,
        SLA_TEXTO,
        "Posso ajudar com mais alguma coisa?",
      ].join(" ");
    } else {
      // Garantia: se a IA registrou tarefa/escalou e esqueceu de citar protocolo/SLA, anexa.
      const faltaProtocolo = !finalText.includes(protocolo);
      const faltaSla = !/24\s*h(oras)?/i.test(finalText);
      if (usouRegistroOuEscalonamento && (faltaProtocolo || faltaSla)) {
        finalText += `\n\nSua demanda foi direcionada à nossa equipe técnica. Protocolo: ${protocolo}. ${SLA_TEXTO}`;
      }
      // Garantia: sempre encerrar perguntando se precisa de mais algo.
      if (!/mais alguma coisa|mais algum ponto|posso ajudar com mais/i.test(finalText)) {
        finalText += "\n\nPosso ajudar com mais alguma coisa?";
      }
      if (aiFalhou) {
        finalText = [
          "Obrigada pelo contato. Recebi sua mensagem e já estou verificando aqui.",
          `Sua demanda foi direcionada à nossa equipe técnica. Protocolo: ${protocolo}.`,
          SLA_TEXTO,
          "Posso ajudar com mais alguma coisa?",
        ].join(" ");
      }
    }


    const prazoEm = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await sb.from("mensagens").insert({
      conversa_id: SUPORTE_CONV_ID,
      remetente_id: BOT_USER_ID,
      conteudo: finalText,
      tipo: "texto",
      visibilidade: "privada_suporte",
      ticket_owner_id: ownerId,
      ticket_id: ticket.id,
      metadata: {
        tipo: "resposta_agente",
        replies_to: parsed.data.mensagem_id,
        protocolo,
        sla_horas: 24,
        prazo_em: prazoEm,
      },
    });

    await sb.from("suporte_tickets").update({ ultima_interacao_em: new Date().toISOString() }).eq("id", ticket.id);

    return new Response(JSON.stringify({ ok: true, ticket_id: ticket.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
));

// chat-criar-tarefa-do-chat — Cria uma tarefa em um projeto a partir de uma mensagem do chat.
// Pipeline: secureHandler -> valida acesso à conversa e ao projeto -> opcionalmente
// gera sugestões via IA -> insere tarefa -> copia anexos -> registra vínculo.

import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const Body = z.object({
  mensagem_id: z.string().uuid(),
  projeto_id: z.string().uuid(),
  secao_id: z.string().uuid().optional(),
  // overrides do usuário (se omitir, usa sugestão IA / defaults)
  titulo: z.string().min(1).max(300).optional(),
  descricao: z.string().max(8000).optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  data_prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).optional(),
  copiar_anexos: z.boolean().optional(),
  // se true, só retorna sugestões IA sem criar
  apenas_sugerir: z.boolean().optional(),
}).strict();

interface Sugestao {
  titulo: string;
  descricao: string;
  data_prazo: string | null;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  responsavel_sugerido: string | null;
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "chat-criar-tarefa" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const userId = ctx.userId!;

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const input = parsed.data;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Carrega mensagem + valida participação na conversa
    const { data: msg, error: msgErr } = await sb
      .from("mensagens")
      .select("id, conversa_id, remetente_id, conteudo, tipo, created_at, metadata")
      .eq("id", input.mensagem_id)
      .maybeSingle();
    if (msgErr || !msg) {
      return new Response(JSON.stringify({ error: "Mensagem não encontrada" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: parte, error: parteErr } = await sb
      .from("conversas_participantes")
      .select("usuario_id")
      .eq("conversa_id", msg.conversa_id)
      .eq("usuario_id", userId)
      .is("saiu_em", null)
      .maybeSingle();
    if (parteErr || !parte) {
      return new Response(JSON.stringify({ error: "Sem acesso a esta conversa" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 2. Valida acesso ao projeto
    const { data: membro, error: membroErr } = await sb
      .from("projeto_membros")
      .select("user_id, papel")
      .eq("projeto_id", input.projeto_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (membroErr || !membro) {
      return new Response(JSON.stringify({ error: "Sem acesso a este projeto" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 3. Sugestão IA (rápida, baseada em últimas 8 mensagens da conversa)
    let sugestao: Sugestao = {
      titulo: (msg.conteudo || "Tarefa do chat").slice(0, 120),
      descricao: msg.conteudo || "",
      data_prazo: null,
      prioridade: "media",
      responsavel_sugerido: null,
    };

    const precisaSugerir = input.apenas_sugerir
      || !input.titulo
      || !input.descricao
      || (input.data_prazo === undefined);

    if (precisaSugerir) {
      const { data: ctxMsgs } = await sb
        .from("mensagens")
        .select("conteudo, remetente_id, created_at")
        .eq("conversa_id", msg.conversa_id)
        .lte("created_at", msg.created_at)
        .order("created_at", { ascending: false })
        .limit(8);

      const contexto = (ctxMsgs ?? []).reverse()
        .map((m: any) => `[${m.created_at}] ${m.remetente_id}: ${m.conteudo}`)
        .join("\n");

      const hoje = new Date().toISOString().slice(0, 10);
      const ai = await callAIGateway({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Você extrai tarefas a partir de mensagens de chat corporativo. " +
              "Responda APENAS JSON válido no formato " +
              `{"titulo":"...","descricao":"...","data_prazo":"YYYY-MM-DD"|null,"prioridade":"baixa"|"media"|"alta"|"urgente"}. ` +
              `Hoje é ${hoje} (America/Sao_Paulo). Interprete "amanhã", "sexta", "fim de semana" como datas reais. ` +
              "Título curto (até 80 chars), descrição clara em PT-BR com contexto relevante.",
          },
          {
            role: "user",
            content: `Contexto da conversa:\n${contexto}\n\n` +
              `Mensagem-alvo (criar tarefa a partir desta):\n"""${msg.conteudo}"""`,
          },
        ],
        timeoutMs: 25_000,
      });

      if (ai.kind === "ok") {
        try {
          const raw = ai.data?.choices?.[0]?.message?.content ?? "{}";
          const cleaned = raw.replace(/```json|```/g, "").trim();
          const parsedAi = JSON.parse(cleaned);
          if (parsedAi.titulo) sugestao.titulo = String(parsedAi.titulo).slice(0, 250);
          if (parsedAi.descricao) sugestao.descricao = String(parsedAi.descricao).slice(0, 8000);
          if (parsedAi.data_prazo && /^\d{4}-\d{2}-\d{2}$/.test(parsedAi.data_prazo)) {
            sugestao.data_prazo = parsedAi.data_prazo;
          }
          if (["baixa","media","alta","urgente"].includes(parsedAi.prioridade)) {
            sugestao.prioridade = parsedAi.prioridade;
          }
        } catch (_e) {
          // mantém defaults
        }
      } else if (ai.kind === "rate_limited" || ai.kind === "payment_required") {
        // se o usuário só pediu sugestão, falha amigável. Se for criar, segue com defaults.
        if (input.apenas_sugerir) return aiGatewayErrorResponse(ai, cors);
      }
    }

    if (input.apenas_sugerir) {
      return new Response(JSON.stringify({ sugestao }),
        { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 4. Resolve seção (primeira do projeto se não informada)
    let secaoId = input.secao_id;
    if (!secaoId) {
      const { data: secoes } = await sb
        .from("projeto_secoes")
        .select("id")
        .eq("projeto_id", input.projeto_id)
        .order("ordem", { ascending: true })
        .limit(1);
      secaoId = secoes?.[0]?.id;
    }
    if (!secaoId) {
      return new Response(JSON.stringify({ error: "Projeto sem seções. Crie uma seção primeiro." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 5. Cria a tarefa
    const titulo = (input.titulo ?? sugestao.titulo).trim().slice(0, 250);
    const descricaoBase = input.descricao ?? sugestao.descricao;
    const linkConversa = `\n\n— Originada de mensagem no chat (conversa ${msg.conversa_id})`;
    const descricaoFinal = (descricaoBase ?? "") + linkConversa;
    const prioridade = input.prioridade ?? sugestao.prioridade;
    const dataPrazo = input.data_prazo === undefined ? sugestao.data_prazo : input.data_prazo;
    const responsavelId = input.responsavel_id === undefined
      ? (sugestao.responsavel_sugerido ?? userId)
      : input.responsavel_id;

    const { data: tarefa, error: tarefaErr } = await sb
      .from("projeto_tarefas")
      .insert({
        projeto_id: input.projeto_id,
        secao_id: secaoId,
        titulo,
        descricao: descricaoFinal,
        responsavel_id: responsavelId,
        criador_id: userId,
        prioridade,
        data_prazo: dataPrazo,
        status: "pendente",
        canal_criacao: "chat",
      })
      .select("id, projeto_id, codigo, titulo")
      .single();

    if (tarefaErr || !tarefa) {
      return new Response(JSON.stringify({ error: `Falha ao criar tarefa: ${tarefaErr?.message}` }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 6. Copia anexos da mensagem (opcional, default true)
    const copiarAnexos = input.copiar_anexos !== false;
    let anexosCopiados = 0;
    if (copiarAnexos) {
      const { data: anexos } = await sb
        .from("mensagens_anexos")
        .select("id, file_name, storage_path, mime_type, size_bytes")
        .eq("mensagem_id", input.mensagem_id);

      for (const a of anexos ?? []) {
        try {
          const dl = await sb.storage.from("chat-anexos").download(a.storage_path);
          if (dl.error || !dl.data) continue;
          const newPath = `${userId}/${tarefa.id}/${crypto.randomUUID()}-${a.file_name}`;
          const up = await sb.storage.from("projeto-anexos").upload(newPath, dl.data, {
            contentType: a.mime_type,
            upsert: false,
          });
          if (up.error) continue;
          await sb.from("projeto_tarefa_anexos").insert({
            tarefa_id: tarefa.id,
            user_id: userId,
            nome: a.file_name,
            storage_path: newPath,
            tipo_arquivo: a.mime_type,
            tamanho: a.size_bytes,
          });
          anexosCopiados++;
        } catch (_e) {
          // ignora falha individual
        }
      }
    }

    // 7. Registra vínculo
    await sb.from("chat_tarefas_origem").insert({
      tarefa_id: tarefa.id,
      mensagem_id: input.mensagem_id,
      conversa_id: msg.conversa_id,
      criado_por: userId,
      contexto: { sugestao_usada: precisaSugerir },
    });

    // 8. Atualiza metadata da mensagem com link da tarefa
    const novaMetadata = {
      ...(msg.metadata as Record<string, unknown> ?? {}),
      tarefa_id: tarefa.id,
      projeto_id: input.projeto_id,
      tarefa_titulo: tarefa.titulo,
      tarefa_codigo: tarefa.codigo,
    };
    await sb.from("mensagens")
      .update({ metadata: novaMetadata })
      .eq("id", input.mensagem_id);

    return new Response(JSON.stringify({
      tarefa,
      anexos_copiados: anexosCopiados,
      sugestao_aplicada: precisaSugerir,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  },
));

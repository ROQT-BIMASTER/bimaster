// briefing-agent — Agente de criação de briefings (Marketing, Criativo, Produto, Trade)
//
// Princípios:
// - JWT do usuário em todas as leituras (RLS aplica). Service role só para escrever
//   no histórico do chat (sempre validando a posse do briefing).
// - Whitelist explícita de tabelas + ACL por módulo (defesa em profundidade).
// - Tool `atualizar_canvas` é o único modo de o agente alterar o briefing.
// - Modelo padrão gemini-3-flash; raciocínio pesado usa gpt-5.2 (sem `reasoning`).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const Body = z.object({
  briefing_id: z.string().uuid(),
  user_message: z.string().min(1).max(8000),
}).strict();

// ── Whitelist tabela ↔ módulo / colunas seguras ─────────────────────────
type SourceSpec = {
  table: string;
  module: string | null;        // módulo necessário (null = sem restrição extra)
  columns: string[];            // SELECT explícito — nunca *
  searchColumns: string[];      // colunas pesquisáveis com ILIKE
  label: (row: Record<string, unknown>) => string;
};

const ALLOWED_SOURCES: Record<string, SourceSpec> = {
  produtos: {
    table: "our_products",
    module: "fabrica",
    columns: ["id", "name", "sku", "category", "description"],
    searchColumns: ["name", "sku", "category"],
    label: (r) => String(r.name ?? r.sku ?? r.id),
  },
  projetos: {
    table: "projetos",
    module: "projetos",
    columns: ["id", "nome", "status", "marca", "categoria_linha", "tipo"],
    searchColumns: ["nome", "marca", "categoria_linha"],
    label: (r) => String(r.nome ?? r.id),
  },
  influencers: {
    table: "influencers",
    module: "marketing",
    columns: ["id", "username", "display_name", "platform", "followers_count", "engagement_rate"],
    searchColumns: ["username", "display_name", "platform"],
    label: (r) => `@${r.username ?? "?"} (${r.platform ?? "?"})`,
  },
  clientes: {
    table: "clientes",
    module: "comercial",
    columns: ["id", "nome", "categoria"], // sem PII — telefone/email ficam fora
    searchColumns: ["nome"],
    label: (r) => String(r.nome ?? r.id),
  },
};

const SYSTEM_PROMPT = `Você é um assistente sênior de planejamento que ajuda o usuário a construir BRIEFINGS profissionais (marketing, criativo, produto/fábrica, trade marketing).

REGRAS DE COMUNICAÇÃO:
- Sempre em português do Brasil, tom profissional, sem emojis.
- Markdown enxuto. Listas curtas quando ajudar.
- Cite fontes internas (produto, projeto, influencer) por nome quando usar dados internos.

COMO TRABALHAR:
1. Use a tool "internal_lookup" para buscar dados internos do sistema (produtos, projetos, marcas, influencers) — mas só quando relevante. NUNCA invente dados internos.
2. Use a tool "atualizar_canvas" para preencher ou atualizar campos do briefing. Sempre que o usuário descrever algo que se encaixe num campo, atualize o canvas em vez de só responder no chat.
3. Cada chamada a "atualizar_canvas" deve conter apenas os campos realmente alterados.
4. Após atualizar o canvas, dê uma resposta curta confirmando o que foi preenchido e sugerindo o próximo campo.
5. Quando faltar informação, pergunte de forma objetiva (uma ou duas perguntas por vez).
6. Se uma tool retornar "sem_permissao", explique ao usuário que ele não tem acesso àquele módulo e ofereça alternativas.

NUNCA exponha IDs internos longos no texto da resposta — use nomes.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "internal_lookup",
      description: "Pesquisa dados internos do sistema (produtos, projetos, influencers, clientes) com filtro por nome/palavra-chave. Respeita as permissões do usuário.",
      parameters: {
        type: "object",
        properties: {
          fonte: {
            type: "string",
            enum: Object.keys(ALLOWED_SOURCES),
            description: "Qual base consultar.",
          },
          busca: {
            type: "string",
            description: "Texto para filtrar resultados (busca parcial por nome/sku/marca).",
          },
          limite: { type: "integer", default: 10 },
        },
        required: ["fonte"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_canvas",
      description: "Atualiza um ou mais campos do canvas do briefing. Use sempre que o usuário fornecer conteúdo que se encaixe em um campo do template.",
      parameters: {
        type: "object",
        properties: {
          campos: {
            type: "object",
            description: "Objeto { chave_do_campo: valor_em_texto }. As chaves devem ser as do template do briefing.",
            additionalProperties: { type: "string" },
          },
          titulo: {
            type: "string",
            description: "Opcional: novo título do briefing.",
          },
        },
        required: ["campos"],
        additionalProperties: false,
      },
    },
  },
];

type Source = { tipo: string; id: string; label: string };
type CanvasPatch = { campos: Record<string, string>; titulo?: string };

function escolherModelo(message: string): string {
  // Heurística simples: pedidos longos / analíticos vão para gpt-5.2
  if (message.length > 600 || /(estraté|análise|posicionamento|swot|funil)/i.test(message)) {
    return "openai/gpt-5.2";
  }
  return "google/gemini-3-flash-preview";
}

async function getUserModules(admin: any, userId: string): Promise<Set<string>> {
  try {
    const { data } = await admin
      .from("usuario_permissoes_modulos")
      .select("modulos_sistema!inner(codigo)")
      .eq("usuario_id", userId);
    const set = new Set<string>();
    for (const r of (data ?? []) as Array<{ modulos_sistema: { codigo: string } }>) {
      if (r.modulos_sistema?.codigo) set.add(r.modulos_sistema.codigo);
    }
    return set;
  } catch {
    return new Set();
  }
}

async function isAdmin(admin: any, userId: string): Promise<boolean> {
  try {
    const { data } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    return !!data;
  } catch {
    return false;
  }
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "briefing-agent" },
  async (req, ctx) => {
    const corsHeaders = getCorsHeaders(req);

    let parsed;
    try {
      parsed = Body.safeParse(await req.json());
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { briefing_id, user_message } = parsed.data;
    const userId = ctx.userId!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Carrega briefing + template via JWT do usuário (RLS filtra)
    const { data: briefing, error: brErr } = await userClient
      .from("briefings")
      .select("id, user_id, tipo, titulo, payload, template_id, briefing_templates(secoes)")
      .eq("id", briefing_id)
      .maybeSingle();

    if (brErr || !briefing) {
      return new Response(JSON.stringify({ error: "Briefing não encontrado ou sem acesso." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (briefing.user_id !== userId) {
      const adminFlag = await isAdmin(admin, userId);
      if (!adminFlag) {
        return new Response(JSON.stringify({ error: "Sem permissão para editar este briefing." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const secoes = (briefing as any).briefing_templates?.secoes ?? [];
    const chavesValidas = new Set<string>(
      (secoes as Array<{ key: string }>).map((s) => s.key),
    );

    // Histórico curto
    const { data: hist } = await userClient
      .from("briefing_mensagens")
      .select("role, content, tool_calls")
      .eq("briefing_id", briefing_id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Persiste a mensagem do usuário (RLS exige que ele seja o dono)
    await userClient.from("briefing_mensagens").insert({
      briefing_id,
      role: "user",
      content: user_message,
    });

    // Módulos permitidos para o usuário (para gating de internal_lookup)
    const userModules = await getUserModules(admin, userId);
    const userIsAdmin = await isAdmin(admin, userId);

    const templateLines = (secoes as Array<{ key: string; label: string; required?: boolean }>)
      .map((s) => `- ${s.key}: ${s.label}${s.required ? " (obrigatório)" : ""}`)
      .join("\n");

    const canvasAtual = JSON.stringify(briefing.payload ?? {}, null, 2);

    const systemContent = `${SYSTEM_PROMPT}

TIPO DO BRIEFING: ${briefing.tipo}
TÍTULO ATUAL: ${briefing.titulo}

CAMPOS DO TEMPLATE (use exatamente essas chaves em "atualizar_canvas"):
${templateLines}

CONTEÚDO ATUAL DO CANVAS:
${canvasAtual}`;

    const messages: any[] = [
      { role: "system", content: systemContent },
      ...((hist ?? []).map((m: any) => ({
        role: m.role === "tool" ? "assistant" : m.role,
        content: m.content,
      }))),
      { role: "user", content: user_message },
    ];

    const sources: Source[] = [];
    const patches: CanvasPatch[] = [];
    let model = escolherModelo(user_message);
    let finalAssistant = "";

    for (let i = 0; i < 5; i++) {
      const result = await callAIGateway({
        messages,
        model,
        tools: TOOLS,
        tool_choice: "auto",
        timeoutMs: 55_000,
      });
      if (result.kind !== "ok") return aiGatewayErrorResponse(result, corsHeaders);
      model = result.modelUsed;
      const msg = result.data.choices?.[0]?.message;
      if (!msg) break;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({
          role: "assistant",
          content: msg.content ?? "",
          tool_calls: msg.tool_calls,
        });
        for (const tc of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}

          let toolRes: any = { ok: false };

          if (tc.function.name === "internal_lookup") {
            const spec = ALLOWED_SOURCES[args.fonte];
            if (!spec) {
              toolRes = { error: "fonte_invalida" };
            } else if (spec.module && !userIsAdmin && !userModules.has(spec.module)) {
              toolRes = { error: "sem_permissao", modulo: spec.module };
            } else {
              const limite = Math.min(Number(args.limite ?? 10), 25);
              let q = userClient.from(spec.table).select(spec.columns.join(",")).limit(limite);
              const busca = String(args.busca ?? "").trim();
              if (busca && spec.searchColumns.length > 0) {
                const ors = spec.searchColumns.map((c) => `${c}.ilike.%${busca}%`).join(",");
                q = q.or(ors);
              }
              const { data, error } = await q;
              if (error) {
                toolRes = { error: error.message };
              } else {
                const rows = (data ?? []) as Array<Record<string, unknown>>;
                for (const r of rows) {
                  sources.push({
                    tipo: args.fonte,
                    id: String(r.id),
                    label: spec.label(r),
                  });
                }
                toolRes = { resultados: rows, total: rows.length };
              }
            }
          } else if (tc.function.name === "atualizar_canvas") {
            const novosCampos: Record<string, string> = {};
            const camposInput = args.campos ?? {};
            for (const [k, v] of Object.entries(camposInput)) {
              if (chavesValidas.has(k) && typeof v === "string" && v.trim().length > 0) {
                novosCampos[k] = String(v).slice(0, 8000);
              }
            }
            const patch: CanvasPatch = { campos: novosCampos };
            if (args.titulo && typeof args.titulo === "string") {
              patch.titulo = String(args.titulo).slice(0, 200);
            }
            // Aplica no banco (RLS garante que só o dono pode)
            const novoPayload = { ...(briefing.payload as Record<string, unknown> ?? {}), ...novosCampos };
            const totalCampos = (secoes as Array<any>).length || 1;
            const preenchidos = Object.values(novoPayload).filter((v) => typeof v === "string" && v.trim().length > 0).length;
            const completude = Math.min(100, Math.round((preenchidos / totalCampos) * 100));

            const upd: Record<string, unknown> = {
              payload: novoPayload,
              completude,
              status: "em_andamento",
            };
            if (patch.titulo) upd.titulo = patch.titulo;

            const { error: updErr } = await userClient
              .from("briefings")
              .update(upd)
              .eq("id", briefing_id);
            if (updErr) {
              toolRes = { error: updErr.message };
            } else {
              (briefing as any).payload = novoPayload;
              if (patch.titulo) (briefing as any).titulo = patch.titulo;
              patches.push(patch);
              toolRes = { ok: true, campos_atualizados: Object.keys(novosCampos), completude };
            }
          } else {
            toolRes = { error: "tool_desconhecida" };
          }

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(toolRes).slice(0, 30_000),
          });
        }
        continue;
      }

      finalAssistant = msg.content ?? "";
      break;
    }

    if (!finalAssistant) {
      finalAssistant = "Não consegui finalizar a resposta. Tente reformular sua solicitação.";
    }

    const uniqueSources = Array.from(
      new Map(sources.map((s) => [`${s.tipo}:${s.id}`, s])).values()
    ).slice(0, 20);

    await userClient.from("briefing_mensagens").insert({
      briefing_id,
      role: "assistant",
      content: finalAssistant,
      sources: uniqueSources,
      proposals: patches,
      model,
    });

    return new Response(JSON.stringify({
      reply: finalAssistant,
      sources: uniqueSources,
      patches,
      model,
      briefing: {
        id: briefing.id,
        titulo: (briefing as any).titulo,
        payload: (briefing as any).payload,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  },
));

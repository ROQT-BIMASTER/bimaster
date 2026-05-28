// briefing-agent — Agente de criação de briefings (Marketing, Criativo, Produto, Trade)
//
// Princípios:
// - JWT do usuário em todas as leituras (RLS aplica). Service role só para escrever
//   no histórico do chat (sempre validando a posse do briefing).
// - Whitelist explícita de tabelas + ACL por módulo (defesa em profundidade).
// - `atualizar_canvas` só para FATOS confirmados pelo usuário / internal_lookup.
// - `propor_sugestao` para qualquer inferência criativa/estratégica — usuário decide.
// - Suporte multimodal: imagens anexadas pelo usuário vão como image_url ao modelo.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const Attachment = z.object({
  path: z.string().min(1).max(500),
  mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  name: z.string().min(1).max(200),
}).strict();

const Body = z.object({
  briefing_id: z.string().uuid(),
  user_message: z.string().min(1).max(8000),
  attachments: z.array(Attachment).max(4).optional(),
}).strict();

// ── Whitelist tabela ↔ módulo / colunas seguras ─────────────────────────
type SourceSpec = {
  table: string;
  module: string | null;
  columns: string[];
  searchColumns: string[];
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
    columns: ["id", "nome", "categoria"],
    searchColumns: ["nome"],
    label: (r) => String(r.nome ?? r.id),
  },
};

const SYSTEM_PROMPT = `Você é um Planner sênior de briefings (marketing, criativo, produto/PLM, trade). Atua com rigor de agência e disciplina operacional.

# Como você trabalha
- O template do briefing vem do banco. É a fonte da verdade: trabalhe SOMENTE os campos listados, na ORDEM em que aparecem, usando o "guia" de cada campo como base da sua pergunta ao usuário.
- A cada turno, foque em UM ÚNICO campo: o "PRÓXIMO CAMPO A TRABALHAR" indicado no contexto. Só avance quando o atual estiver preenchido (via tool) ou explicitamente pulado pelo usuário.
- Termine os campos OBRIGATÓRIOS antes de tocar em opcionais.
- Quando todos os obrigatórios estiverem preenchidos, o briefing está PRONTO. Não insista em campos opcionais — apenas informe ao usuário que ele já pode clicar em "Enviar para aprovação" no topo da tela. NÃO altere status do briefing por conta própria.
- Se o usuário pedir para "finalizar", "concluir", "fechar" ou "enviar para aprovação":
  * Com obrigatórios pendentes → liste o que falta e pergunte o próximo.
  * Com obrigatórios completos → confirme que está pronto e oriente o clique no botão "Enviar para aprovação". Mencione brevemente quais opcionais ficaram em branco (se houver), sem insistir.

# Comunicação
- Português do Brasil. Tom executivo, direto, sem floreio, sem emojis.
- Markdown enxuto. Negrito só no essencial.
- Cite fontes internas pelo nome (produto, projeto, cliente), nunca por ID.
- Estrutura da resposta — OMITA seções vazias:
  ## O que atualizei no canvas   (só se houve atualizar_canvas neste turno)
  ## Sugestões para sua aprovação (só se houve propor_sugestao neste turno)
  ## Próxima pergunta              (uma pergunta objetiva sobre o PRÓXIMO CAMPO)
- "Próxima pergunta" tem 1 a 3 linhas. Sem reabrir tópicos fechados, sem repetir o que o usuário acabou de dizer.

# Anti-alucinação (não-negociável)
- NUNCA invente marca, SKU, dados de fábrica, regulatórios, números, claims ou benchmarks. Se faltar, use \`internal_lookup\` ou pergunte.
- Análise de imagem: descreva APENAS o visivelmente presente. Interpretação vira \`propor_sugestao\`, nunca \`atualizar_canvas\`.
- Fato confirmado pelo usuário ou vindo de \`internal_lookup\` → canvas. Hipótese → sugestão.

# Tools — quando usar
- \`internal_lookup\`: SEMPRE que o usuário citar um nome próprio (produto, projeto, cliente, influencer) antes de assumir que existe.
- \`atualizar_canvas\`: APENAS para fatos confirmados neste turno. Uma chamada com os campos realmente alterados.
- \`propor_sugestao\`: para toda recomendação criativa/estratégica/inferida. Uma sugestão por campo por turno.

# Regras estritas
- Para MODIFICAR um campo você DEVE chamar \`atualizar_canvas\`. Texto em prosa não modifica nada.
- NUNCA confirme que preencheu um campo sem ter chamado a tool no mesmo turno.
- Emita as tools PRIMEIRO, escreva a resposta DEPOIS.
- NUNCA exponha IDs internos longos no texto.
- Use somente as CHAVES de campo listadas no template. Não invente campos.
`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "internal_lookup",
      description: "Pesquisa dados internos do sistema (produtos, projetos, influencers, clientes) com filtro por nome/palavra-chave. Respeita as permissões do usuário.",
      parameters: {
        type: "object",
        properties: {
          fonte: { type: "string", enum: Object.keys(ALLOWED_SOURCES) },
          busca: { type: "string", description: "Texto para filtrar (busca parcial)." },
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
      description: "Aplica FATOS confirmados pelo usuário ou trazidos por internal_lookup em campos do canvas. Não use para inferências suas — use propor_sugestao.",
      parameters: {
        type: "object",
        properties: {
          campos: {
            type: "object",
            description: "Objeto { chave_do_campo: valor_em_texto }. Chaves devem existir no template.",
            additionalProperties: { type: "string" },
          },
          titulo: { type: "string", description: "Opcional: novo título do briefing." },
        },
        required: ["campos"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_sugestao",
      description: "Cria uma sugestão para um campo do canvas que requer aprovação do usuário. Use para qualquer conteúdo criativo, estratégico ou inferido (incluindo leitura de imagens). O usuário decide aplicar ou manter o atual.",
      parameters: {
        type: "object",
        properties: {
          campo: { type: "string", description: "Chave do campo do template." },
          sugestao: { type: "string", description: "Texto proposto para o campo (final, pronto para entrar no canvas)." },
          justificativa: { type: "string", description: "Por que essa sugestão faz sentido (1-3 frases, baseadas em padrão de mercado, framework ou dado mencionado)." },
        },
        required: ["campo", "sugestao", "justificativa"],
        additionalProperties: false,
      },
    },
  },
];

type Source = { tipo: string; id: string; label: string };
type CanvasPatch = { campos: Record<string, string>; titulo?: string };
type Sugestao = { id: string; campo: string; sugestao: string; justificativa: string; valor_atual: string | null };

function escolherModelo(message: string, hasImages: boolean): string {
  if (hasImages) return "google/gemini-2.5-flash";
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
    const { briefing_id, user_message, attachments = [] } = parsed.data;
    const userId = ctx.userId!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Valida que todos os anexos pertencem ao briefing
    for (const a of attachments) {
      if (!a.path.startsWith(`${briefing_id}/`)) {
        return new Response(JSON.stringify({ error: "anexo_fora_do_briefing" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: briefing, error: brErr } = await userClient
      .from("briefings")
      .select("id, user_id, tipo, titulo, payload, campo_origens, template_id, briefing_templates(secoes)")
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

    // Signed URLs para anexos (5 min)
    const signedAttachments: Array<{ url: string; mime: string; name: string; path: string }> = [];
    for (const a of attachments) {
      const { data: signed } = await admin.storage
        .from("briefing-chat-anexos")
        .createSignedUrl(a.path, 300);
      if (signed?.signedUrl) {
        signedAttachments.push({ url: signed.signedUrl, mime: a.mime, name: a.name, path: a.path });
      }
    }

    const { data: hist } = await userClient
      .from("briefing_mensagens")
      .select("role, content, tool_calls")
      .eq("briefing_id", briefing_id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Persiste mensagem do usuário com attachments
    await userClient.from("briefing_mensagens").insert({
      briefing_id,
      role: "user",
      content: user_message,
      attachments: attachments.map((a) => ({ path: a.path, mime: a.mime, name: a.name })),
    });

    const userModules = await getUserModules(admin, userId);
    const userIsAdmin = await isAdmin(admin, userId);

    type Secao = { key: string; label: string; required?: boolean; placeholder?: string };
    const secoesList = (secoes as Secao[]) ?? [];
    const payloadAtual = (briefing.payload as Record<string, unknown>) ?? {};
    const isFilled = (k: string) => {
      const v = payloadAtual[k];
      return typeof v === "string" && v.trim().length > 0;
    };

    const templateLines = secoesList
      .map((s, i) => {
        const tag = s.required ? "[obrigatório]" : "[opcional]";
        const status = isFilled(s.key) ? "preenchido" : "vazio";
        const guia = s.placeholder ? `\n   guia: ${s.placeholder}` : "";
        return `${i + 1}. ${tag} ${s.key} — ${s.label}${guia}\n   status: ${status}`;
      })
      .join("\n");

    const proxObrig = secoesList.find((s) => s.required && !isFilled(s.key));
    const proximo = proxObrig;
    const proximoLinha = proximo
      ? `PRÓXIMO CAMPO A TRABALHAR: ${proximo.key} (${proximo.label})${proximo.placeholder ? ` — guia: ${proximo.placeholder}` : ""} [obrigatório]`
      : `BRIEFING PRONTO — todos os campos obrigatórios estão preenchidos. NÃO faça novas perguntas sobre opcionais a menos que o usuário peça explicitamente. Confirme que o briefing está pronto e oriente o usuário a clicar no botão "Enviar para aprovação" no topo da tela. NÃO altere status nem chame tools de atualização sem pedido.`;

    const canvasAtual = JSON.stringify(payloadAtual, null, 2);

    const systemContent = `${SYSTEM_PROMPT}

TIPO DO BRIEFING: ${briefing.tipo}
TÍTULO ATUAL: ${briefing.titulo}

CAMPOS DO TEMPLATE (use exatamente essas chaves, nesta ordem):
${templateLines}

CONTEÚDO ATUAL DO CANVAS:
${canvasAtual}

${proximoLinha}`;

    // Conteúdo do usuário: texto + imagens (se houver)
    const userContent: any = signedAttachments.length > 0
      ? [
          { type: "text", text: user_message },
          ...signedAttachments.map((a) => ({
            type: "image_url",
            image_url: { url: a.url },
          })),
        ]
      : user_message;

    const messages: any[] = [
      { role: "system", content: systemContent },
      ...((hist ?? []).map((m: any) => ({
        role: m.role === "tool" ? "assistant" : m.role,
        content: m.content,
      }))),
      { role: "user", content: userContent },
    ];

    const sources: Source[] = [];
    const patches: CanvasPatch[] = [];
    const sugestoes: Sugestao[] = [];
    let model = escolherModelo(user_message, signedAttachments.length > 0);
    let finalAssistant = "";

    for (let i = 0; i < 5; i++) {
      const result = await callAIGateway({
        messages,
        model,
        tools: TOOLS,
        tool_choice: "auto",
        timeoutMs: 60_000,
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
              // Sanitiza caracteres com significado em filtros PostgREST (`,`, `.`, `(`, `)`, `%`)
              // para evitar injeção de cláusulas OR adicionais via args da tool call.
              const safeBusca = String(args.busca ?? "").replace(/[(),.%]/g, "").trim().slice(0, 100);
              if (safeBusca && spec.searchColumns.length > 0) {
                const ors = spec.searchColumns.map((c) => `${c}.ilike.%${safeBusca}%`).join(",");
                q = q.or(ors);
              }
              const { data, error } = await q;
              if (error) {
                toolRes = { error: error.message };
              } else {
                const rows = (data ?? []) as Array<Record<string, unknown>>;
                for (const r of rows) {
                  sources.push({ tipo: args.fonte, id: String(r.id), label: spec.label(r) });
                }
                toolRes = { resultados: rows, total: rows.length };
              }
            }
          } else if (tc.function.name === "atualizar_canvas") {
            const novosCampos: Record<string, string> = {};
            const camposInput = args.campos ?? {};
            const origensAtuais = ((briefing as any).campo_origens as Record<string, string> | null) ?? {};
            const ignorados: string[] = [];
            for (const [k, v] of Object.entries(camposInput)) {
              if (!chavesValidas.has(k) || typeof v !== "string" || v.trim().length === 0) continue;
              // Protege campos marcados como preenchimento manual: a IA não sobrescreve.
              if (origensAtuais[k] === "manual") {
                ignorados.push(k);
                continue;
              }
              novosCampos[k] = String(v).slice(0, 8000);
            }
            const patch: CanvasPatch = { campos: novosCampos };
            if (args.titulo && typeof args.titulo === "string") {
              patch.titulo = String(args.titulo).slice(0, 200);
            }
            const novoPayload = { ...(briefing.payload as Record<string, unknown> ?? {}), ...novosCampos };
            // Marca como "ia" todo campo que a IA acabou de escrever.
            const novasOrigens = { ...origensAtuais };
            for (const k of Object.keys(novosCampos)) novasOrigens[k] = "ia";

            const obrigatorios = (secoes as Array<{ key: string; required?: boolean }>).filter((s) => s.required);
            const totalObrig = obrigatorios.length || 1;
            const preenchidosObrig = obrigatorios.filter((s) => {
              const v = novoPayload[s.key];
              return typeof v === "string" && v.trim().length > 0;
            }).length;
            const completude = Math.min(100, Math.round((preenchidosObrig / totalObrig) * 100));

            const upd: Record<string, unknown> = {
              payload: novoPayload,
              campo_origens: novasOrigens,
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
              (briefing as any).campo_origens = novasOrigens;
              if (patch.titulo) (briefing as any).titulo = patch.titulo;
              patches.push(patch);
              toolRes = {
                ok: true,
                campos_atualizados: Object.keys(novosCampos),
                campos_ignorados_manual: ignorados,
                completude,
              };
            }
          } else if (tc.function.name === "propor_sugestao") {
            const campo = String(args.campo ?? "").trim();
            const sugestao = String(args.sugestao ?? "").trim();
            const justificativa = String(args.justificativa ?? "").trim().slice(0, 2000);
            if (!chavesValidas.has(campo)) {
              toolRes = { error: "campo_invalido", campo };
            } else if (!sugestao) {
              toolRes = { error: "sugestao_vazia" };
            } else {
              const valorAtual = ((briefing as any).payload?.[campo] as string | undefined) ?? null;
              const { data: inserted, error: sErr } = await userClient
                .from("briefing_sugestoes")
                .insert({
                  briefing_id,
                  campo,
                  sugestao: sugestao.slice(0, 8000),
                  justificativa,
                  valor_atual: valorAtual,
                  created_by: userId,
                })
                .select("id")
                .maybeSingle();
              if (sErr || !inserted) {
                toolRes = { error: sErr?.message ?? "erro_persistir_sugestao" };
              } else {
                sugestoes.push({
                  id: inserted.id,
                  campo,
                  sugestao,
                  justificativa,
                  valor_atual: valorAtual,
                });
                toolRes = { ok: true, sugestao_id: inserted.id, campo };
              }
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

    // Persiste mensagem do assistant; injeta IDs das sugestões em proposals
    // para o frontend recuperar e renderizar o card de aprovação.
    const proposalsPayload = [
      ...patches,
      ...(sugestoes.length > 0 ? [{ sugestoes }] : []),
    ];

    await userClient.from("briefing_mensagens").insert({
      briefing_id,
      role: "assistant",
      content: finalAssistant,
      sources: uniqueSources,
      proposals: proposalsPayload,
      model,
    });

    return new Response(JSON.stringify({
      reply: finalAssistant,
      sources: uniqueSources,
      patches,
      sugestoes,
      model,
      briefing: {
        id: briefing.id,
        titulo: (briefing as any).titulo,
        payload: (briefing as any).payload,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  },
));

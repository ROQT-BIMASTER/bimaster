// central-copilot — Copiloto da Central de Trabalho (escopo pessoal multi-projeto)
// Espelha a arquitetura do projeto-copilot, mas opera sobre TODAS as tarefas do
// usuário (minhas, delegadas, inbox, agenda) atravessando projetos.
// - Toda leitura usa o JWT do usuário (RLS aplica).
// - Mutações nunca são executadas aqui — apenas registradas como propostas em
//   central_copilot_acoes; aplicação exige senha em central-copilot-aplicar.
// - Relatórios são gerados via central-copilot-relatorio (cross-projeto).
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const Body = z.object({
  thread_id: z.string().uuid().optional(),
  user_message: z.string().min(1).max(8000),
}).strict();

const SYSTEM_PROMPT = `Você é o Copiloto da Central de Trabalho — um assistente pessoal de produtividade para o usuário atual dentro do sistema.

ESCOPO:
- Você responde sobre as TAREFAS DO USUÁRIO (atribuídas a ele, delegadas por ele, ou que ele acompanha), agenda, inbox de notificações, projetos em que ele participa.
- NÃO discuta dados de outros usuários nem assuntos fora desse escopo. Recuse cordialmente o que estiver fora.

REGRAS DE RESPOSTA:
- Sempre em português do Brasil, em markdown enxuto. Use listas e tabelas quando ajudar.
- Para qualquer pergunta sobre dados, use as ferramentas — não invente números.
- Cite as fontes que consultou (tarefa, projeto, item da inbox) por título/identificador.

AÇÕES (mudar prazo, status, prioridade, concluir, reatribuir, criar tarefa em um projeto):
- Use as tools "propor_*" para PROPOR a ação. Nunca afirme que executou.
- Após propor, diga: "Preparei a ação. Confirme com sua senha no card abaixo para aplicar."
- Uma ação por vez quando o usuário pedir uma única mudança.

RELATÓRIOS:
- Use "gerar_relatorio_pessoal" para gerar PDFs/XLSX dinâmicos sobre o trabalho do USUÁRIO (não de um projeto isolado).
- Cada relatório deve ser DINÂMICO — adapte estrutura ao pedido. Sempre inclua KPIs quando houver dados quantitativos.
- Sempre passe o pedido literal do usuário em 'prompt' com o recorte solicitado.

Se uma ferramenta retornar vazio ou erro, diga isso claramente.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "metricas_pessoais",
      description: "Retorna minhas métricas: total de tarefas minhas, atrasadas, hoje, esta semana, concluídas no mês, delegadas em aberto, inbox pendente.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_minhas_tarefas",
      description: "Lista tarefas em que sou responsável OU colaborador, com filtros opcionais.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "ex.: 'pendente', 'em_andamento', 'concluida'" },
          atrasadas: { type: "boolean", description: "se true, apenas vencidas e não concluídas" },
          hoje: { type: "boolean", description: "se true, apenas com prazo hoje" },
          esta_semana: { type: "boolean", description: "se true, apenas com prazo nos próximos 7 dias" },
          projeto_id: { type: "string" },
          prioridade: { type: "string", enum: ["baixa","media","alta"] },
          limite: { type: "integer", default: 30 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_delegadas",
      description: "Lista tarefas que EU criei/delego para outras pessoas, com responsável e estado.",
      parameters: {
        type: "object",
        properties: {
          estagnadas_dias: { type: "integer", description: "Se >0, retorna apenas as sem atualização há N dias.", default: 0 },
          limite: { type: "integer", default: 30 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_inbox",
      description: "Lista itens não-resolvidos da minha caixa de entrada (notificações, ações pendentes).",
      parameters: {
        type: "object",
        properties: {
          caixa: { type: "string", enum: ["acao_minha","atribuida_a_mim","acompanho","delegada_por_mim"] },
          somente_nao_lidas: { type: "boolean", default: false },
          limite: { type: "integer", default: 30 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agenda_periodo",
      description: "Retorna minhas tarefas com prazo entre as datas dadas (YYYY-MM-DD).",
      parameters: {
        type: "object",
        properties: {
          de: { type: "string" },
          ate: { type: "string" },
        },
        required: ["de","ate"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detalhar_tarefa",
      description: "Detalhes de uma tarefa específica que eu tenho acesso.",
      parameters: {
        type: "object",
        properties: { tarefa_id: { type: "string" } },
        required: ["tarefa_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_projetos_meus",
      description: "Lista projetos em que sou participante (responsável de pelo menos uma tarefa, criador, ou colaborador).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },

  // ====== AÇÕES (geram propostas; aplicação requer senha) ======
  {
    type: "function",
    function: {
      name: "propor_ajustar_prazo",
      description: "Propõe alterar o prazo de uma tarefa minha.",
      parameters: {
        type: "object",
        properties: {
          tarefa_id: { type: "string" },
          data_prazo: { type: "string", description: "YYYY-MM-DD" },
          justificativa: { type: "string" },
        },
        required: ["tarefa_id","data_prazo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_mudar_status",
      description: "Propõe alterar o status de uma tarefa (use para concluir).",
      parameters: {
        type: "object",
        properties: {
          tarefa_id: { type: "string" },
          status: { type: "string", enum: ["pendente","em_andamento","concluida","bloqueada","cancelada"] },
          justificativa: { type: "string" },
        },
        required: ["tarefa_id","status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_mudar_prioridade",
      description: "Propõe alterar a prioridade de uma tarefa.",
      parameters: {
        type: "object",
        properties: {
          tarefa_id: { type: "string" },
          prioridade: { type: "string", enum: ["baixa","media","alta"] },
          justificativa: { type: "string" },
        },
        required: ["tarefa_id","prioridade"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_reatribuir",
      description: "Propõe trocar o responsável de uma tarefa que EU delego.",
      parameters: {
        type: "object",
        properties: {
          tarefa_id: { type: "string" },
          responsavel_id: { type: "string" },
          justificativa: { type: "string" },
        },
        required: ["tarefa_id","responsavel_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_criar_tarefa",
      description: "Propõe criar uma tarefa em um projeto que eu acesso.",
      parameters: {
        type: "object",
        properties: {
          projeto_id: { type: "string" },
          titulo: { type: "string" },
          secao_id: { type: "string", description: "opcional; usa primeira seção do projeto se omitido" },
          responsavel_id: { type: "string" },
          data_prazo: { type: "string", description: "YYYY-MM-DD" },
          prioridade: { type: "string", enum: ["baixa","media","alta"] },
          justificativa: { type: "string" },
        },
        required: ["projeto_id","titulo"],
        additionalProperties: false,
      },
    },
  },

  // ====== RELATÓRIO ======
  {
    type: "function",
    function: {
      name: "gerar_relatorio_pessoal",
      description: "Gera um relatório dinâmico SOBRE O TRABALHO DO USUÁRIO em PDF ou XLSX. A IA monta a estrutura (KPIs, tabelas, gráficos, listas) com base no pedido — não use sempre o mesmo template.",
      parameters: {
        type: "object",
        properties: {
          formato: { type: "string", enum: ["pdf","xlsx"] },
          prompt: { type: "string", description: "Pedido literal do usuário com recorte/foco. Ex.: 'PDF do meu dia: tarefas de hoje agrupadas por projeto, com agenda da semana'." },
          escopo_dias: { type: "integer", description: "Janela em dias para o relatório (1=hoje, 7=semana, 30=mês). Default: 7.", default: 7 },
        },
        required: ["formato","prompt"],
        additionalProperties: false,
      },
    },
  },
];

type Source = { tipo: string; id: string; label: string };

type Proposal = {
  id: string;
  tipo: string;
  payload: any;
  resumo: string;
  diff?: { campo: string; de: any; para: any }[];
};
type ReportOut = {
  relatorio_id: string;
  signed_url: string;
  nome_arquivo: string;
  formato: "pdf" | "xlsx";
  tipo: string;
};

interface ToolCtx {
  userClient: ReturnType<typeof createClient>;
  admin: ReturnType<typeof createClient>;
  threadId: string;
  userId: string;
  authHeader: string;
  sources: Source[];
  proposals: Proposal[];
  reports: ReportOut[];
}

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function plusDays(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function execTool(name: string, args: any, c: ToolCtx): Promise<any> {
  const { userClient, admin, threadId, userId, sources, proposals, reports } = c;
  try {
    switch (name) {
      case "metricas_pessoais": {
        const today = todayStr();
        const semana = plusDays(7);
        // Tarefas onde sou responsável
        const { data: respData } = await userClient.from("projeto_tarefas")
          .select("id,status,data_prazo,prioridade")
          .eq("responsavel_id", userId)
          .is("excluida_em", null);
        // Tarefas que eu deleguei (criador é eu, responsável é outro)
        const { data: delData } = await userClient.from("projeto_tarefas")
          .select("id,status,data_prazo,responsavel_id")
          .eq("criador_id", userId)
          .neq("responsavel_id", userId)
          .is("excluida_em", null);
        const list = (respData ?? []) as any[];
        const t = list.length;
        const concluidas = list.filter(r => r.status === "concluida").length;
        const atrasadas = list.filter(r => r.status !== "concluida" && r.data_prazo && r.data_prazo < today).length;
        const hoje = list.filter(r => r.status !== "concluida" && r.data_prazo === today).length;
        const semana_count = list.filter(r => r.status !== "concluida" && r.data_prazo && r.data_prazo >= today && r.data_prazo <= semana).length;
        const alta = list.filter(r => r.status !== "concluida" && (r.prioridade ?? "").toLowerCase() === "alta").length;
        const delegadas_abertas = (delData ?? []).filter((r: any) => r.status !== "concluida").length;
        // Inbox pendente
        const { count: inboxCount } = await userClient.from("inbox_items")
          .select("id", { count: "exact", head: true })
          .is("resolvido_em", null).is("arquivado_em", null);
        return {
          total_minhas: t, concluidas, atrasadas, hoje, prox_7_dias: semana_count,
          alta_prioridade: alta, delegadas_em_aberto: delegadas_abertas,
          inbox_pendente: inboxCount ?? 0,
          percentual_conclusao: t ? Math.round((concluidas / t) * 100) : 0,
        };
      }
      case "listar_minhas_tarefas": {
        const lim = Math.min(args.limite ?? 30, 100);
        let q = userClient.from("projeto_tarefas")
          .select("id,titulo,status,prioridade,data_prazo,projeto_id,responsavel_id,criador_id")
          .or(`responsavel_id.eq.${userId},criador_id.eq.${userId}`)
          .is("excluida_em", null)
          .order("data_prazo", { ascending: true, nullsFirst: false })
          .limit(lim);
        if (args.status) q = q.eq("status", args.status);
        if (args.projeto_id) q = q.eq("projeto_id", args.projeto_id);
        if (args.prioridade) q = q.eq("prioridade", args.prioridade);
        if (args.atrasadas) q = q.neq("status", "concluida").lt("data_prazo", todayStr());
        if (args.hoje) q = q.eq("data_prazo", todayStr());
        if (args.esta_semana) q = q.gte("data_prazo", todayStr()).lte("data_prazo", plusDays(7));
        const { data, error } = await q;
        if (error) return { error: error.message };
        for (const t of data ?? []) sources.push({ tipo: "tarefa", id: t.id, label: t.titulo });
        return { tarefas: data };
      }
      case "listar_delegadas": {
        const lim = Math.min(args.limite ?? 30, 100);
        let q = userClient.from("projeto_tarefas")
          .select("id,titulo,status,prioridade,data_prazo,responsavel_id,projeto_id,updated_at")
          .eq("criador_id", userId)
          .neq("responsavel_id", userId)
          .is("excluida_em", null)
          .order("updated_at", { ascending: true })
          .limit(lim);
        const { data, error } = await q;
        if (error) return { error: error.message };
        let rows = data ?? [];
        if ((args.estagnadas_dias ?? 0) > 0) {
          const corte = new Date(); corte.setDate(corte.getDate() - args.estagnadas_dias);
          rows = rows.filter((r: any) => new Date(r.updated_at) < corte && r.status !== "concluida");
        }
        for (const t of rows) sources.push({ tipo: "tarefa", id: t.id, label: t.titulo });
        return { delegadas: rows };
      }
      case "listar_inbox": {
        const lim = Math.min(args.limite ?? 30, 100);
        let q = userClient.from("inbox_items")
          .select("id,caixa,origem,tipo,titulo,resumo,projeto_id,referencia_id,referencia_tipo,lido_em,created_at,action_url")
          .is("resolvido_em", null).is("arquivado_em", null)
          .order("created_at", { ascending: false })
          .limit(lim);
        if (args.caixa) q = q.eq("caixa", args.caixa);
        if (args.somente_nao_lidas) q = q.is("lido_em", null);
        const { data, error } = await q;
        if (error) return { error: error.message };
        for (const i of data ?? []) sources.push({ tipo: "inbox", id: i.id, label: i.titulo });
        return { itens: data };
      }
      case "agenda_periodo": {
        const de = String(args.de ?? "");
        const ate = String(args.ate ?? "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
          return { error: "datas inválidas (use YYYY-MM-DD)" };
        }
        const { data, error } = await userClient.from("projeto_tarefas")
          .select("id,titulo,status,prioridade,data_prazo,projeto_id,responsavel_id")
          .or(`responsavel_id.eq.${userId},criador_id.eq.${userId}`)
          .is("excluida_em", null)
          .gte("data_prazo", de).lte("data_prazo", ate)
          .order("data_prazo", { ascending: true })
          .limit(200);
        if (error) return { error: error.message };
        for (const t of data ?? []) sources.push({ tipo: "tarefa", id: t.id, label: t.titulo });
        return { agenda: data };
      }
      case "detalhar_tarefa": {
        const { data, error } = await userClient.from("projeto_tarefas")
          .select("id,titulo,descricao,status,prioridade,data_prazo,projeto_id,responsavel_id,criador_id,secao_id")
          .eq("id", args.tarefa_id).maybeSingle();
        if (error) return { error: error.message };
        if (!data) return { error: "Tarefa não encontrada ou sem acesso." };
        sources.push({ tipo: "tarefa", id: data.id, label: data.titulo });
        return { tarefa: data };
      }
      case "listar_projetos_meus": {
        // Projetos em que o usuário tem ao menos uma tarefa visível (RLS aplica).
        const { data, error } = await userClient.from("projeto_tarefas")
          .select("projeto_id, projetos:projeto_id(id, nome, status)")
          .or(`responsavel_id.eq.${userId},criador_id.eq.${userId}`)
          .is("excluida_em", null)
          .limit(500);
        if (error) return { error: error.message };
        const map = new Map<string, any>();
        for (const r of (data ?? []) as any[]) {
          const p = r.projetos;
          if (p && !map.has(p.id)) map.set(p.id, p);
        }
        return { projetos: Array.from(map.values()) };
      }

      // ====== Propostas de ação ======
      case "propor_ajustar_prazo":
      case "propor_mudar_status":
      case "propor_mudar_prioridade":
      case "propor_reatribuir":
      case "propor_criar_tarefa": {
        const tipoMap: Record<string, string> = {
          propor_ajustar_prazo: "ajustar_prazo",
          propor_mudar_status: "mudar_status",
          propor_mudar_prioridade: "mudar_prioridade",
          propor_reatribuir: "reatribuir",
          propor_criar_tarefa: "criar_tarefa",
        };
        const tipo = tipoMap[name];
        let projetoIdAcao: string | null = null;
        let antes: any = null;
        let resumo = "";
        const diff: { campo: string; de: any; para: any }[] = [];

        if (name === "propor_criar_tarefa") {
          projetoIdAcao = String(args.projeto_id ?? "");
          if (!projetoIdAcao) return { error: "projeto_id obrigatório." };
          // valida acesso
          const { data: pj } = await userClient.from("projetos")
            .select("id, nome").eq("id", projetoIdAcao).maybeSingle();
          if (!pj) return { error: "Projeto inacessível." };
          resumo = `Criar tarefa "${args.titulo}" em ${pj.nome}${args.data_prazo ? ` com prazo ${args.data_prazo}` : ""}.`;
        } else {
          const { data } = await userClient.from("projeto_tarefas")
            .select("id,titulo,status,prioridade,data_prazo,responsavel_id,projeto_id,criador_id")
            .eq("id", args.tarefa_id).maybeSingle();
          if (!data) return { error: "Tarefa não encontrada ou sem acesso." };
          antes = data;
          projetoIdAcao = data.projeto_id;

          // Para reatribuir, exigir que sou criador (delego)
          if (tipo === "reatribuir" && data.criador_id !== userId) {
            return { error: "Só posso propor reatribuir tarefas que EU criei/delego." };
          }

          if (tipo === "ajustar_prazo") {
            resumo = `Ajustar prazo de "${antes.titulo}" para ${args.data_prazo}.`;
            diff.push({ campo: "Prazo", de: antes.data_prazo ?? "—", para: args.data_prazo });
          } else if (tipo === "mudar_status") {
            resumo = `Mudar status de "${antes.titulo}" para ${args.status}.`;
            diff.push({ campo: "Status", de: antes.status, para: args.status });
          } else if (tipo === "mudar_prioridade") {
            resumo = `Mudar prioridade de "${antes.titulo}" para ${args.prioridade}.`;
            diff.push({ campo: "Prioridade", de: antes.prioridade, para: args.prioridade });
          } else if (tipo === "reatribuir") {
            resumo = `Reatribuir "${antes.titulo}".`;
            diff.push({ campo: "Responsável", de: antes.responsavel_id ?? "—", para: args.responsavel_id });
          }
        }

        const payload: any = { ...args };
        delete payload.justificativa;
        const { data: created, error: insErr } = await admin.from("central_copilot_acoes").insert({
          thread_id: threadId,
          tipo,
          payload,
          status: "proposta",
          projeto_id: projetoIdAcao,
        }).select("id").single();
        if (insErr) return { error: insErr.message };
        proposals.push({ id: created.id, tipo, payload, resumo, diff });
        return { ok: true, acao_id: created.id, resumo, requer_confirmacao_senha: true };
      }

      // ====== Relatório ======
      case "gerar_relatorio_pessoal": {
        const formato = args.formato as "pdf" | "xlsx";
        const promptRel = String(args.prompt ?? "").trim();
        const escopo_dias = Math.max(1, Math.min(args.escopo_dias ?? 7, 90));
        const r = await fetch(`${SUPABASE_URL}/functions/v1/central-copilot-relatorio`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: c.authHeader,
          },
          body: JSON.stringify({
            thread_id: threadId,
            formato,
            prompt: promptRel || "Relatório do meu trabalho.",
            escopo_dias,
          }),
        });
        const data = await r.json();
        if (!r.ok || data.error) return { error: data.error ?? "Falha ao gerar relatório." };
        reports.push({
          relatorio_id: data.relatorio_id,
          signed_url: data.signed_url,
          nome_arquivo: data.nome_arquivo,
          formato,
          tipo: "dinamico",
        });
        return {
          ok: true,
          relatorio_id: data.relatorio_id,
          nome_arquivo: data.nome_arquivo,
          formato,
          titulo: data.titulo,
          usou_fallback: data.usou_fallback,
        };
      }

      default:
        return { error: `tool desconhecida: ${name}` };
    }
  } catch (e: any) {
    return { error: e?.message ?? "erro interno na tool" };
  }
}

function escolherModelo(userMsg: string): string {
  const t = userMsg.toLowerCase();
  const reasoningKeywords = [
    "replanej","replanejar","planejamento","planeje","plano",
    "risco","análise","analise","avalie","avaliar","priorize",
    "estratégia","estrategia","cronograma","prestação de contas","prestacao de contas",
    "ordem", "como organizar", "qual a melhor",
  ];
  if (reasoningKeywords.some((k) => t.includes(k))) return "openai/gpt-5.5-pro";
  return "google/gemini-3-flash-preview";
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "central-copilot" },
  async (req, ctx) => {
    const corsHeaders = getCorsHeaders(req);
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { thread_id, user_message } = parsed.data;
    const userId = ctx.userId!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Garante thread
    let threadId = thread_id;
    if (!threadId) {
      const { data: t, error: tErr } = await admin.from("central_copilot_threads")
        .insert({ user_id: userId, titulo: user_message.slice(0, 60) })
        .select("id").single();
      if (tErr) {
        return new Response(JSON.stringify({ error: tErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      threadId = t.id;
    } else {
      const { data: th } = await admin.from("central_copilot_threads")
        .select("user_id").eq("id", threadId).maybeSingle();
      if (!th || th.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Thread inválida." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Histórico curto
    const { data: hist } = await admin.from("central_copilot_mensagens")
      .select("role, content").eq("thread_id", threadId)
      .order("created_at", { ascending: true }).limit(20);

    // Perfil aprendido
    const { data: profile } = await admin.from("central_copilot_user_profile")
      .select("perfil_resumo, preferencias, mensagens_observadas")
      .eq("user_id", userId).maybeSingle();

    // Persiste user message
    await admin.from("central_copilot_mensagens").insert({
      thread_id: threadId, role: "user", content: user_message,
    });

    let systemContent = SYSTEM_PROMPT;
    if (profile && (profile.mensagens_observadas ?? 0) >= 3 && profile.perfil_resumo) {
      const prefs = profile.preferencias && Object.keys(profile.preferencias).length
        ? `\nPreferências observadas: ${JSON.stringify(profile.preferencias)}` : "";
      systemContent += `\n\nPERFIL DO USUÁRIO (aprendido ao longo do tempo, use para personalizar tom, formato e foco):\n${profile.perfil_resumo}${prefs}`;
    }

    const messages: any[] = [
      { role: "system", content: systemContent },
      ...((hist ?? []).map((m: any) => ({ role: m.role, content: m.content }))),
      { role: "user", content: user_message },
    ];

    const sources: Source[] = [];
    const proposals: Proposal[] = [];
    const reports: ReportOut[] = [];
    let model = escolherModelo(user_message);
    let iterations = 0;
    let finalAssistant = "";
    const toolCtx: ToolCtx = {
      userClient: userClient as any,
      admin: admin as any,
      threadId: threadId!,
      userId, authHeader, sources, proposals, reports,
    };
    while (iterations < 5) {
      iterations++;
      const result = await callAIGateway({
        messages, model, tools: TOOLS, tool_choice: "auto", timeoutMs: 55_000,
      });
      if (result.kind !== "ok") return aiGatewayErrorResponse(result, corsHeaders);
      model = result.modelUsed;
      const choice = result.data.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
          const toolRes = await execTool(tc.function.name, args, toolCtx);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(toolRes).slice(0, 60000),
          });
        }
        continue;
      }
      finalAssistant = msg.content ?? "";
      break;
    }
    if (!finalAssistant && iterations >= 5) {
      finalAssistant = "Não consegui finalizar a resposta após várias tentativas. Tente reformular sua pergunta de forma mais específica.";
    }

    const uniqueSources = Array.from(new Map(sources.map(s => [`${s.tipo}:${s.id}`, s])).values()).slice(0, 20);
    const { data: savedMsg } = await admin.from("central_copilot_mensagens").insert({
      thread_id: threadId,
      role: "assistant",
      content: finalAssistant || "Não consegui responder com as informações disponíveis.",
      sources: uniqueSources,
      model,
    }).select("id").single();

    if (proposals.length > 0 && savedMsg?.id) {
      await admin.from("central_copilot_acoes")
        .update({ mensagem_id: savedMsg.id })
        .in("id", proposals.map(p => p.id));
    }

    await admin.from("central_copilot_threads")
      .update({ updated_at: new Date().toISOString() }).eq("id", threadId);

    // Atualiza perfil em background
    const obs = (profile?.mensagens_observadas ?? 0) + 1;
    const shouldLearn = !profile || obs <= 2 || obs % 4 === 0;
    if (shouldLearn) {
      const learnFn = async () => {
        try {
          const { data: threads } = await admin.from("central_copilot_threads")
            .select("id").eq("user_id", userId).limit(20);
          const ids = (threads ?? []).map((t: any) => t.id);
          if (ids.length === 0) return;
          const { data: recent } = await admin.from("central_copilot_mensagens")
            .select("role, content").in("thread_id", ids)
            .order("created_at", { ascending: false }).limit(30);
          const transcript = (recent ?? []).reverse().map((m: any) =>
            `${m.role === "user" ? "USUÁRIO" : "IA"}: ${String(m.content).slice(0, 400)}`
          ).join("\n");
          const learnRes = await callAIGateway({
            messages: [
              { role: "system", content: "Você analisa interações para extrair um perfil curto do usuário em sua central de trabalho pessoal. Responda APENAS JSON válido: {\"perfil_resumo\": string (máx 500 chars, em português, descrevendo papel típico, tom preferido, foco recorrente — meu dia/semana/delegadas/inbox —, formatos preferidos), \"preferencias\": { \"formato_padrao\"?: \"pdf\"|\"xlsx\"|\"texto\", \"horizonte_padrao\"?: \"dia\"|\"semana\"|\"mes\", \"foco\"?: string[] }}" },
              { role: "user", content: `Histórico de interações:\n${transcript}\n\nGere o JSON do perfil.` },
            ],
            model: "google/gemini-2.5-flash-lite",
            timeoutMs: 25_000,
          });
          if (learnRes.kind !== "ok") return;
          const txt = learnRes.data.choices?.[0]?.message?.content ?? "";
          const cleaned = txt.replace(/```json\s*|\s*```/g, "").trim();
          let parsed: any;
          try { parsed = JSON.parse(cleaned); } catch { return; }
          if (typeof parsed?.perfil_resumo !== "string") return;
          await admin.from("central_copilot_user_profile").upsert({
            user_id: userId,
            perfil_resumo: String(parsed.perfil_resumo).slice(0, 700),
            preferencias: parsed.preferencias && typeof parsed.preferencias === "object" ? parsed.preferencias : {},
            mensagens_observadas: obs,
            ultima_atualizacao: new Date().toISOString(),
          });
        } catch (_e) { /* best-effort */ }
      };
      // @ts-ignore EdgeRuntime
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(learnFn());
      } else {
        learnFn();
      }
    } else {
      await admin.from("central_copilot_user_profile")
        .update({ mensagens_observadas: obs, ultima_atualizacao: new Date().toISOString() })
        .eq("user_id", userId);
    }

    return new Response(JSON.stringify({
      thread_id: threadId,
      reply: finalAssistant,
      sources: uniqueSources,
      proposals,
      reports,
      model,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
));

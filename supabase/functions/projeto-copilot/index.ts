// projeto-copilot — Fases 1-4
// Agente conversacional do projeto. Tool-calling com leitura, propostas
// de ação (exigem confirmação por senha), relatórios PDF/XLSX e
// roteamento híbrido de modelo (Flash padrão; GPT-5.2 reasoning para
// planejamento/análise). Toda leitura usa o JWT do usuário; nenhuma
// tool bypassa RLS. Mutações nunca são executadas aqui — apenas
// registradas como propostas em projeto_copilot_acoes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callAIGateway, aiGatewayErrorResponse } from "../_shared/ai-gateway-call.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const Body = z.object({
  thread_id: z.string().uuid().optional(),
  projeto_id: z.string().uuid(),
  user_message: z.string().min(1).max(8000),
}).strict();

const SYSTEM_PROMPT = `Você é o Copiloto de Projetos, um assistente de IA dentro do módulo de Projetos.

REGRAS INVIOLÁVEIS:
- Você só fala sobre o projeto atual, suas tarefas, anexos, responsáveis, prazos, custos e métricas.
- Recuse cordialmente qualquer pergunta fora desse escopo.
- Sempre cite as fontes que consultou (tarefas, anexos) referenciando-as por título.
- Responda em português do Brasil, em markdown enxuto. Use listas e tabelas quando ajudar.
- Para perguntas sobre dados, use as ferramentas disponíveis antes de responder. Não invente números.

AÇÕES (criar tarefa, ajustar prazo, reatribuir, mudar status/prioridade):
- Use as tools "propor_*" para PROPOR a ação. Nunca afirme que executou.
- Após propor, diga ao usuário: "Preparei a ação. Confirme com sua senha no card abaixo para aplicar."
- Sempre proponha uma ação por vez quando o usuário pedir uma única mudança.

RELATÓRIOS:
- Para gerar relatório PDF ou planilha, use a tool "gerar_relatorio". O arquivo aparecerá no chat para download.

Se uma ferramenta retornar vazio ou erro, diga isso claramente.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "metricas_projeto",
      description: "Retorna métricas do projeto: total de tarefas, concluídas, atrasadas, sem responsável, alta prioridade, % de conclusão.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_tarefas",
      description: "Lista tarefas do projeto com filtros opcionais.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "ex.: 'pendente', 'em_andamento', 'concluida'" },
          responsavel_id: { type: "string" },
          atrasadas: { type: "boolean", description: "se true, apenas tarefas com prazo vencido e não concluídas" },
          sem_responsavel: { type: "boolean" },
          limite: { type: "integer", default: 30 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detalhar_tarefa",
      description: "Retorna detalhes de uma tarefa específica (descrição, checklist, anexos, responsável).",
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
      name: "buscar_no_projeto",
      description: "Busca textual em títulos e descrições das tarefas do projeto.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limite: { type: "integer", default: 10 } },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "carga_por_responsavel",
      description: "Retorna a carga atual por responsável (tarefas pendentes, atrasadas, em andamento).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_anexos",
      description: "Lista anexos visíveis ao usuário (em todas as tarefas do projeto, ou em uma tarefa específica).",
      parameters: {
        type: "object",
        properties: { tarefa_id: { type: "string" }, limite: { type: "integer", default: 30 } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ler_anexo",
      description: "Extrai e retorna o conteúdo textual de um anexo PDF, CSV ou XLSX. Use somente quando o usuário pedir explicitamente para analisar um arquivo, ou quando precisar para responder.",
      parameters: {
        type: "object",
        properties: {
          anexo_id: { type: "string" },
          max_chars: { type: "integer", default: 12000, description: "limite de caracteres a retornar" },
        },
        required: ["anexo_id"],
        additionalProperties: false,
      },
    },
  },
  // ====== AÇÕES (geram propostas; aplicação requer senha) ======
  {
    type: "function",
    function: {
      name: "propor_criar_tarefa",
      description: "Propõe a criação de uma tarefa. Não executa — gera uma proposta para o usuário confirmar com senha.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          secao_id: { type: "string", description: "id da seção (opcional; usa a primeira se omitido)" },
          responsavel_id: { type: "string" },
          data_prazo: { type: "string", description: "YYYY-MM-DD" },
          prioridade: { type: "string", enum: ["baixa", "media", "alta"] },
          justificativa: { type: "string" },
        },
        required: ["titulo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_ajustar_prazo",
      description: "Propõe alterar o prazo de uma tarefa.",
      parameters: {
        type: "object",
        properties: {
          tarefa_id: { type: "string" },
          data_prazo: { type: "string", description: "YYYY-MM-DD" },
          justificativa: { type: "string" },
        },
        required: ["tarefa_id", "data_prazo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_reatribuir",
      description: "Propõe trocar o responsável de uma tarefa.",
      parameters: {
        type: "object",
        properties: {
          tarefa_id: { type: "string" },
          responsavel_id: { type: "string" },
          justificativa: { type: "string" },
        },
        required: ["tarefa_id", "responsavel_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propor_mudar_status",
      description: "Propõe alterar o status de uma tarefa.",
      parameters: {
        type: "object",
        properties: {
          tarefa_id: { type: "string" },
          status: { type: "string", enum: ["pendente", "em_andamento", "concluida", "bloqueada", "cancelada"] },
          justificativa: { type: "string" },
        },
        required: ["tarefa_id", "status"],
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
          prioridade: { type: "string", enum: ["baixa", "media", "alta"] },
          justificativa: { type: "string" },
        },
        required: ["tarefa_id", "prioridade"],
        additionalProperties: false,
      },
    },
  },
  // ====== RELATÓRIOS ======
  {
    type: "function",
    function: {
      name: "gerar_relatorio",
      description: "Gera um relatório dinâmico do projeto em PDF ou XLSX. A IA monta a estrutura (KPIs, tabelas, gráficos, listas, citações de documentos) com base no que o usuário pediu — não use sempre o mesmo template. SEMPRE passe o pedido literal do usuário em 'prompt'.",
      parameters: {
        type: "object",
        properties: {
          formato: { type: "string", enum: ["pdf", "xlsx"], description: "pdf para apresentação; xlsx para análise tabular" },
          prompt: { type: "string", description: "O pedido do usuário com detalhes (escopo, foco, recortes). Ex.: 'PDF só com tarefas atrasadas do João, agrupadas por prioridade'." },
          incluir_documentos: { type: "boolean", description: "Se true, lê os PDFs/planilhas anexados ao projeto e a IA pode citá-los no relatório. Use quando o usuário pedir análise documental.", default: false },
        },
        required: ["formato", "prompt"],
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
  projetoId: string;
  threadId: string;
  userId: string;
  authHeader: string;
  sources: Source[];
  proposals: Proposal[];
  reports: ReportOut[];
}

async function execTool(name: string, args: any, c: ToolCtx): Promise<any> {
  const { userClient, admin, projetoId, threadId, sources, proposals, reports } = c;
  try {
    switch (name) {
      case "metricas_projeto": {
        const { data, error } = await userClient
          .from("projeto_tarefas")
          .select("id, status, responsavel_id, prioridade, data_prazo")
          .eq("projeto_id", projetoId)
          .is("excluida_em", null);
        if (error) return { error: error.message };
        const today = new Date(); today.setHours(0,0,0,0);
        const total = data.length;
        const concluidas = data.filter((t: any) => t.status === "concluida").length;
        const atrasadas = data.filter((t: any) => t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < today).length;
        const sem_responsavel = data.filter((t: any) => !t.responsavel_id).length;
        const alta_prioridade = data.filter((t: any) => t.prioridade === "alta").length;
        return { total, concluidas, atrasadas, sem_responsavel, alta_prioridade, percentual_conclusao: total ? Math.round((concluidas/total)*100) : 0 };
      }
      case "listar_tarefas": {
        let q = userClient.from("projeto_tarefas")
          .select("id, titulo, status, prioridade, data_prazo, responsavel_id, secao_id")
          .eq("projeto_id", projetoId)
          .is("excluida_em", null)
          .limit(Math.min(args.limite ?? 30, 100));
        if (args.status) q = q.eq("status", args.status);
        if (args.responsavel_id) q = q.eq("responsavel_id", args.responsavel_id);
        if (args.sem_responsavel) q = q.is("responsavel_id", null);
        if (args.atrasadas) {
          q = q.neq("status", "concluida").lt("data_prazo", new Date().toISOString().slice(0,10));
        }
        const { data, error } = await q;
        if (error) return { error: error.message };
        for (const t of data ?? []) {
          sources.push({ tipo: "tarefa", id: t.id, label: t.titulo });
        }
        return { tarefas: data };
      }
      case "detalhar_tarefa": {
        const { data, error } = await userClient.from("projeto_tarefas")
          .select("id, titulo, descricao, status, prioridade, data_prazo, responsavel_id, secao_id, criador_id")
          .eq("id", args.tarefa_id)
          .maybeSingle();
        if (error) return { error: error.message };
        if (!data) return { error: "Tarefa não encontrada ou sem acesso." };
        sources.push({ tipo: "tarefa", id: data.id, label: data.titulo });
        const { data: anexos } = await userClient.from("projeto_tarefa_anexos")
          .select("id, nome, tipo_arquivo, tamanho").eq("tarefa_id", data.id);
        return { tarefa: data, anexos: anexos ?? [] };
      }
      case "buscar_no_projeto": {
        const term = String(args.query ?? "").trim();
        if (!term) return { error: "query vazia" };
        const { data, error } = await userClient.from("projeto_tarefas")
          .select("id, titulo, descricao, status")
          .eq("projeto_id", projetoId)
          .is("excluida_em", null)
          .or(`titulo.ilike.%${term}%,descricao.ilike.%${term}%`)
          .limit(Math.min(args.limite ?? 10, 30));
        if (error) return { error: error.message };
        for (const t of data ?? []) sources.push({ tipo: "tarefa", id: t.id, label: t.titulo });
        return { resultados: data };
      }
      case "carga_por_responsavel": {
        const { data, error } = await userClient.from("projeto_tarefas")
          .select("responsavel_id, status, data_prazo")
          .eq("projeto_id", projetoId)
          .is("excluida_em", null);
        if (error) return { error: error.message };
        const today = new Date(); today.setHours(0,0,0,0);
        const map = new Map<string, { responsavel_id: string|null; pendentes: number; atrasadas: number; em_andamento: number; concluidas: number }>();
        for (const t of data ?? []) {
          const k = t.responsavel_id ?? "__sem__";
          const cur = map.get(k) ?? { responsavel_id: t.responsavel_id, pendentes:0, atrasadas:0, em_andamento:0, concluidas:0 };
          if (t.status === "concluida") cur.concluidas++;
          else if (t.status === "em_andamento") cur.em_andamento++;
          else cur.pendentes++;
          if (t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < today) cur.atrasadas++;
          map.set(k, cur);
        }
        return { carga: Array.from(map.values()) };
      }
      case "listar_anexos": {
        let q = userClient.from("projeto_tarefa_anexos")
          .select("id, nome, tipo_arquivo, tamanho, tarefa_id, projeto_tarefas!inner(projeto_id, titulo)")
          .eq("projeto_tarefas.projeto_id", projetoId)
          .limit(Math.min(args.limite ?? 30, 100));
        if (args.tarefa_id) q = q.eq("tarefa_id", args.tarefa_id);
        const { data, error } = await q;
        if (error) return { error: error.message };
        for (const a of data ?? []) sources.push({ tipo: "anexo", id: a.id, label: a.nome });
        return { anexos: data };
      }
      case "ler_anexo": {
        const maxChars = Math.min(args.max_chars ?? 12000, 30000);
        const { data: anexo, error } = await userClient.from("projeto_tarefa_anexos")
          .select("id, nome, tipo_arquivo, tamanho, storage_path, projeto_tarefas!inner(projeto_id)")
          .eq("id", args.anexo_id)
          .maybeSingle();
        if (error) return { error: error.message };
        if (!anexo) return { error: "Anexo não encontrado ou sem acesso." };
        if ((anexo as any).projeto_tarefas.projeto_id !== projetoId) {
          return { error: "Anexo não pertence a este projeto." };
        }
        if (anexo.tamanho && anexo.tamanho > 20 * 1024 * 1024) {
          return { error: "Arquivo maior que 20 MB; leitura recusada." };
        }
        const { data: file, error: dlError } = await userClient.storage.from("projeto-anexos").download(anexo.storage_path);
        if (dlError || !file) return { error: dlError?.message ?? "Falha no download." };
        const buf = new Uint8Array(await file.arrayBuffer());
        const tipo = (anexo.tipo_arquivo ?? "").toLowerCase();
        const nome = anexo.nome.toLowerCase();
        let texto = "";
        try {
          if (tipo.includes("pdf") || nome.endsWith(".pdf")) {
            const mod = await import("https://esm.sh/pdfjs-serverless@0.5.0");
            const doc = await mod.getDocument({ data: buf, useSystemFonts: false }).promise;
            const numPages = Math.min(doc.numPages, 50);
            const partes: string[] = [];
            for (let i = 1; i <= numPages; i++) {
              const page = await doc.getPage(i);
              const content = await page.getTextContent();
              const txt = (content.items as any[]).map((it: any) => it.str).join(" ");
              partes.push(`--- Página ${i} ---\n${txt}`);
              if (partes.join("\n").length > maxChars) break;
            }
            texto = partes.join("\n");
          } else if (nome.endsWith(".csv") || tipo.includes("csv")) {
            texto = new TextDecoder().decode(buf);
          } else if (nome.endsWith(".xlsx") || nome.endsWith(".xls") || tipo.includes("spreadsheet") || tipo.includes("excel")) {
            const XLSX = await import("https://esm.sh/xlsx@0.18.5");
            const wb = XLSX.read(buf, { type: "array" });
            const partes: string[] = [];
            for (const sheetName of wb.SheetNames) {
              const sheet = wb.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet);
              partes.push(`# Planilha: ${sheetName}\n${csv}`);
              if (partes.join("\n").length > maxChars) break;
            }
            texto = partes.join("\n\n");
          } else if (tipo.startsWith("text/") || nome.endsWith(".txt") || nome.endsWith(".md")) {
            texto = new TextDecoder().decode(buf);
          } else {
            return { error: `Tipo de arquivo não suportado para leitura: ${tipo || nome}` };
          }
        } catch (e: any) {
          return { error: `Falha ao extrair texto: ${e?.message ?? "desconhecido"}` };
        }
        if (texto.length > maxChars) texto = texto.slice(0, maxChars) + "\n\n[...truncado...]";
        sources.push({ tipo: "anexo", id: anexo.id, label: anexo.nome });
        return { nome: anexo.nome, tipo: anexo.tipo_arquivo, conteudo: texto };
      }

      // ====== Propostas de ação ======
      case "propor_criar_tarefa":
      case "propor_ajustar_prazo":
      case "propor_reatribuir":
      case "propor_mudar_status":
      case "propor_mudar_prioridade": {
        const tipoMap: Record<string, string> = {
          propor_criar_tarefa: "criar_tarefa",
          propor_ajustar_prazo: "ajustar_prazo",
          propor_reatribuir: "reatribuir",
          propor_mudar_status: "mudar_status",
          propor_mudar_prioridade: "mudar_prioridade",
        };
        const tipo = tipoMap[name];
        // Snapshot estado anterior se houver tarefa_id
        let antes: any = null;
        let resumo = "";
        const diff: { campo: string; de: any; para: any }[] = [];
        if (args.tarefa_id) {
          const { data } = await userClient.from("projeto_tarefas")
            .select("id, titulo, status, prioridade, data_prazo, responsavel_id")
            .eq("id", args.tarefa_id).maybeSingle();
          if (!data) return { error: "Tarefa não encontrada ou sem acesso." };
          antes = data;
        }
        if (tipo === "criar_tarefa") {
          resumo = `Criar tarefa "${args.titulo}"${args.data_prazo ? ` com prazo ${args.data_prazo}` : ""}.`;
        } else if (tipo === "ajustar_prazo") {
          resumo = `Ajustar prazo de "${antes.titulo}" para ${args.data_prazo}.`;
          diff.push({ campo: "Prazo", de: antes.data_prazo ?? "—", para: args.data_prazo });
        } else if (tipo === "reatribuir") {
          resumo = `Reatribuir "${antes.titulo}".`;
          diff.push({ campo: "Responsável", de: antes.responsavel_id ?? "—", para: args.responsavel_id });
        } else if (tipo === "mudar_status") {
          resumo = `Mudar status de "${antes.titulo}" para ${args.status}.`;
          diff.push({ campo: "Status", de: antes.status, para: args.status });
        } else if (tipo === "mudar_prioridade") {
          resumo = `Mudar prioridade de "${antes.titulo}" para ${args.prioridade}.`;
          diff.push({ campo: "Prioridade", de: antes.prioridade, para: args.prioridade });
        }
        const payload: any = { ...args };
        delete payload.justificativa;
        const { data: created, error: insErr } = await admin.from("projeto_copilot_acoes").insert({
          thread_id: threadId, tipo, payload, status: "proposta",
        }).select("id").single();
        if (insErr) return { error: insErr.message };
        proposals.push({ id: created.id, tipo, payload, resumo, diff });
        return { ok: true, acao_id: created.id, resumo, requer_confirmacao_senha: true };
      }

      // ====== Relatório ======
      case "gerar_relatorio": {
        const formato = args.formato as "pdf" | "xlsx";
        const promptRel = String(args.prompt ?? "").trim();
        const incluir_documentos = Boolean(args.incluir_documentos);
        const r = await fetch(`${SUPABASE_URL}/functions/v1/projeto-copilot-relatorio`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: c.authHeader,
          },
          body: JSON.stringify({
            projeto_id: projetoId,
            thread_id: threadId,
            formato,
            prompt: promptRel || "Relatório de status do projeto.",
            incluir_documentos,
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


// Roteador simples por intenção
function escolherModelo(userMsg: string): string {
  const t = userMsg.toLowerCase();
  const reasoningKeywords = [
    "replanej", "replanejar", "planejamento", "planeje", "plano",
    "risco", "riscos", "análise", "analise", "avalie", "avaliar",
    "cenário", "cenario", "estratégia", "estrategia",
    "cronograma", "priorize as próximas", "próximas duas semanas", "proximas duas semanas",
    "ata", "reunião longa", "reuniao longa", "explique por quê", "por que",
  ];
  if (reasoningKeywords.some((k) => t.includes(k))) {
    return "openai/gpt-5.2";
  }
  return "google/gemini-3-flash-preview";
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 30, rateLimitPrefix: "projeto-copilot" },
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
    const { thread_id, projeto_id, user_message } = parsed.data;
    const userId = ctx.userId!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verifica acesso ao projeto via RPC
    const { data: hasAccess } = await admin.rpc("user_can_access_projeto", {
      _user_id: userId, _projeto_id: projeto_id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Sem acesso a este projeto." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garante thread
    let threadId = thread_id;
    if (!threadId) {
      const { data: t, error: tErr } = await admin.from("projeto_copilot_threads")
        .insert({ projeto_id, user_id: userId, titulo: user_message.slice(0, 60) })
        .select("id").single();
      if (tErr) {
        return new Response(JSON.stringify({ error: tErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      threadId = t.id;
    } else {
      // valida ownership
      const { data: th } = await admin.from("projeto_copilot_threads")
        .select("user_id, projeto_id").eq("id", threadId).maybeSingle();
      if (!th || th.user_id !== userId || th.projeto_id !== projeto_id) {
        return new Response(JSON.stringify({ error: "Thread inválida." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Carrega histórico curto (últimas 20 mensagens)
    const { data: hist } = await admin.from("projeto_copilot_mensagens")
      .select("role, content, tool_calls").eq("thread_id", threadId)
      .order("created_at", { ascending: true }).limit(20);

    // Persiste a mensagem do usuário
    await admin.from("projeto_copilot_mensagens").insert({
      thread_id: threadId, role: "user", content: user_message,
    });

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...((hist ?? []).map((m: any) => ({ role: m.role, content: m.content }))),
      { role: "user", content: user_message },
    ];

    // Loop de tool-calling (máx 4 iterações)
    const sources: Source[] = [];
    const proposals: Proposal[] = [];
    const reports: ReportOut[] = [];
    let model = escolherModelo(user_message);
    let iterations = 0;
    let finalAssistant = "";
    const toolCtx: ToolCtx = {
      userClient: userClient as any,
      admin: admin as any,
      projetoId: projeto_id,
      threadId: threadId!,
      userId,
      authHeader,
      sources, proposals, reports,
    };
    while (iterations < 5) {
      iterations++;
      const result = await callAIGateway({
        messages,
        model,
        tools: TOOLS,
        tool_choice: "auto",
        timeoutMs: 55_000,
        // Lovable AI Gateway NÃO aceita "reasoning" em modelos OpenAI (gpt-5.2 etc.).
        // gpt-5.2 já é reasoning por padrão; não enviamos o parâmetro para evitar 400.
      });

      if (result.kind !== "ok") {
        return aiGatewayErrorResponse(result, corsHeaders);
      }
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

    // Persiste resposta final do assistente
    const uniqueSources = Array.from(new Map(sources.map(s => [`${s.tipo}:${s.id}`, s])).values()).slice(0, 20);
    const { data: savedMsg } = await admin.from("projeto_copilot_mensagens").insert({
      thread_id: threadId,
      role: "assistant",
      content: finalAssistant || "Não consegui responder com as informações disponíveis.",
      sources: uniqueSources,
      model,
    }).select("id").single();

    // Vincula propostas à mensagem
    if (proposals.length > 0 && savedMsg?.id) {
      await admin.from("projeto_copilot_acoes")
        .update({ mensagem_id: savedMsg.id })
        .in("id", proposals.map(p => p.id));
    }

    await admin.from("projeto_copilot_threads")
      .update({ updated_at: new Date().toISOString() }).eq("id", threadId);

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

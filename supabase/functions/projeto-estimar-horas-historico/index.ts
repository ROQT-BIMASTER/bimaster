// Estimativa de horas retroativa por IA usando o Lovable AI Gateway.
// Recebe lista de tarefas concluídas e devolve estimativa de horas + justificativa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const Body = z.object({
  projeto_id: z.string().uuid(),
}).strict();

interface TarefaInput {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: string | null;
  data_inicio: string | null;
  data_conclusao: string | null;
  responsavel_nome: string | null;
}

export default secureHandler(
  { auth: "jwt", rateLimit: 10, rateLimitPrefix: "projeto-estimar-horas" },
  async (req, ctx) => {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), { status: 500 });
    }
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400 });
    }
    const { projeto_id } = parsed.data;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verifica acesso ao projeto
    const { data: hasAccess } = await admin.rpc("user_can_access_projeto", {
      _user_id: ctx.userId,
      _projeto_id: projeto_id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Sem acesso ao projeto" }), { status: 403 });
    }

    // Carrega tarefas concluídas que ainda NÃO têm horas registradas
    const { data: tarefas, error: tErr } = await admin
      .from("projeto_tarefas")
      .select("id, titulo, descricao, prioridade, data_inicio, data_conclusao, responsavel_id")
      .eq("projeto_id", projeto_id)
      .eq("status", "concluida")
      .is("excluida_em", null)
      .not("data_conclusao", "is", null)
      .limit(100);
    if (tErr) return new Response(JSON.stringify({ error: tErr.message }), { status: 500 });

    if (!tarefas || tarefas.length === 0) {
      return new Response(JSON.stringify({ estimativas: [] }), { headers: { "Content-Type": "application/json" } });
    }

    // Filtra tarefas que ainda não têm lançamento de horas
    const ids = tarefas.map((t) => t.id);
    const { data: jaLancadas } = await admin
      .from("projeto_horas_lancamentos")
      .select("tarefa_id")
      .in("tarefa_id", ids);
    const jaSet = new Set((jaLancadas ?? []).map((l: { tarefa_id: string }) => l.tarefa_id));
    const pendentes = tarefas.filter((t) => !jaSet.has(t.id));

    if (pendentes.length === 0) {
      return new Response(JSON.stringify({ estimativas: [] }), { headers: { "Content-Type": "application/json" } });
    }

    // Busca nomes
    const respIds = [...new Set(pendentes.map((t) => t.responsavel_id).filter(Boolean))] as string[];
    const { data: profs } = respIds.length
      ? await admin.from("profiles").select("id, nome").in("id", respIds)
      : { data: [] };
    const nomeMap = new Map((profs ?? []).map((p: { id: string; nome: string }) => [p.id, p.nome]));

    const input: TarefaInput[] = pendentes.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao,
      prioridade: t.prioridade,
      data_inicio: t.data_inicio,
      data_conclusao: t.data_conclusao,
      responsavel_nome: t.responsavel_id ? nomeMap.get(t.responsavel_id) ?? null : null,
    }));

    // Chama Lovable AI Gateway com tool calling para estrutura
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é um especialista em estimativa de esforço de software. Para cada tarefa concluída, estime quantas horas foram trabalhadas considerando título, descrição, prioridade e o intervalo entre início e conclusão. Use 0,5h para correções triviais, 1-3h para ajustes simples, 4-8h para features médias e 8-24h para features complexas. Seja conservador.",
          },
          {
            role: "user",
            content: `Estime as horas das seguintes tarefas:\n${JSON.stringify(input, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_estimativas",
              description: "Devolve a estimativa de horas para cada tarefa.",
              parameters: {
                type: "object",
                properties: {
                  estimativas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        tarefa_id: { type: "string" },
                        horas: { type: "number", minimum: 0.25, maximum: 40 },
                        justificativa: { type: "string" },
                      },
                      required: ["tarefa_id", "horas", "justificativa"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["estimativas"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "registrar_estimativas" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }), { status: 429 });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações > Workspace." }), { status: 402 });
      }
      return new Response(JSON.stringify({ error: "Falha na IA" }), { status: 500 });
    }

    const aiJson = await aiRes.json();
    const args = aiJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ error: "IA não devolveu estimativas" }), { status: 500 });
    }
    const estimativas = JSON.parse(args).estimativas as { tarefa_id: string; horas: number; justificativa: string }[];

    // Enriquece com dados da tarefa para o frontend
    const tMap = new Map(input.map((t) => [t.id, t]));
    const enriched = estimativas.map((e) => ({
      ...e,
      tarefa: tMap.get(e.tarefa_id),
    }));

    return new Response(JSON.stringify({ estimativas: enriched }), {
      headers: { "Content-Type": "application/json" },
    });
  },
);

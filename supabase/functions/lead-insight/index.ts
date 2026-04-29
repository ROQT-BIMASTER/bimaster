import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const LeadInsightSchema = z
  .object({
    prospect_id: z.string().uuid(),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "lead-insight" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const jsonHeaders = { ...cors, "Content-Type": "application/json" };

      const body = await req.json().catch(() => ({}));
      const { prospect_id } = validateBody(body, LeadInsightSchema);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: prospect } = await supabase
        .from("prospects")
        .select("*")
        .eq("id", prospect_id)
        .single();

      if (!prospect) {
        return new Response(
          JSON.stringify({ error: "Prospect não encontrado" }),
          { status: 404, headers: jsonHeaders }
        );
      }

      const { data: atividades } = await supabase
        .from("atividades")
        .select("*")
        .eq("prospect_id", prospect_id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: subtasks } = await supabase
        .from("lead_subtasks")
        .select("*")
        .eq("prospect_id", prospect_id);

      const subtasksSummary = subtasks
        ? `${subtasks.filter((s: any) => s.concluida).length}/${subtasks.length} subtarefas concluídas`
        : "Sem subtarefas";

      const atividadesSummary = atividades
        ? atividades
            .map((a: any) => `- ${a.tipo}: ${a.descricao} (${a.resultado || "sem resultado"})`)
            .join("\n")
        : "Nenhuma atividade registrada";

      const prompt = `Analise este lead e gere um insight conciso (máximo 3 parágrafos) sobre o momento atual dele. Responda em português brasileiro.

Dados do Lead:
- Empresa: ${prospect.nome_empresa}
- Status: ${prospect.status}
- Categoria: ${prospect.categoria || "Não definida"}
- Porte: ${prospect.porte_empresa || "Não informado"}
- Último contato: ${prospect.ultimo_contato || "Nunca"}
- Próxima ação: ${prospect.proxima_acao || "Não definida"}
- Subtarefas: ${subtasksSummary}

Histórico de Atividades:
${atividadesSummary}

Gere um resumo prático: qual é o momento do lead, quais riscos e oportunidades, e qual a recomendação de próximo passo.`;

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
          { status: 503, headers: jsonHeaders }
        );
      }

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "Você é um assistente de vendas B2B especializado em análise de leads. Seja direto e prático.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit atingido" }), {
            status: 429,
            headers: { ...jsonHeaders, "Retry-After": "60" },
          });
        }
        return new Response(
          JSON.stringify({ error: "Erro ao chamar IA" }),
          { status: 502, headers: jsonHeaders }
        );
      }

      const aiData = await aiResponse.json();
      const insight = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o insight.";

      return new Response(JSON.stringify({ insight }), { headers: jsonHeaders });
    }
  )
);

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { validateJWT } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { handleError } from "../_shared/error-handler.ts";

const LeadInsightSchema = z.object({
  prospect_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await validateJWT(req);
    await checkRateLimit({ prefix: "lead-insight", limit: 20, req, userId: auth.userId });

    const body = await req.json();
    const { prospect_id } = validateBody(body, LeadInsightSchema);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: prospect } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", prospect_id)
      .single();

    if (!prospect) throw new Error("Prospect não encontrado");

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
      ? atividades.map((a: any) => `- ${a.tipo}: ${a.descricao} (${a.resultado || "sem resultado"})`).join("\n")
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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um assistente de vendas B2B especializado em análise de leads. Seja direto e prático." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido" }), {
          status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json", "Retry-After": "60" },
        });
      }
      throw new Error("Erro ao chamar IA");
    }

    const aiData = await aiResponse.json();
    const insight = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o insight.";

    return new Response(JSON.stringify({ insight }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    return handleError(e, getCorsHeaders(req));
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) throw new Error("prospect_id é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados do prospect
    const { data: prospect } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", prospect_id)
      .single();

    if (!prospect) throw new Error("Prospect não encontrado");

    // Buscar atividades
    const { data: atividades } = await supabase
      .from("atividades")
      .select("*")
      .eq("prospect_id", prospect_id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Buscar subtarefas
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
- CNPJ: ${prospect.cnpj || "Não informado"}
- Último contato: ${prospect.ultimo_contato || "Nunca"}
- Próxima ação: ${prospect.proxima_acao || "Não definida"}
- Observações: ${prospect.observacoes || "Nenhuma"}
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
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit atingido, tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro ao chamar IA");
    }

    const aiData = await aiResponse.json();
    const insight = aiData.choices?.[0]?.message?.content || "Não foi possível gerar o insight.";

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lead-insight error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

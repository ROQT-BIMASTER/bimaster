import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { textoExtraido, secoes } = await req.json();

    if (!textoExtraido || !secoes) {
      return new Response(JSON.stringify({ error: "textoExtraido e secoes são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um especialista em gestão de projetos de produtos cosméticos. Sua tarefa é analisar o texto extraído de uma planilha de Briefing e gerar tarefas organizadas para o projeto.

A planilha contém seções como:
- PRODUTO: Nome comercial, ativos, apelos, variações
- ROTULAGEM: Descrição, modo de uso, composição, SKU, EAN, selos
- COMPRAS E EMBALAGEM: Fabricante, tipo plástico, dimensões

Cada campo pode ter siglas de responsabilidade:
- (D) = Desenvolvimento
- (C) = Criação de Arte  
- (R) = Regulatório
- (E) = Embalagens
- (COMP) = Compras

Você deve retornar tarefas usando a função suggest_briefing_tasks.

Regras:
1. Agrupe tarefas por área de responsabilidade
2. Use dados reais da planilha na descrição
3. Sugira a seção mais adequada dentre as disponíveis
4. Prioridade: alta para itens regulatórios/legais, média para desenvolvimento, baixa para complementares
5. Gere entre 5 e 30 tarefas conforme a complexidade do briefing`;

    const secoesInfo = secoes.map((s: any) => `- ${s.nome} (id: ${s.id})`).join("\n");
    const userPrompt = `Seções disponíveis no projeto:\n${secoesInfo}\n\nTexto extraído da planilha de Briefing:\n\n${textoExtraido}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_briefing_tasks",
              description: "Retorna as tarefas sugeridas a partir do briefing",
              parameters: {
                type: "object",
                properties: {
                  tarefas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        titulo: { type: "string", description: "Título da tarefa" },
                        descricao: { type: "string", description: "Descrição com dados extraídos do briefing" },
                        prioridade: { type: "string", enum: ["baixa", "media", "alta"] },
                        area: { type: "string", description: "Área de responsabilidade: Desenvolvimento, Criação, Regulatório, Embalagem ou Compras" },
                        secao_id: { type: "string", description: "ID da seção sugerida" },
                      },
                      required: ["titulo", "descricao", "prioridade", "area", "secao_id"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["tarefas"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_briefing_tasks" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não retornou tarefas" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("importar-briefing-ia error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

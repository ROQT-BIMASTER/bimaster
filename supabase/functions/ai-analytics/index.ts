import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();
    console.log("Received request:", { messagesCount: messages.length, userId });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Definir ferramentas disponíveis para a IA
    const tools = [
      {
        type: "function",
        function: {
          name: "consultar_prospects",
          description: "Consulta prospects no sistema com filtros opcionais por status, categoria ou município",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["novo", "contato", "qualificado", "proposta", "negociacao", "ganho", "perdido"] },
              categoria: { type: "string" },
              limit: { type: "number", default: 10, maximum: 50 }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "consultar_lojas",
          description: "Consulta lojas cadastradas no sistema com informações de localização e atividade",
          parameters: {
            type: "object",
            properties: {
              ativo: { type: "boolean" },
              estado: { type: "string" },
              limit: { type: "number", default: 10, maximum: 50 }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "consultar_visitas",
          description: "Consulta visitas realizadas com dados de compliance, duração e check-in/out",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["planned", "completed", "cancelled"] },
              data_inicio: { type: "string", format: "date" },
              data_fim: { type: "string", format: "date" },
              limit: { type: "number", default: 10, maximum: 50 }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "consultar_kpis",
          description: "Consulta KPIs agregados por período: vendas, investimentos, visitas, taxa de conversão",
          parameters: {
            type: "object",
            properties: {
              data_inicio: { type: "string", format: "date", description: "Data início YYYY-MM-DD" },
              data_fim: { type: "string", format: "date", description: "Data fim YYYY-MM-DD" },
              regiao: { type: "string" }
            },
            required: ["data_inicio", "data_fim"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "consultar_vendas",
          description: "Consulta vendas realizadas no período com valores líquidos e detalhes de loja",
          parameters: {
            type: "object",
            properties: {
              data_inicio: { type: "string", format: "date" },
              data_fim: { type: "string", format: "date" },
              limit: { type: "number", default: 20, maximum: 100 }
            },
            required: ["data_inicio", "data_fim"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "ranking_usuarios",
          description: "Consulta ranking de usuários por pontos gamificados com posição e nível",
          parameters: {
            type: "object",
            properties: {
              period_type: { type: "string", enum: ["monthly", "quarterly", "yearly", "all_time"] },
              limit: { type: "number", default: 10, maximum: 50 }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "consultar_analise_competitiva",
          description: "Consulta inteligência competitiva: produtos concorrentes, preços, share de gôndola, promoções",
          parameters: {
            type: "object",
            properties: {
              store_id: { type: "string", format: "uuid" },
              data_inicio: { type: "string", format: "date" },
              limit: { type: "number", default: 20, maximum: 50 }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "consultar_fotos_ia",
          description: "Consulta fotos com análise IA: detecção de produtos, compliance score, rupturas, promoções",
          parameters: {
            type: "object",
            properties: {
              aprovadas: { type: "boolean" },
              store_id: { type: "string", format: "uuid" },
              data_inicio: { type: "string", format: "date" },
              limit: { type: "number", default: 15, maximum: 50 }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "consultar_campanhas",
          description: "Consulta campanhas de trade marketing ativas com orçamento, período e status",
          parameters: {
            type: "object",
            properties: {
              ativa: { type: "boolean" },
              limit: { type: "number", default: 10, maximum: 30 }
            }
          }
        }
      }
    ];

    // Cache simples em memória
    const queryCache = new Map<string, { data: any; timestamp: number }>();
    const CACHE_TTL = 2 * 60 * 1000; // 2 minutos

    // Executar ferramentas com cache e logs detalhados
    const executeFunction = async (name: string, args: any) => {
      const startTime = Date.now();
      const cacheKey = `${name}:${JSON.stringify(args)}`;
      
      // Verificar cache
      const cached = queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`✅ Cache hit for ${name}`, { args, cacheAge: Date.now() - cached.timestamp });
        return cached.data;
      }
      console.log("Executing function:", name, args);
      
      try {
        switch (name) {
          case "consultar_prospects": {
            let query = supabase
              .from("prospects")
              .select("id, nome, status, municipio, created_at, zona_geografica")
              .order("created_at", { ascending: false })
              .limit(args.limit || 10);
            
            if (args.status) {
              query = query.eq("status", args.status);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return { success: true, data, count: data.length };
          }

          case "consultar_lojas": {
            let query = supabase
              .from("stores")
              .select("id, name, city, state, category, active, created_at")
              .order("created_at", { ascending: false })
              .limit(args.limit || 10);
            
            if (args.ativo !== undefined) {
              query = query.eq("active", args.ativo);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return { success: true, data, count: data.length };
          }

          case "consultar_visitas": {
            let query = supabase
              .from("visits")
              .select(`
                id, 
                visit_date, 
                status, 
                compliance_score,
                duration_minutes,
                stores:store_id(name, city)
              `)
              .order("visit_date", { ascending: false })
              .limit(args.limit || 10);
            
            if (args.status) {
              query = query.eq("status", args.status);
            }
            
            if (args.data_inicio) {
              query = query.gte("visit_date", args.data_inicio);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            return { success: true, data, count: data.length };
          }

          case "consultar_kpis": {
            const { data, error } = await supabase
              .from("agg_daily_kpis")
              .select("*")
              .gte("date", args.data_inicio)
              .lte("date", args.data_fim)
              .order("date", { ascending: true });
            
            if (error) throw error;
            
            // Agregar dados
            const summary = {
              total_visitas: data.reduce((sum, d) => sum + (d.total_visitas || 0), 0),
              total_vendas: data.reduce((sum, d) => sum + (d.total_vendas || 0), 0),
              total_prospects: data.reduce((sum, d) => sum + (d.total_prospects || 0), 0),
              taxa_conversao_media: data.reduce((sum, d) => sum + (d.taxa_conversao || 0), 0) / data.length,
              data: data
            };
            
            return { success: true, summary, detalhes: data };
          }

          case "consultar_vendas": {
            const { data, error } = await supabase
              .from("sales")
              .select(`
                id,
                sale_date,
                net_value,
                gross_value,
                stores:store_id(name, city)
              `)
              .gte("sale_date", args.data_inicio)
              .lte("sale_date", args.data_fim)
              .order("sale_date", { ascending: false })
              .limit(args.limit || 20);
            
            if (error) throw error;
            
            const total = data.reduce((sum, sale) => sum + (sale.net_value || 0), 0);
            return { success: true, data, total_vendas: total, count: data.length };
          }

          case "ranking_usuarios": {
            const { data, error } = await supabase
              .from("user_rankings")
              .select(`
                user_id,
                total_points,
                ranking_position,
                level_name,
                profiles:user_id(nome)
              `)
              .eq("period_type", args.period_type || "monthly")
              .order("ranking_position", { ascending: true })
              .limit(args.limit || 10);
            
            if (error) throw error;
            return { success: true, data, count: data.length };
          }

          default:
            return { success: false, error: "Função não encontrada" };
        }
      } catch (error) {
        console.error("Error executing function:", error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    };

    // Primeira chamada à IA com as ferramentas
    const systemPrompt = `Você é um analista de dados especialista no sistema de CRM, Trade Marketing e Gestão Comercial. 

Você tem acesso a todas as informações do sistema através de ferramentas especializadas. Você pode:
- Consultar prospects, lojas, visitas, vendas e KPIs
- Gerar análises detalhadas com dados reais
- Criar insights acionáveis baseados nos dados
- Sugerir relatórios e visualizações

Quando o usuário pedir dados, SEMPRE use as ferramentas disponíveis para buscar informações reais do sistema.
Ao responder, seja claro, objetivo e forneça números e estatísticas sempre que possível.

Para datas, use o formato YYYY-MM-DD. Se o usuário não especificar datas, use os últimos 30 dias.

Quando retornar dados que podem ser visualizados em gráficos, estruture a resposta em formato JSON dentro de um bloco de código com o tipo "chart", assim:

\`\`\`chart
{
  "type": "bar|line|pie|area",
  "title": "Título do Gráfico",
  "data": [
    { "name": "Label", "value": 123 },
    ...
  ]
}
\`\`\`

Tipos de gráficos disponíveis:
- bar: gráfico de barras
- line: gráfico de linha
- pie: gráfico de pizza
- area: gráfico de área`;

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
          ...messages
        ],
        tools,
        tool_choice: "auto",
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes no Lovable AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao chamar IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Processar stream e executar tool calls
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        let toolCalls: any[] = [];
        let currentToolCall: any = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim() || line.startsWith(":")) continue;
              if (!line.startsWith("data: ")) continue;

              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const choice = parsed.choices?.[0];
                
                if (choice?.delta?.tool_calls) {
                  for (const toolCall of choice.delta.tool_calls) {
                    if (toolCall.index !== undefined) {
                      if (!toolCalls[toolCall.index]) {
                        toolCalls[toolCall.index] = {
                          id: toolCall.id || `call_${Date.now()}`,
                          type: "function",
                          function: { name: "", arguments: "" }
                        };
                      }
                      
                      if (toolCall.function?.name) {
                        toolCalls[toolCall.index].function.name = toolCall.function.name;
                      }
                      if (toolCall.function?.arguments) {
                        toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                      }
                    }
                  }
                } else if (choice?.delta?.content) {
                  // Stream do conteúdo normal
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } else if (choice?.finish_reason === "tool_calls" && toolCalls.length > 0) {
                  // Executar tool calls
                  console.log("Tool calls detected:", toolCalls);
                  
                  const toolResults = await Promise.all(
                    toolCalls.map(async (toolCall) => {
                      const args = JSON.parse(toolCall.function.arguments);
                      const result = await executeFunction(toolCall.function.name, args);
                      return {
                        tool_call_id: toolCall.id,
                        role: "tool",
                        content: JSON.stringify(result)
                      };
                    })
                  );

                  // Segunda chamada à IA com os resultados das ferramentas
                  const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${LOVABLE_API_KEY}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      model: "google/gemini-2.5-flash",
                      messages: [
                        { role: "system", content: systemPrompt },
                        ...messages,
                        {
                          role: "assistant",
                          tool_calls: toolCalls.map(tc => ({
                            id: tc.id,
                            type: "function",
                            function: {
                              name: tc.function.name,
                              arguments: tc.function.arguments
                            }
                          }))
                        },
                        ...toolResults
                      ],
                      stream: true,
                    }),
                  });

                  // Stream da resposta final
                  const followUpReader = followUpResponse.body!.getReader();
                  let followUpBuffer = "";
                  
                  while (true) {
                    const { done, value } = await followUpReader.read();
                    if (done) break;
                    
                    followUpBuffer += decoder.decode(value, { stream: true });
                    const followUpLines = followUpBuffer.split("\n");
                    followUpBuffer = followUpLines.pop() || "";
                    
                    for (const followUpLine of followUpLines) {
                      if (!followUpLine.trim() || followUpLine.startsWith(":")) continue;
                      if (!followUpLine.startsWith("data: ")) continue;
                      
                      const followUpData = followUpLine.slice(6).trim();
                      if (followUpData === "[DONE]") continue;
                      
                      controller.enqueue(encoder.encode(`data: ${followUpData}\n\n`));
                    }
                  }
                }
              } catch (e) {
                console.error("Error parsing SSE:", e);
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

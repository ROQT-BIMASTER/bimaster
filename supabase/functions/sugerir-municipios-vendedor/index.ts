import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { vendedor_nome, municipios_atuais, municipios_disponiveis } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Limit to avoid token overflow
    const disponiveisLimitados = (municipios_disponiveis || []).slice(0, 200);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `Você é um especialista em distribuição geográfica de territórios de vendas no Brasil.
Analise os municípios já atribuídos ao vendedor e sugira municípios disponíveis que façam sentido geográfico (mesma UF, região próxima).
Retorne no máximo 30 municípios sugeridos.`,
          },
          {
            role: "user",
            content: `Vendedor: ${vendedor_nome}

Municípios já atribuídos:
${(municipios_atuais || []).join("\n") || "Nenhum"}

Municípios disponíveis (sem vendedor):
${disponiveisLimitados.map((m: any) => `ID:${m.id} | ${m.nome} (${m.uf}) - ${m.regiao}`).join("\n")}

Sugira os IDs dos municípios disponíveis que melhor se encaixam na carteira deste vendedor, priorizando mesma UF e região.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "sugerir_municipios",
              description: "Retorna lista de IDs de municípios sugeridos para atribuição ao vendedor.",
              parameters: {
                type: "object",
                properties: {
                  sugestoes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array de UUIDs dos municípios sugeridos",
                  },
                  justificativa: {
                    type: "string",
                    description: "Breve justificativa da sugestão",
                  },
                },
                required: ["sugestoes", "justificativa"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "sugerir_municipios" } },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro AI gateway:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione fundos em Settings > Workspace > Usage." }),
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ sugestoes: [], justificativa: "Erro ao consultar IA" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("Resposta IA sem tool_calls:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ sugestoes: [], justificativa: "IA não retornou sugestões" }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const resultado = JSON.parse(toolCall.function.arguments);
    console.log("Sugestões IA:", resultado);

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro sugerir-municipios-vendedor:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido", sugestoes: [] }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, category, imageBase64 } = await req.json();

    if (!description && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "Informe uma descrição ou envie uma imagem" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user message content (text + optional image)
    const userContent: any[] = [];

    let textPrompt = "";
    if (description) {
      textPrompt += `Crie campos para o formulário: "${description}".`;
    }
    if (category) {
      textPrompt += ` Categoria: ${category}.`;
    }
    if (imageBase64) {
      textPrompt += ` Analise também a imagem enviada para extrair campos do formulário mostrado.`;
    }
    textPrompt += " Sugira entre 4 e 10 campos relevantes.";

    userContent.push({ type: "text", text: textPrompt });

    if (imageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageBase64 },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              "Você é um especialista em formulários de Trade Marketing. Analise a descrição, imagem e/ou dados de planilha fornecidos e sugira campos para um formulário dinâmico. Se uma imagem de formulário for fornecida, extraia os campos visíveis nela. Se dados de planilha forem fornecidos (colunas e exemplos), use os cabeçalhos e dados de exemplo para inferir os tipos de campo corretos (text para texto, number para numérico, date para datas, price para valores monetários, select para campos com opções limitadas, checkbox para sim/não, file para anexos, image para fotos, address para endereços com CEP). Para campos de endereço/CEP/localização, use o tipo 'address' que possui auto-preenchimento via CEP. Retorne usando a função suggest_fields.",
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_fields",
              description: "Retorna campos sugeridos para o formulário",
              parameters: {
                type: "object",
                properties: {
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string", description: "Nome do campo" },
                        field_type: {
                          type: "string",
                          enum: ["text", "number", "date", "select", "checkbox", "file", "image", "price", "address"],
                        },
                        required: { type: "boolean" },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "Opções para select/checkbox",
                        },
                        placeholder: { type: "string" },
                      },
                      required: ["label", "field_type", "required"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["fields"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_fields" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione fundos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ fields: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("suggest-form-fields error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

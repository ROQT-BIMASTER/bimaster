import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    if (!image) {
      throw new Error("Imagem não fornecida");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const prompt = `Analise esta imagem de uma tabela de custos de produto e extraia todos os insumos/materiais listados.

Para cada linha da tabela, extraia:
- codigo: O código do insumo (primeira coluna, geralmente um número)
- nome: O nome do insumo (segunda coluna)
- fornecedor: O nome do fornecedor (terceira coluna)
- custo_nf: O valor da coluna "NF" (quarta coluna) - apenas o número, sem "R$"
- custo_servico: O valor da coluna "Serviço" (quinta coluna) - apenas o número, sem "R$"  
- custo_condicao: O valor da coluna "Condição" (sexta coluna) - apenas o número, sem "R$"
- nf_referencia: O número da NF de referência (última coluna, se houver)

IMPORTANTE:
- Ignore linhas de totais ou subtotais
- Ignore linhas como "10% sobre o custo" ou similares
- Se um campo estiver vazio, use string vazia "" ou 0 para números
- Mantenha os valores numéricos com até 6 casas decimais
- O formato brasileiro usa vírgula como separador decimal - converta para ponto

Retorne APENAS um JSON válido no formato:
{
  "insumos": [
    {
      "codigo": "22904",
      "nome": "Bulk",
      "fornecedor": "Rodrigues",
      "custo_nf": 0.188302,
      "custo_servico": 0.188302,
      "custo_condicao": 0,
      "nf_referencia": ""
    }
  ]
}`;

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
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro da API:", errorText);
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Resposta vazia da IA");
    }

    // Parse do JSON da resposta
    let parsed;
    try {
      // Remove possíveis markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleanContent);
    } catch (parseErr) {
      console.error("Erro ao parsear resposta:", content);
      throw new Error("Resposta da IA em formato inválido");
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

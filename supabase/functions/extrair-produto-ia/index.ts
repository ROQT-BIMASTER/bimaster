import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um assistente especializado em extrair dados de cadastro de produtos a partir de textos ou imagens de sistemas ERP.

Analise o conteúdo fornecido e extraia o máximo de informações possível para preencher o cadastro de um produto acabado.

Você DEVE retornar APENAS um JSON com os campos abaixo (use null para campos não encontrados):

{
  "codigo": "código interno do produto",
  "sku": "SKU do produto",
  "codigo_barras_ean": "código de barras EAN/GTIN",
  "codigo_legado": "código do sistema anterior/legado",
  "nome": "nome completo do produto",
  "nome_comercial": "nome comercial/de vendas",
  "descricao_curta": "descrição resumida",
  "descricao_completa": "descrição detalhada",
  "categoria": "categoria principal",
  "subcategoria": "subcategoria",
  "linha": "linha de produtos",
  "marca": "marca",
  "fabricante": "fabricante",
  "modelo": "modelo",
  "versao_variacao": "versão ou variação",
  "ncm": "código NCM (Nomenclatura Comum do Mercosul)",
  "origem": "nacional ou importado",
  "tipo_rotulagem": "sticker, label, sleeve, tag ou outro",
  "unidade_medida": "unidade de medida (UN, KG, CX, LT, etc.)",
  "rendimento": "rendimento numérico se disponível",
  "tempo_producao_minutos": "tempo de produção em minutos se disponível"
}

Regras:
- Extraia TODOS os campos que conseguir identificar no texto/imagem
- Se um campo não for encontrado, use null
- Para "origem", interprete termos como "importado", "nacional", "made in brazil" etc.
- Código de barras deve ser apenas números
- NCM deve estar no formato XX.XX.XX.XX ou XXXX.XX.XX
- Não invente dados, extraia apenas o que está presente
- Retorne SOMENTE o JSON, sem markdown, sem explicações`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ===== AUTENTICAÇÃO JWT =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text, imageBase64 } = await req.json();

    if (!text && !imageBase64) {
      return new Response(
        JSON.stringify({ error: "Forneça texto ou imagem para análise" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build messages based on input type
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (imageBase64) {
      // Use vision model for images
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "Analise esta imagem de um sistema ERP e extraia os dados do produto cadastrado. Retorne APENAS o JSON estruturado.",
          },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${imageBase64}` },
          },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `Analise o seguinte texto copiado de um sistema ERP e extraia os dados do produto:\n\n${text}`,
      });
    }

    const model = imageBase64 ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle possible markdown wrapping)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const extractedData = JSON.parse(jsonStr);

    return new Response(
      JSON.stringify({ data: extractedData, model }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao processar dados" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planilhaTexto } = await req.json();
    console.log("📊 Iniciando análise de planilha com IA...");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const systemPrompt = `Você é um assistente especializado em análise de dados de empresas para um CRM de prospecção.

Sua tarefa é analisar os dados fornecidos (que podem estar em formato de planilha, texto não estruturado, lista, etc.) e extrair TODAS as empresas/prospects mencionados.

REGRAS IMPORTANTES:
1. Extraia TODOS os prospects que conseguir identificar nos dados
2. Para cada prospect, tente extrair o máximo de informações possível
3. Se um campo não estiver disponível, use null
4. Normalize os dados (remova acentos desnecessários, padronize formatos)
5. Para município e UF, sempre tente identificar mesmo se não estiver explícito
6. Se o porte não for claro, use null (valores aceitos: MEI, ME, EPP, Grande)

Retorne um JSON com a seguinte estrutura:
{
  "prospects": [
    {
      "nome_empresa": "string (obrigatório)",
      "cnpj": "string ou null",
      "municipio": "string (obrigatório)",
      "uf": "string de 2 letras ou null",
      "telefone": "string ou null",
      "email": "string ou null",
      "contato_principal": "string ou null",
      "porte_empresa": "MEI | ME | EPP | Grande | null",
      "segmento": "string ou null",
      "observacoes": "string ou null"
    }
  ],
  "total_encontrados": number,
  "confianca": "alta | media | baixa"
}`;

    const userPrompt = `Analise os seguintes dados e extraia todas as empresas/prospects que encontrar:\n\n${planilhaTexto}`;

    console.log("🤖 Chamando IA para análise...");
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na resposta da IA:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro na IA: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log("📝 Resposta da IA:", content);

    // Extrair JSON da resposta (pode vir com markdown)
    let resultado;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultado = JSON.parse(jsonMatch[0]);
      } else {
        resultado = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Erro ao parsear resposta da IA:", parseError);
      throw new Error("Não foi possível processar a resposta da IA. Tente novamente.");
    }

    console.log(`✅ Análise concluída: ${resultado.total_encontrados} prospects encontrados`);

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Erro na função:", error);
    return new Response(
      JSON.stringify({ 
        error: error?.message || "Erro ao processar planilha",
        details: error?.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

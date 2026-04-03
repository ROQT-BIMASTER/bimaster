import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { municipio, uf } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    console.log(`Padronizando município: ${municipio}, UF: ${uf}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em padronização de nomes de municípios brasileiros. 
Sua tarefa é corrigir erros de digitação, abreviações e variações nos nomes de municípios e estados.
Sempre retorne o nome oficial completo do município e a sigla correta do estado (2 letras maiúsculas).
Se não conseguir identificar o município, retorne o nome original.`
          },
          {
            role: "user",
            content: `Padronize este município: "${municipio}"${uf ? `, Estado: "${uf}"` : ''}
            
Retorne APENAS um JSON válido com esta estrutura exata:
{
  "municipio_padrao": "Nome Oficial do Município",
  "uf_padrao": "UF",
  "regiao": "Sul|Sudeste|Centro-Oeste|Norte|Nordeste",
  "confianca": "alta|media|baixa"
}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro da API de IA:", errorText);
      
      // Retorna dados originais em caso de erro
      return new Response(
        JSON.stringify({
          municipio_padrao: municipio,
          uf_padrao: uf || null,
          regiao: null,
          confianca: "baixa"
        }),
        { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Resposta da IA inválida");
    }

    console.log("Resposta da IA:", content);

    // Extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON não encontrado na resposta");
    }

    const resultado = JSON.parse(jsonMatch[0]);

    // Validar e limpar o resultado
    const resposta = {
      municipio_padrao: resultado.municipio_padrao || municipio,
      uf_padrao: resultado.uf_padrao?.toUpperCase()?.slice(0, 2) || uf || null,
      regiao: ["Sul", "Sudeste", "Centro-Oeste", "Norte", "Nordeste"].includes(resultado.regiao) 
        ? resultado.regiao 
        : null,
      confianca: ["alta", "media", "baixa"].includes(resultado.confianca) 
        ? resultado.confianca 
        : "baixa"
    };

    console.log("Resultado padronizado:", resposta);

    return new Response(
      JSON.stringify(resposta),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro ao padronizar município:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        municipio_padrao: null,
        uf_padrao: null
      }),
      { 
        status: 500, 
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } 
      }
    );
  }
});

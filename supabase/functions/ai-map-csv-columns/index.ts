import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


const DB_SCHEMA = {
  contas_receber: {
    cliente_codigo: "Código do cliente (ex: 001, CLI001)",
    cliente_nome: "Nome/Razão social do cliente",
    numero_documento: "Número do documento/título/nota fiscal (OBRIGATÓRIO)",
    parcela: "Número da parcela (1, 2, 3...)",
    data_emissao: "Data de emissão do documento",
    data_vencimento: "Data de vencimento",
    data_recebimento: "Data do recebimento/pagamento",
    valor_original: "Valor original do título",
    valor_aberto: "Saldo em aberto/devedor",
    valor_recebido: "Valor já recebido/pago",
    valor_juros: "Valor de juros",
    valor_desconto: "Valor de desconto",
    status: "Status (pendente, pago, vencido, etc)",
    empresa_id: "ID/Código da empresa/filial",
    empresa_nome: "Nome da empresa/filial",
    vendedor_codigo: "Código do vendedor/representante",
    vendedor_nome: "Nome do vendedor",
    tipo_documento: "Tipo do documento (NF, boleto, etc)",
    portador: "Portador/Banco/Carteira",
    dias_atraso: "Dias em atraso",
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { headers, sampleRows, tableName = "contas_receber" } = await req.json();

    if (!headers || !Array.isArray(headers)) {
      return new Response(
        JSON.stringify({ error: "Headers array is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const schema = DB_SCHEMA[tableName as keyof typeof DB_SCHEMA];
    if (!schema) {
      throw new Error(`Unknown table: ${tableName}`);
    }

    const systemPrompt = `Você é um especialista em mapeamento de dados CSV para bancos de dados.
Sua tarefa é analisar os cabeçalhos de um arquivo CSV e mapear cada coluna para o campo correto do banco de dados.

REGRAS IMPORTANTES:
1. Analise o nome da coluna e os dados de exemplo para determinar o mapeamento correto
2. Se não houver correspondência clara, use null
3. O campo "numero_documento" é OBRIGATÓRIO - encontre-o a qualquer custo
4. Considere variações como: abreviações, acentos, underscores, camelCase
5. Preste atenção em padrões nos dados de exemplo (datas, valores monetários, códigos)`;

    const userPrompt = `Analise estas colunas do CSV e mapeie para os campos do banco de dados.

COLUNAS DO CSV:
${headers.map((h: string, i: number) => `${i + 1}. "${h}"`).join('\n')}

DADOS DE EXEMPLO (primeiras 3 linhas):
${sampleRows ? sampleRows.slice(0, 3).map((row: Record<string, string>, i: number) => 
  `Linha ${i + 1}: ${JSON.stringify(row)}`
).join('\n') : 'Não disponível'}

CAMPOS DO BANCO DE DADOS (tabela: ${tableName}):
${Object.entries(schema).map(([field, desc]) => `- ${field}: ${desc}`).join('\n')}

Retorne o mapeamento usando a função fornecida.`;

    console.log("[AI Map] Sending request to Lovable AI...");
    console.log("[AI Map] Headers:", headers);

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
              name: "map_columns",
              description: "Mapeia colunas do CSV para campos do banco de dados",
              parameters: {
                type: "object",
                properties: {
                  mappings: {
                    type: "array",
                    description: "Lista de mapeamentos de coluna CSV para campo do banco",
                    items: {
                      type: "object",
                      properties: {
                        csv_column: { 
                          type: "string", 
                          description: "Nome exato da coluna no CSV" 
                        },
                        db_field: { 
                          type: ["string", "null"], 
                          description: "Nome do campo no banco ou null se não houver correspondência" 
                        },
                        confidence: { 
                          type: "string", 
                          enum: ["high", "medium", "low"],
                          description: "Nível de confiança no mapeamento" 
                        },
                        reason: {
                          type: "string",
                          description: "Breve explicação do mapeamento"
                        }
                      },
                      required: ["csv_column", "db_field", "confidence"],
                      additionalProperties: false
                    }
                  },
                  document_field_found: {
                    type: "boolean",
                    description: "Se o campo obrigatório numero_documento foi encontrado"
                  },
                  suggestions: {
                    type: "array",
                    description: "Sugestões ou alertas sobre o mapeamento",
                    items: { type: "string" }
                  }
                },
                required: ["mappings", "document_field_found"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "map_columns" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("[AI Map] Gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("[AI Map] AI Response:", JSON.stringify(aiResponse, null, 2));

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "map_columns") {
      throw new Error("Invalid AI response format");
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log("[AI Map] Parsed result:", result);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        dbSchema: Object.keys(schema),
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[AI Map] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

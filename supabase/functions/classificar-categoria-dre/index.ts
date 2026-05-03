import { secureHandler } from "../_shared/secure-handler.ts";
import { logger } from "../_shared/logger.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { z } from "https://esm.sh/zod@3.22.4";

const BodySchema = z.object({
  accountCode: z.string().min(1).max(64),
  accountName: z.string().min(1).max(255),
  accountDescription: z.string().max(2000).optional().nullable(),
  accountType: z.string().max(64).optional().nullable(),
}).strict();


const CATEGORIAS_DRE = [
  { value: 'receita_bruta', label: 'Receita Bruta', descricao: 'Receitas operacionais da empresa (vendas, serviços)' },
  { value: 'deducoes', label: 'Deduções e Abatimentos', descricao: 'Impostos sobre vendas, devoluções, descontos concedidos' },
  { value: 'custo_vendas', label: 'Custo de Vendas', descricao: 'CMV, custos de produção, matéria-prima, mão de obra direta' },
  { value: 'despesas_fixas', label: 'Despesas Fixas', descricao: 'Despesas administrativas, pessoal, aluguel, utilities' },
  { value: 'despesas_variaveis', label: 'Despesas Variáveis', descricao: 'Marketing, trade marketing, comissões, campanhas' },
  { value: 'resultado_financeiro', label: 'Resultado Financeiro', descricao: 'Receitas e despesas financeiras, juros, tarifas bancárias' },
  { value: 'impostos_lucro', label: 'Impostos s/ Lucro', descricao: 'IRPJ, CSLL, impostos sobre o resultado' },
  { value: 'resultado_nao_operacional', label: 'Resultado Não Operacional', descricao: 'Receitas e despesas não relacionadas à operação principal' },
];

Deno.serve(secureHandler({ auth: "jwt", rateLimit: 30, rateLimitPrefix: "classificar-categoria-dre" }, async (req, _ctx) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: { code: "VAL-001", details: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`) } }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }
    const { accountCode, accountName, accountDescription, accountType } = parsed.data;

    logger.log("Classificando para DRE:", { accountCode, accountName, accountType });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const categoriasInfo = CATEGORIAS_DRE.map(c => 
      `- ${c.value}: ${c.label} - ${c.descricao}`
    ).join('\n');

    const systemPrompt = `Você é um especialista em contabilidade e DRE (Demonstração do Resultado do Exercício).
Sua tarefa é classificar contas contábeis na categoria correta da DRE.

CATEGORIAS DISPONÍVEIS:
${categoriasInfo}

REGRAS DE CLASSIFICAÇÃO:
1. Contas de RECEITA (vendas, serviços, faturamento) → receita_bruta
2. Contas de IMPOSTOS SOBRE VENDAS (ICMS, PIS, COFINS sobre vendas, devoluções) → deducoes
3. Contas de CUSTO (CMV, compras, produção, matéria-prima, fretes, embalagens) → custo_vendas
4. Contas de DESPESA FIXA (administrativas, pessoal, salários, aluguel, utilities) → despesas_fixas
5. Contas de DESPESA VARIÁVEL (marketing, trade, comissões, campanhas) → despesas_variaveis
6. Contas FINANCEIRAS (juros, tarifas bancárias, receitas financeiras) → resultado_financeiro
7. Contas de IMPOSTOS SOBRE LUCRO (IRPJ, CSLL, provisão IR) → impostos_lucro
8. Contas NÃO OPERACIONAIS (receitas/despesas extraordinárias) → resultado_nao_operacional

Analise o código, nome e tipo da conta para determinar a categoria correta.
Se a conta não se encaixar claramente em nenhuma categoria (ex: contas patrimoniais), retorne null.`;

    const userPrompt = `Classifique esta conta contábil para a DRE:
- Código: ${accountCode}
- Nome: ${accountName}
- Tipo: ${accountType}
${accountDescription ? `- Descrição: ${accountDescription}` : ''}

Qual categoria DRE é mais adequada?`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        tools: [
          {
            type: "function",
            function: {
              name: "classificar_categoria_dre",
              description: "Classifica a conta na categoria DRE mais adequada",
              parameters: {
                type: "object",
                properties: {
                  categoria_dre: {
                    type: "string",
                    description: "Categoria DRE escolhida ou null se não aplicável",
                    enum: ["receita_bruta", "deducoes", "custo_vendas", "despesas_fixas", "despesas_variaveis", "resultado_financeiro", "impostos_lucro", "resultado_nao_operacional", "null"]
                  },
                  confianca: {
                    type: "number",
                    description: "Score de confiança da classificação (0-1)",
                    minimum: 0,
                    maximum: 1
                  },
                  justificativa: {
                    type: "string",
                    description: "Breve explicação da escolha (máximo 100 caracteres)"
                  }
                },
                required: ["categoria_dre", "confianca", "justificativa"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "classificar_categoria_dre" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logger.error("Erro na API AI Gateway:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), 
          { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos na sua workspace." }), 
          { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro na API: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error("Resposta da IA inválida");
    }

    const resultado = JSON.parse(toolCall.function.arguments);
    logger.log("Classificação DRE:", resultado);

    // Tratar "null" como string para null real
    const categoriaFinal = resultado.categoria_dre === "null" ? null : resultado.categoria_dre;
    
    const categoriaLabel = CATEGORIAS_DRE.find(c => c.value === categoriaFinal)?.label || null;

    return new Response(
      JSON.stringify({
        success: true,
        categoria_dre: categoriaFinal,
        categoria_label: categoriaLabel,
        confianca: resultado.confianca,
        justificativa: resultado.justificativa
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    logger.error("Erro na classificação DRE:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro ao classificar conta",
        details: error.toString()
      }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
}));
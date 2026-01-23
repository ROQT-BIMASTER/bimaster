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
    const body = await req.json();
    
    // Suportar tanto classificação de contas contábeis quanto de lançamentos
    const { 
      // Para lançamentos (contas a pagar)
      fornecedor, categoria, valor, documento, comentario,
      // Para contas contábeis
      accountCode, accountName, accountDescription, accountType 
    } = body;
    
    const isLancamento = !!(fornecedor || categoria);
    
    console.log("Classificando:", isLancamento ? { fornecedor, categoria, valor, comentario } : { accountCode, accountName, accountType });

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar departamentos disponíveis
    const { data: departamentos, error: deptError } = await supabase
      .from('departamentos')
      .select('id, nome, descricao')
      .eq('ativo', true);

    if (deptError) {
      console.error("Erro ao buscar departamentos:", deptError);
      throw new Error("Erro ao buscar departamentos");
    }

    if (!departamentos || departamentos.length === 0) {
      throw new Error("Nenhum departamento ativo encontrado");
    }

    // Buscar planos de contas disponíveis
    const { data: planosContas, error: planoError } = await supabase
      .from('trade_chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('active', true)
      .order('code');

    if (planoError) {
      console.error("Erro ao buscar planos de contas:", planoError);
    }

    // Preparar prompt para a IA
    const departamentosInfo = departamentos.map(d => 
      `- ${d.nome}${d.descricao ? `: ${d.descricao}` : ''}`
    ).join('\n');

    const planosInfo = planosContas?.map(p => 
      `- ${p.code} - ${p.name} (${p.account_type})`
    ).join('\n') || 'Não disponível';

    let systemPrompt: string;
    let userPrompt: string;

    if (isLancamento) {
      systemPrompt = `Você é um especialista em classificação contábil brasileira.
Sua tarefa é analisar lançamentos financeiros (contas a pagar) e classificá-los corretamente.

DEPARTAMENTOS DISPONÍVEIS:
${departamentosInfo}

PLANO DE CONTAS DISPONÍVEL (use APENAS estas contas):
${planosInfo}

GUIA DE CLASSIFICAÇÃO POR ESTRUTURA CONTÁBIL:
- 3.1.x = Custos de Vendas (CMV, Compras de Mercadoria, Fretes de Vendas)
- 3.2.x = Despesas Variáveis (Comissões, Representantes, Embalagens)
- 3.3.x = Despesas Fixas (Salários, Aluguel, Água, Luz, Internet, Software, Manutenção)
- 3.4.x = Impostos e Tributos (ICMS, PIS, COFINS, ISS, Simples Nacional, IRPJ, CSLL)
- 3.5.x = Outras Despesas Operacionais
- 3.6.x = Despesas de Marketing e Publicidade
- 3.7.x = Despesas Financeiras (Juros, Tarifas Bancárias, IOF)
- 3.8.x = Retiradas dos Sócios (Pró-labore, Distribuição de Lucros)
- 4.1.x = Receita Operacional Bruta
- 4.2.x = Deduções da Receita

DEPARTAMENTOS POR TIPO DE DESPESA:
- Financeiro: Impostos, tributos, tarifas bancárias, juros
- RH: Salários, benefícios, encargos trabalhistas, férias, 13º
- Comercial: Comissões, representantes, fretes de vendas
- Marketing: Publicidade, propaganda, mídia
- Operações: Aluguel, utilidades (água, luz), manutenção
- TI: Software, equipamentos de informática
- Administrativo: Despesas gerais, material de escritório

Considere:
- O nome do fornecedor pode indicar o tipo de serviço/produto
- A categoria original pode dar pistas sobre a natureza da despesa
- IMPORTANTE: Se o usuário forneceu um comentário adicional, use-o como PRINCIPAL guia

Retorne o departamento E o plano de contas mais adequados.`;

      userPrompt = `Classifique este lançamento financeiro:
- Fornecedor: ${fornecedor || 'Não informado'}
- Categoria original: ${categoria || 'Não informada'}
- Valor: R$ ${valor ? Number(valor).toFixed(2) : 'Não informado'}
- Tipo documento: ${documento || 'Não informado'}
${comentario ? `\n⭐ COMENTÁRIO DO USUÁRIO (USE COMO GUIA PRINCIPAL):\n"${comentario}"` : ''}

Com base nestas informações, qual departamento e plano de contas são mais adequados?`;

    } else {
      systemPrompt = `Você é um especialista em classificação contábil e organizacional. 
Sua tarefa é analisar contas contábeis e classificá-las no departamento mais adequado.

Departamentos disponíveis:
${departamentosInfo}

GUIA DE CLASSIFICAÇÃO:
- Financeiro: Contas de impostos, tributos, despesas financeiras
- RH: Contas de pessoal, salários, benefícios
- Comercial: Comissões, vendas, representantes
- Marketing: Publicidade, propaganda
- Operações: Aluguel, utilidades, manutenção
- TI: Software, equipamentos
- Administrativo: Despesas gerais

Considere:
- A natureza da despesa/receita
- O setor responsável pelo gasto/receita
- Palavras-chave no nome e descrição da conta
- O código e tipo da conta

Retorne APENAS o nome exato do departamento mais adequado e um score de confiança (0-1).`;

      userPrompt = `Classifique esta conta contábil:
- Código: ${accountCode}
- Nome: ${accountName}
- Tipo: ${accountType}
${accountDescription ? `- Descrição: ${accountDescription}` : ''}

Qual departamento é mais adequado para esta conta?`;
    }

    console.log("Chamando IA para classificação...");

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    // Definir tools baseado no tipo de classificação
    const tools = isLancamento ? [
      {
        type: "function",
        function: {
          name: "classificar_lancamento",
          description: "Classifica o lançamento no departamento e plano de contas mais adequados",
          parameters: {
            type: "object",
            properties: {
              departamento: {
                type: "string",
                description: "Nome exato do departamento escolhido",
                enum: departamentos.map(d => d.nome)
              },
              plano_contas_code: {
                type: "string",
                description: "Código do plano de contas escolhido (ex: 3.3.01)"
              },
              confianca: {
                type: "number",
                description: "Score de confiança da classificação (0-1)",
                minimum: 0,
                maximum: 1
              },
              justificativa: {
                type: "string",
                description: "Breve explicação da escolha (máximo 200 caracteres)"
              }
            },
            required: ["departamento", "confianca", "justificativa"],
            additionalProperties: false
          }
        }
      }
    ] : [
      {
        type: "function",
        function: {
          name: "classificar_departamento",
          description: "Classifica a conta no departamento mais adequado",
          parameters: {
            type: "object",
            properties: {
              departamento: {
                type: "string",
                description: "Nome exato do departamento escolhido",
                enum: departamentos.map(d => d.nome)
              },
              confianca: {
                type: "number",
                description: "Score de confiança da classificação (0-1)",
                minimum: 0,
                maximum: 1
              },
              justificativa: {
                type: "string",
                description: "Breve explicação da escolha (máximo 200 caracteres)"
              }
            },
            required: ["departamento", "confianca", "justificativa"],
            additionalProperties: false
          }
        }
      }
    ];

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
        tools,
        tool_choice: { 
          type: "function", 
          function: { name: isLancamento ? "classificar_lancamento" : "classificar_departamento" } 
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro na API Lovable AI:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Limite de requisições excedido. Tente novamente em alguns instantes." 
          }), 
          { 
            status: 429, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "Créditos insuficientes. Adicione créditos na sua workspace Lovable." 
          }), 
          { 
            status: 402, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      throw new Error(`Erro na API: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("Resposta da IA recebida");

    // Extrair resultado do tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error("Resposta da IA inválida");
    }

    const resultado = JSON.parse(toolCall.function.arguments);
    console.log("Classificação:", resultado);

    // Encontrar ID do departamento
    const departamentoSelecionado = departamentos.find(
      d => d.nome === resultado.departamento
    );

    if (!departamentoSelecionado) {
      throw new Error("Departamento retornado pela IA não encontrado");
    }

    // Para lançamentos, também retornar o plano de contas
    if (isLancamento) {
      let planoContasSelecionado = null;
      if (resultado.plano_contas_code && planosContas) {
        planoContasSelecionado = planosContas.find(
          p => p.code === resultado.plano_contas_code
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          sugestao: {
            departamento_id: departamentoSelecionado.id,
            departamento_nome: departamentoSelecionado.nome,
            plano_contas_id: planoContasSelecionado?.id || null,
            plano_contas_code: planoContasSelecionado?.code || null,
            plano_contas_nome: planoContasSelecionado?.name || null,
            confianca: resultado.confianca,
            justificativa: resultado.justificativa
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        departamento_id: departamentoSelecionado.id,
        departamento_nome: departamentoSelecionado.nome,
        confianca: resultado.confianca,
        justificativa: resultado.justificativa
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro na classificação:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro ao classificar conta",
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

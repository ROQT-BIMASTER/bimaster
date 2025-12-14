import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify API key for n8n integration security
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get('N8N_API_KEY');

    if (!expectedKey) {
      console.error('❌ N8N_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKey || apiKey !== expectedKey) {
      console.error('❌ Invalid or missing API key');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ N8N API key verified');

    const { transacoes } = await req.json();
    
    if (!Array.isArray(transacoes) || transacoes.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma transação fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processando ${transacoes.length} transações do n8n`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar contas e departamentos disponíveis
    const { data: contas } = await supabase
      .from('trade_chart_of_accounts')
      .select('id, code, name, description, account_type, departamento_id')
      .eq('is_active', true);

    const { data: departamentos } = await supabase
      .from('departamentos')
      .select('id, nome, descricao')
      .eq('ativo', true);

    if (!contas || !departamentos || contas.length === 0 || departamentos.length === 0) {
      throw new Error("Nenhuma conta ou departamento encontrado");
    }

    // Preparar dados para IA
    const contasInfo = contas.map(c => 
      `${c.code} - ${c.name} (${c.account_type})${c.description ? ': ' + c.description : ''}`
    ).join('\n');

    const departamentosInfo = departamentos.map(d => 
      `- ${d.nome}: ${d.descricao}`
    ).join('\n');

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const resultados = [];

    // Processar cada transação
    for (const transacao of transacoes) {
      console.log(`Classificando: ${transacao.descricao}`);

      const systemPrompt = `Você é um especialista em classificação contábil e financeira.
Sua tarefa é analisar transações financeiras e classificá-las na conta contábil e departamento corretos.

Contas contábeis disponíveis:
${contasInfo}

Departamentos disponíveis:
${departamentosInfo}

Considere:
- A natureza da transação (receita ou despesa)
- Palavras-chave na descrição
- O valor e contexto da transação
- A área de negócio relacionada`;

      const userPrompt = `Classifique esta transação:
- Data: ${transacao.data}
- Descrição: ${transacao.descricao}
- Valor: R$ ${transacao.valor}
- Tipo: ${transacao.tipo || 'não especificado'}

Em qual conta contábil e departamento esta transação se encaixa melhor?`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "classificar_transacao",
                  description: "Classifica a transação na conta contábil e departamento adequados",
                  parameters: {
                    type: "object",
                    properties: {
                      codigo_conta: {
                        type: "string",
                        description: "Código da conta contábil escolhida"
                      },
                      departamento: {
                        type: "string",
                        description: "Nome do departamento escolhido",
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
                    required: ["codigo_conta", "departamento", "confianca", "justificativa"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "classificar_transacao" } }
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error("Erro na API Lovable AI:", aiResponse.status, errorText);
          
          if (aiResponse.status === 429) {
            resultados.push({
              transacao,
              erro: "Limite de requisições excedido"
            });
            continue;
          }
          
          if (aiResponse.status === 402) {
            resultados.push({
              transacao,
              erro: "Créditos insuficientes"
            });
            continue;
          }
          
          throw new Error(`Erro na API: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        
        if (!toolCall || !toolCall.function?.arguments) {
          throw new Error("Resposta da IA inválida");
        }

        const classificacao = JSON.parse(toolCall.function.arguments);
        
        // Encontrar IDs da conta e departamento
        const contaSelecionada = contas.find(c => c.code === classificacao.codigo_conta);
        const departamentoSelecionado = departamentos.find(d => d.nome === classificacao.departamento);

        if (!contaSelecionada || !departamentoSelecionado) {
          throw new Error("Conta ou departamento retornado pela IA não encontrado");
        }

        // Determinar tipo da transação
        let tipo = transacao.tipo?.toLowerCase();
        if (!tipo || (tipo !== 'receita' && tipo !== 'despesa')) {
          tipo = contaSelecionada.account_type === 'revenue' ? 'receita' : 'despesa';
        }

        // Inserir transação no banco
        const { data: transacaoInserida, error: insertError } = await supabase
          .from('transacoes_financeiras')
          .insert({
            origem: 'n8n',
            origem_id: transacao.id || `n8n_${Date.now()}_${Math.random()}`,
            data_transacao: transacao.data,
            descricao: transacao.descricao,
            valor: parseFloat(transacao.valor.toString().replace(/[^\d.-]/g, '')),
            tipo,
            conta_id: contaSelecionada.id,
            departamento_id: departamentoSelecionado.id,
            classificado_automaticamente: true,
            confianca_classificacao: classificacao.confianca,
            dados_originais: transacao,
            observacoes: classificacao.justificativa
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        resultados.push({
          transacao,
          classificacao: {
            conta: contaSelecionada.name,
            departamento: departamentoSelecionado.nome,
            confianca: classificacao.confianca,
            justificativa: classificacao.justificativa
          },
          transacao_id: transacaoInserida.id,
          sucesso: true
        });

        console.log(`✓ Classificada: ${transacao.descricao} → ${departamentoSelecionado.nome}`);

      } catch (error: any) {
        console.error(`Erro ao classificar transação:`, error);
        resultados.push({
          transacao,
          erro: error.message,
          sucesso: false
        });
      }

      // Delay para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Refresh da view materializada
    await supabase.rpc('refresh_analise_departamentos');

    const sucessos = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    return new Response(
      JSON.stringify({
        success: true,
        total: transacoes.length,
        sucessos,
        falhas,
        resultados
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erro no processamento:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro ao processar transações",
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
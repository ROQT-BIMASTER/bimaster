import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


const requestSchema = z.object({
  auditId: z.string().uuid({ message: 'auditId deve ser um UUID válido' })
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    // Validar entrada
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      console.error('❌ Erro de validação:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Dados inválidos', details: validation.error.issues }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    const { auditId } = validation.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar dados da auditoria
    const { data: audit, error: auditError } = await supabase
      .from('gondola_audits')
      .select(`
        *,
        products (name, sku, price_reference),
        stores (name, code)
      `)
      .eq('id', auditId)
      .single();

    if (auditError) throw auditError;

    // Preparar dados para análise
    const analysisPrompt = `
Analise os dados de auditoria competitiva de gôndola abaixo e forneça insights estratégicos:

**Nosso Produto:**
- Nome: ${audit.products?.name}
- EAN: ${audit.produto_ean || 'Não informado'}
- Descrição: ${audit.produto_descricao || 'Não informada'}
- Preço Praticado: R$ ${audit.preco_praticado?.toFixed(2) || 'N/A'}
- Preço de Referência: R$ ${audit.products?.price_reference?.toFixed(2) || 'N/A'}
- Estoque Loja: ${audit.estoque_loja || 'Não informado'}
- Quantidade de Frentes: ${audit.quantidade_frentes}
- Conforme Planograma: ${audit.conforme_planograma ? 'Sim' : 'Não'}

**Concorrentes Presentes:**
${audit.concorrentes_detalhes?.map((c: any, i: number) => `
${i + 1}. ${c.nome}
   - Produto: ${c.produto_nome || 'Não informado'}
   - Preço: R$ ${c.preco_praticado?.toFixed(2) || 'N/A'}
   - Frentes: ${c.quantidade_frentes}
`).join('\n') || 'Nenhum concorrente'}

**Loja:** ${audit.stores?.name} (${audit.stores?.code})

Forneça uma análise estruturada com:
1. Competitividade de Preço (classificação: "excelente", "boa", "regular", "ruim")
2. Participação de Gôndola (share of shelf) em %
3. Pontos Fortes
4. Pontos Fracos
5. Recomendações de Ação Imediata
6. Score Competitivo (0-100)
    `;

    // Chamar Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise competitiva de trade marketing e gôndola de varejo. Forneça análises objetivas e recomendações práticas.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'competitive_analysis',
            description: 'Estrutura de análise competitiva de gôndola',
            parameters: {
              type: 'object',
              properties: {
                price_competitiveness: {
                  type: 'string',
                  enum: ['excelente', 'boa', 'regular', 'ruim'],
                  description: 'Classificação da competitividade de preço'
                },
                shelf_share_percentage: {
                  type: 'number',
                  description: 'Percentual de participação de gôndola'
                },
                competitive_score: {
                  type: 'number',
                  description: 'Score competitivo de 0 a 100'
                },
                strengths: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Pontos fortes identificados'
                },
                weaknesses: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Pontos fracos identificados'
                },
                immediate_actions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Ações recomendadas imediatas'
                },
                shelf_share_impact: {
                  type: 'string',
                  enum: ['alto', 'medio', 'baixo'],
                  description: 'Impacto da participação de gôndola'
                }
              },
              required: ['price_competitiveness', 'shelf_share_percentage', 'competitive_score', 'strengths', 'weaknesses', 'immediate_actions', 'shelf_share_impact']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'competitive_analysis' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na API Lovable:', errorText);
      throw new Error(`Erro na análise IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error('Resposta IA inválida');
    }

    const analysisData = JSON.parse(toolCall.function.arguments);

    // Salvar análise no banco
    const { error: insertError } = await supabase
      .from('gondola_competitive_analysis')
      .insert({
        audit_id: auditId,
        analysis_data: analysisData,
        recommendations: analysisData.immediate_actions,
        competitive_score: analysisData.competitive_score,
        price_competitiveness: analysisData.price_competitiveness,
        shelf_share_impact: analysisData.shelf_share_impact,
        created_by: audit.created_by
      });

    if (insertError) {
      console.error('Erro ao salvar análise:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, analysis: analysisData }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro em analyze-gondola-competition:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
      }
    );
  }
});

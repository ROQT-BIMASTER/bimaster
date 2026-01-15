import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  generateAudio?: boolean;
  action?: string;
}

const LEGISLACAO_CONTEXT = `
## CONHECIMENTO EM LEGISLAÇÃO E BOAS PRÁTICAS:

### Lei de Pagamentos (Lei 14.133/2021 - Nova Lei de Licitações)
- Prazo máximo para pagamento em contratos: 30 dias após o adimplemento
- Multas por atraso podem ser aplicadas conforme contrato
- Juros de mora: 1% ao mês após vencimento

### Código Civil Brasileiro
- Art. 389: Mora do devedor gera responsabilidade por juros, correção e honorários
- Art. 395: Responde o devedor pelos prejuízos a que sua mora der causa
- Art. 397: O inadimplemento ocorre no dia imediatamente seguinte ao vencimento

### Práticas de Gestão Financeira
- Técnica ABC: Classificar fornecedores por volume de compras
- Cash Flow Management: Priorizar pagamentos por impacto operacional
- Negociação de prazos: Média de mercado 30-60-90 dias
- Early Payment Discount: Desconto típico de 2-3% para pagamento antecipado

### Indicadores de Performance (KPIs)
- DSO (Days Sales Outstanding): Ideal < 45 dias
- DPO (Days Payable Outstanding): Balancear com fluxo de caixa
- Working Capital Ratio: Ideal entre 1.5 e 2.0
- Aging de contas: Monitorar % acima de 30, 60, 90 dias

### Recomendações Técnicas
- Provisionar 2-3% do faturamento para contingências
- Manter relacionamento com top 20% dos fornecedores (Pareto)
- Automatizar pagamentos recorrentes
- Renegociar contratos com fornecedores inadimplentes frequentes
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history = [], generateAudio = false, action = 'chat' }: ChatRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar contexto financeiro
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const dataHoje = hoje.toISOString().split('T')[0];

    // Buscar resumo das contas a pagar
    const { data: contasResumo, error: contasError } = await supabase
      .from('contas_pagar')
      .select('*')
      .gte('data_vencimento', `${anoAtual}-01-01`)
      .lte('data_vencimento', `${anoAtual}-12-31`)
      .limit(1000);

    if (contasError) {
      console.error("Erro ao buscar contas:", contasError);
    }

    const contas = contasResumo || [];

    // Calcular métricas
    const totalContas = contas.length;
    const totalValor = contas.reduce((sum, c) => sum + (c.valor_original || 0), 0);
    const totalAberto = contas.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalPago = contas.filter(c => c.status === 'pago').reduce((sum, c) => sum + (c.valor_pago || 0), 0);
    
    const vencidas = contas.filter(c => {
      const venc = c.data_vencimento?.substring(0, 10);
      return venc && venc < dataHoje && c.status !== 'pago';
    });
    const totalVencido = vencidas.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    
    const vencendoHoje = contas.filter(c => {
      const venc = c.data_vencimento?.substring(0, 10);
      return venc === dataHoje && c.status !== 'pago';
    });
    const totalVencendoHoje = vencendoHoje.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);

    const vencendoProximos7Dias = contas.filter(c => {
      const venc = c.data_vencimento?.substring(0, 10);
      if (!venc || c.status === 'pago') return false;
      const dataVenc = new Date(venc);
      const diff = (dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
      return diff > 0 && diff <= 7;
    });
    const totalProximos7Dias = vencendoProximos7Dias.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);

    // Análise por categoria/departamento
    interface CategoriaAnalise { valor: number; qtd: number; }
    const porCategoria: Record<string, CategoriaAnalise> = contas.reduce((acc, c) => {
      const key = c.categoria_nome || 'Não classificado';
      if (!acc[key]) acc[key] = { valor: 0, qtd: 0 };
      acc[key].valor += c.valor_aberto || 0;
      acc[key].qtd += 1;
      return acc;
    }, {} as Record<string, CategoriaAnalise>);

    const topCategorias = Object.entries(porCategoria)
      .sort((a, b) => (b[1] as CategoriaAnalise).valor - (a[1] as CategoriaAnalise).valor)
      .slice(0, 5)
      .map(([nome, dados]) => {
        const d = dados as CategoriaAnalise;
        return `${nome}: R$ ${d.valor.toLocaleString('pt-BR')} (${d.qtd} títulos)`;
      });

    // Top fornecedores com contas vencidas
    interface FornecedorVencido { valor: number; qtd: number; diasMaxAtraso: number; }
    const fornecedoresVencidos: Record<string, FornecedorVencido> = vencidas.reduce((acc, c) => {
      const key = c.fornecedor_nome || 'Não identificado';
      const diasAtraso = Math.floor((hoje.getTime() - new Date(c.data_vencimento).getTime()) / (1000 * 60 * 60 * 24));
      if (!acc[key]) acc[key] = { valor: 0, qtd: 0, diasMaxAtraso: 0 };
      acc[key].valor += c.valor_aberto || 0;
      acc[key].qtd += 1;
      acc[key].diasMaxAtraso = Math.max(acc[key].diasMaxAtraso, diasAtraso);
      return acc;
    }, {} as Record<string, FornecedorVencido>);

    const topFornecedoresVencidos = Object.entries(fornecedoresVencidos)
      .sort((a, b) => (b[1] as FornecedorVencido).valor - (a[1] as FornecedorVencido).valor)
      .slice(0, 5)
      .map(([nome, dados]) => {
        const d = dados as FornecedorVencido;
        return `${nome}: R$ ${d.valor.toLocaleString('pt-BR')} (${d.qtd} títulos, até ${d.diasMaxAtraso} dias de atraso)`;
      });

    // Calcular aging
    const aging = {
      ate30: vencidas.filter(c => {
        const dias = Math.floor((hoje.getTime() - new Date(c.data_vencimento).getTime()) / (1000 * 60 * 60 * 24));
        return dias <= 30;
      }).reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      de31a60: vencidas.filter(c => {
        const dias = Math.floor((hoje.getTime() - new Date(c.data_vencimento).getTime()) / (1000 * 60 * 60 * 24));
        return dias > 30 && dias <= 60;
      }).reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      de61a90: vencidas.filter(c => {
        const dias = Math.floor((hoje.getTime() - new Date(c.data_vencimento).getTime()) / (1000 * 60 * 60 * 24));
        return dias > 60 && dias <= 90;
      }).reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      acima90: vencidas.filter(c => {
        const dias = Math.floor((hoje.getTime() - new Date(c.data_vencimento).getTime()) / (1000 * 60 * 60 * 24));
        return dias > 90;
      }).reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
    };

    // Contexto do sistema com legislação e técnicas
    const systemPrompt = `Você é Sofia, uma assistente financeira especializada em contas a pagar com profundo conhecimento em legislação brasileira e técnicas de gestão financeira. Você fala português brasileiro de forma natural e amigável.

${LEGISLACAO_CONTEXT}

## CONTEXTO ATUAL DOS DADOS (${new Date().toLocaleDateString('pt-BR')}):

### Resumo Geral (${anoAtual}):
- Total de títulos: ${totalContas}
- Valor total original: R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Valor em aberto: R$ ${totalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Valor já pago: R$ ${totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

### Situação de Vencimentos:
- Títulos vencidos: ${vencidas.length} (R$ ${totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
- Vencendo HOJE: ${vencendoHoje.length} títulos (R$ ${totalVencendoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
- Vencendo nos próximos 7 dias: ${vencendoProximos7Dias.length} títulos (R$ ${totalProximos7Dias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})

### Aging de Vencidos:
- Até 30 dias: R$ ${aging.ate30.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- 31 a 60 dias: R$ ${aging.de31a60.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- 61 a 90 dias: R$ ${aging.de61a90.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Acima de 90 dias: R$ ${aging.acima90.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

### Top 5 Categorias por Valor:
${topCategorias.length > 0 ? topCategorias.join('\n') : 'Nenhuma categoria identificada.'}

### Top 5 Fornecedores com Contas Vencidas:
${topFornecedoresVencidos.length > 0 ? topFornecedoresVencidos.join('\n') : 'Nenhum fornecedor com contas vencidas.'}

## INSTRUÇÕES DE COMPORTAMENTO:
- Responda de forma clara, objetiva e amigável
- Use os dados acima para responder perguntas sobre a situação financeira
- Quando falar valores, use formato brasileiro (R$ X.XXX,XX)
- Dê sugestões proativas quando identificar riscos ou oportunidades
- Seja conversacional e natural, como se estivesse em uma ligação telefônica
- Mantenha respostas concisas, ideais para serem ouvidas (máximo 4-5 frases por resposta)
- NÃO use marcadores, listas ou formatação markdown. Use texto corrido natural.
- Quando solicitado conselhos ou recomendações, cite a legislação ou técnica aplicável
- Quando solicitado relatório, forneça um resumo executivo em texto corrido

## TIPO DE SOLICITAÇÃO ATUAL: ${action === 'generate_report' ? 'GERAR RELATÓRIO' : action === 'advice' ? 'FORNECER CONSELHOS ESPECIALIZADOS' : 'CONVERSA NORMAL'}

${action === 'advice' ? 'O usuário quer conselhos baseados em legislação e técnicas de gestão. Cite artigos de lei, práticas de mercado e KPIs relevantes.' : ''}
${action === 'generate_report' ? 'O usuário quer um relatório. Forneça um resumo executivo completo com os principais dados, riscos e recomendações.' : ''}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10),
      { role: "user", content: message }
    ];

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: action === 'generate_report' ? 1500 : 600,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro Lovable AI:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Muitas solicitações. Aguarde um momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Créditos de IA esgotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro ao chamar IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";

    // Gerar áudio se solicitado
    let audioBase64: string | null = null;
    if (generateAudio) {
      const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
      if (ELEVENLABS_API_KEY) {
        try {
          // Limitar texto para TTS (máximo ~1000 caracteres para performance)
          const textForTTS = assistantMessage.length > 1000 
            ? assistantMessage.substring(0, 1000) + "... Para mais detalhes, veja o texto completo na tela."
            : assistantMessage;

          const ttsResponse = await fetch(
            "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128",
            {
              method: "POST",
              headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: textForTTS,
                model_id: "eleven_multilingual_v2",
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75,
                  style: 0.3,
                  use_speaker_boost: true,
                  speed: 1.05,
                },
              }),
            }
          );

          if (ttsResponse.ok) {
            const audioBuffer = await ttsResponse.arrayBuffer();
            const bytes = new Uint8Array(audioBuffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            audioBase64 = btoa(binary);
          } else {
            console.error("Erro ElevenLabs TTS:", ttsResponse.status, await ttsResponse.text());
          }
        } catch (ttsError) {
          console.error("Erro ao gerar áudio:", ttsError);
        }
      } else {
        console.log("ELEVENLABS_API_KEY não configurada, pulando TTS");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: assistantMessage,
        audioBase64,
        type: action,
        context: {
          totalVencido,
          totalVencendoHoje,
          qtdVencidas: vencidas.length,
          qtdVencendoHoje: vencendoHoje.length,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro no chat:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

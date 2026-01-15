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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history = [], generateAudio = false }: ChatRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar contexto financeiro
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
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

    // Top 5 fornecedores com mais contas vencidas
    interface FornecedorVencido { valor: number; qtd: number; }
    const fornecedoresVencidos: Record<string, FornecedorVencido> = vencidas.reduce((acc, c) => {
      const key = c.fornecedor_nome || 'Não identificado';
      if (!acc[key]) acc[key] = { valor: 0, qtd: 0 };
      acc[key].valor += c.valor_aberto || 0;
      acc[key].qtd += 1;
      return acc;
    }, {} as Record<string, FornecedorVencido>);

    const topFornecedoresVencidos = Object.entries(fornecedoresVencidos)
      .sort((a, b) => (b[1] as FornecedorVencido).valor - (a[1] as FornecedorVencido).valor)
      .slice(0, 5)
      .map(([nome, dados]) => {
        const d = dados as FornecedorVencido;
        return `${nome}: R$ ${d.valor.toLocaleString('pt-BR')} (${d.qtd} títulos)`;
      });

    // Contexto do sistema
    const systemPrompt = `Você é uma assistente financeira especializada em contas a pagar. Seu nome é Sofia e você fala português brasileiro.
Você tem acesso aos dados em tempo real do sistema de contas a pagar da empresa.

## CONTEXTO ATUAL (${new Date().toLocaleDateString('pt-BR')}):

### Resumo Geral (${anoAtual}):
- Total de títulos: ${totalContas}
- Valor total original: R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Valor em aberto: R$ ${totalAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Valor já pago: R$ ${totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

### Situação de Vencimentos:
- Títulos vencidos: ${vencidas.length} (R$ ${totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
- Vencendo HOJE: ${vencendoHoje.length} títulos (R$ ${totalVencendoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
- Vencendo nos próximos 7 dias: ${vencendoProximos7Dias.length} títulos (R$ ${totalProximos7Dias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})

### Top 5 Fornecedores com Contas Vencidas:
${topFornecedoresVencidos.length > 0 ? topFornecedoresVencidos.join('\n') : 'Nenhum fornecedor com contas vencidas.'}

## INSTRUÇÕES:
- Responda de forma clara, objetiva e amigável
- Use os dados acima para responder perguntas sobre a situação financeira
- Quando falar valores, use formato brasileiro (R$ X.XXX,XX)
- Dê sugestões proativas quando identificar riscos ou oportunidades
- Seja conversacional e natural, como se estivesse em uma ligação telefônica
- Mantenha respostas concisas, ideais para serem ouvidas (máximo 3-4 frases por resposta)
- Não use marcadores ou listas em suas respostas, prefira texto corrido`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10), // Manter últimas 10 mensagens
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
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro Lovable AI:", aiResponse.status, errorText);
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
          const ttsResponse = await fetch(
            "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128",
            {
              method: "POST",
              headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                text: assistantMessage,
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
            // Converter para base64 usando Deno's std library
            const bytes = new Uint8Array(audioBuffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            audioBase64 = btoa(binary);
          } else {
            console.error("Erro ElevenLabs TTS:", ttsResponse.status);
          }
        } catch (ttsError) {
          console.error("Erro ao gerar áudio:", ttsError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: assistantMessage,
        audioBase64,
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

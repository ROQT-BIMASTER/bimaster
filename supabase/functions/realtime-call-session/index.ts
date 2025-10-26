import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada');
    }

    // Autenticar usuário
    const authHeader = req.headers.get('authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { prospectId } = await req.json();

    if (!prospectId) {
      throw new Error('prospectId é obrigatório');
    }

    console.log('Criando sessão para prospect:', prospectId);

    // Buscar dados do prospect
    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .select('nome, empresa, categoria, observacoes, status')
      .eq('id', prospectId)
      .single();

    if (prospectError) {
      throw new Error('Erro ao buscar prospect: ' + prospectError.message);
    }

    // Criar registro da ligação
    const { data: call, error: callError } = await supabase
      .from('ai_calls')
      .insert({
        prospect_id: prospectId,
        vendedor_id: user.id,
        call_status: 'in_progress'
      })
      .select()
      .single();

    if (callError) {
      throw new Error('Erro ao criar registro de ligação: ' + callError.message);
    }

    console.log('Registro de ligação criado:', call.id);

    // Gerar token efêmero OpenAI
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-10-01",
        voice: "alloy",
        instructions: `Você é um assistente de vendas profissional e experiente.

CONTEXTO DO PROSPECT:
- Nome: ${prospect.nome || 'Não informado'}
- Empresa: ${prospect.empresa || 'Não informada'}
- Segmento: ${prospect.categoria || 'Não informado'}
- Status atual: ${prospect.status || 'novo'}
${prospect.observacoes ? `- Observações: ${prospect.observacoes}` : ''}

SEU OBJETIVO:
1. Qualificar o interesse do prospect
2. Entender desafios e necessidades atuais
3. Propor agendamento de reunião detalhada com o vendedor

DIRETRIZES DE COMUNICAÇÃO:
- Tom consultivo, empático e profissional
- Faça perguntas abertas para entender o contexto
- Ouça atentamente e demonstre interesse genuíno
- Se receber objeções, registre-as e busque entender os motivos
- Seja natural e conversacional, como um humano faria

FLUXO SUGERIDO:
1. Apresente-se brevemente e confirme se é um bom momento
2. Pergunte sobre os principais desafios relacionados ao seu segmento
3. Identifique interesse em conhecer soluções
4. Proponha agendamento de reunião com especialista
5. Se recusar: agradeça e pergunte quando seria melhor contato

IMPORTANTE:
- Não force vendas diretas
- Foque em qualificar e agendar
- Seja educado mesmo se receber recusa
- Registre todas as informações importantes`,
        tools: [
          {
            type: "function",
            name: "schedule_meeting",
            description: "Agendar reunião com o vendedor após confirmação do prospect",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string", description: "Data da reunião no formato YYYY-MM-DD" },
                time: { type: "string", description: "Horário da reunião no formato HH:MM" },
                notes: { type: "string", description: "Observações sobre a reunião" }
              },
              required: ["date", "time"]
            }
          },
          {
            type: "function",
            name: "save_objection",
            description: "Registrar objeção ou motivo de recusa do prospect",
            parameters: {
              type: "object",
              properties: {
                objection: { type: "string", description: "Objeção ou motivo de recusa" },
                severity: { type: "string", enum: ["low", "medium", "high"], description: "Gravidade da objeção" }
              },
              required: ["objection"]
            }
          },
          {
            type: "function",
            name: "update_prospect_status",
            description: "Atualizar status do prospect baseado na conversa",
            parameters: {
              type: "object",
              properties: {
                status: { type: "string", enum: ["qualificado", "nao_qualificado", "followup_necessario"], description: "Novo status" },
                reason: { type: "string", description: "Motivo da mudança de status" }
              },
              required: ["status", "reason"]
            }
          },
          {
            type: "function",
            name: "save_note",
            description: "Salvar nota ou informação importante da conversa",
            parameters: {
              type: "object",
              properties: {
                note: { type: "string", description: "Nota ou informação importante" }
              },
              required: ["note"]
            }
          }
        ],
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000
        },
        temperature: 0.8,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1"
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro OpenAI:', response.status, errorText);
      throw new Error(`Erro ao criar sessão OpenAI: ${response.status}`);
    }

    const sessionData = await response.json();
    console.log('Sessão OpenAI criada com sucesso');

    return new Response(JSON.stringify({
      ...sessionData,
      callId: call.id,
      prospectName: prospect.nome
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

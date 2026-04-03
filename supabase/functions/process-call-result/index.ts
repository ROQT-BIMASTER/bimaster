import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
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

    const { 
      callId, 
      duration, 
      transcript, 
      actions, 
      sentiment,
      meetingScheduled,
      meetingDate 
    } = await req.json();

    if (!callId) {
      throw new Error('callId é obrigatório');
    }

    console.log('Processando resultado da ligação:', callId);

    // Atualizar registro da ligação
    const { error: updateError } = await supabase
      .from('ai_calls')
      .update({
        call_duration: duration,
        call_status: 'completed',
        transcript: transcript,
        sentiment: sentiment || 'neutral',
        meeting_scheduled: meetingScheduled || false,
        meeting_date: meetingDate || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', callId);

    if (updateError) {
      throw new Error('Erro ao atualizar ligação: ' + updateError.message);
    }

    // Salvar ações tomadas durante a ligação
    if (actions && actions.length > 0) {
      const actionsToInsert = actions.map((action: any) => ({
        call_id: callId,
        action_type: action.type,
        action_data: action.data || {}
      }));

      const { error: actionsError } = await supabase
        .from('ai_call_actions')
        .insert(actionsToInsert);

      if (actionsError) {
        console.error('Erro ao salvar ações:', actionsError);
      }
    }

    // Buscar dados da ligação para criar atividade
    const { data: call } = await supabase
      .from('ai_calls')
      .select('prospect_id, vendedor_id')
      .eq('id', callId)
      .single();

    if (call) {
      // Criar atividade no CRM
      const { error: atividadeError } = await supabase
        .from('atividades')
        .insert({
          prospect_id: call.prospect_id,
          vendedor_id: call.vendedor_id,
          tipo: 'ligacao',
          status: 'concluida',
          descricao: `Ligação IA: ${transcript?.substring(0, 200) || 'Transcrição não disponível'}...`,
          data_atividade: new Date().toISOString(),
          resultado: sentiment === 'positive' ? 'sucesso' : sentiment === 'negative' ? 'sem_sucesso' : 'pendente'
        });

      if (atividadeError) {
        console.error('Erro ao criar atividade:', atividadeError);
      }

      // Se reunião foi agendada, criar atividade de reunião
      if (meetingScheduled && meetingDate) {
        const { error: reuniaoError } = await supabase
          .from('atividades')
          .insert({
            prospect_id: call.prospect_id,
            vendedor_id: call.vendedor_id,
            tipo: 'reuniao',
            status: 'pendente',
            descricao: 'Reunião agendada pela IA - Follow-up necessário',
            data_atividade: meetingDate
          });

        if (reuniaoError) {
          console.error('Erro ao criar reunião:', reuniaoError);
        }
      }

      // Atualizar observações do prospect com insights da ligação
      if (actions && actions.length > 0) {
        const notes = actions
          .filter((a: any) => a.type === 'note_saved')
          .map((a: any) => a.data.note)
          .join('; ');

        if (notes) {
          const { error: prospectError } = await supabase
            .from('prospects')
            .update({
              observacoes: notes
            })
            .eq('id', call.prospect_id);

          if (prospectError) {
            console.error('Erro ao atualizar prospect:', prospectError);
          }
        }
      }
    }

    console.log('Resultado da ligação processado com sucesso');

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Resultado processado com sucesso' 
    }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Autenticação necessária');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se é admin ou supervisor
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || !['admin', 'supervisor'].includes(userRole.role)) {
      throw new Error('Acesso negado - apenas administradores e supervisores');
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const tabelaId = pathParts[pathParts.length - 2]; // ID antes de /approve ou /reject
    const action = pathParts[pathParts.length - 1]; // approve ou reject

    if (!tabelaId || !['approve', 'reject'].includes(action)) {
      throw new Error('Ação inválida');
    }

    const body = await req.json().catch(() => ({}));
    const message = body.message || '';

    // Buscar tabela
    const { data: tabela, error: tabelaError } = await supabase
      .from('fabrica_tabelas_preco')
      .select('*, created_by')
      .eq('id', tabelaId)
      .single();

    if (tabelaError || !tabela) {
      throw new Error('Tabela não encontrada');
    }

    if (tabela.status !== 'pending_approval') {
      throw new Error('Tabela não está pendente de aprovação');
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Atualizar status
    const { error: updateError } = await supabase
      .from('fabrica_tabelas_preco')
      .update({ status: newStatus })
      .eq('id', tabelaId);

    if (updateError) {
      throw updateError;
    }

    // Registrar na auditoria
    await supabase
      .from('fabrica_tabelas_preco_auditoria')
      .insert({
        tabela_id: tabelaId,
        user_id: user.id,
        acao: action,
        mensagem: message || `Tabela ${action === 'approve' ? 'aprovada' : 'rejeitada'} por ${user.email}`,
      });

    // Se aprovado, criar notificação para o criador
    if (action === 'approve' && tabela.created_by) {
      await supabase
        .from('notifications')
        .insert({
          user_id: tabela.created_by,
          title: 'Tabela de Preço Aprovada',
          message: `Sua tabela "${tabela.nome}" foi aprovada!`,
          type: 'success',
        });
    }

    // Se rejeitado, criar notificação com mensagem
    if (action === 'reject' && tabela.created_by) {
      await supabase
        .from('notifications')
        .insert({
          user_id: tabela.created_by,
          title: 'Tabela de Preço Rejeitada',
          message: `Sua tabela "${tabela.nome}" foi rejeitada. ${message ? 'Motivo: ' + message : ''}`,
          type: 'error',
        });
    }

    console.log(`Tabela ${tabelaId} ${action}d por ${user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        message: `Tabela ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso`,
      }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro na aprovação:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});

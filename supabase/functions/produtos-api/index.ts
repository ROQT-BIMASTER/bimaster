import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const produtoId = pathParts[pathParts.length - 1];

    // GET /api/produtos - Listar todos produtos
    if (req.method === 'GET' && !produtoId) {
      const tipo = url.searchParams.get('tipo');
      
      let query = supabase
        .from('fabrica_produtos')
        .select(`
          *,
          formula:formula_id(id, versao),
          unidade:unidade_medida_id(sigla, nome)
        `)
        .order('nome');

      if (tipo) {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query;

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api/produtos/:id - Buscar produto específico
    if (req.method === 'GET' && produtoId) {
      const { data, error } = await supabase
        .from('fabrica_produtos')
        .select(`
          *,
          formula:formula_id(id, versao),
          unidade:unidade_medida_id(sigla, nome)
        `)
        .eq('id', produtoId)
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /api/produtos - Criar novo produto
    if (req.method === 'POST') {
      const body = await req.json();

      // Validações básicas
      if (!body.codigo || !body.nome) {
        throw new Error('Código e nome são obrigatórios');
      }

      if (body.tipo === 'ACABADO' && !body.formula_id) {
        throw new Error('Produto acabado deve ter uma fórmula vinculada');
      }

      const payload = {
        codigo: body.codigo.trim().toUpperCase(),
        nome: body.nome.trim(),
        descricao: body.descricao?.trim() || null,
        tipo: body.tipo || 'ACABADO',
        formula_id: body.formula_id || null,
        unidade_medida_id: body.unidade_medida_id || null,
        tempo_producao_minutos: body.tempo_producao_minutos || null,
        rendimento: body.rendimento || null,
        foto_url: body.foto_url?.trim() || null,
        ativo: body.ativo ?? true,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('fabrica_produtos')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      console.log(`Produto ${data.codigo} criado por ${user.email}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          data,
          message: 'Produto criado com sucesso' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /api/produtos/:id - Atualizar produto
    if (req.method === 'PUT' && produtoId) {
      const body = await req.json();

      const payload = {
        codigo: body.codigo?.trim().toUpperCase(),
        nome: body.nome?.trim(),
        descricao: body.descricao?.trim() || null,
        tipo: body.tipo,
        formula_id: body.formula_id || null,
        unidade_medida_id: body.unidade_medida_id || null,
        tempo_producao_minutos: body.tempo_producao_minutos || null,
        rendimento: body.rendimento || null,
        foto_url: body.foto_url?.trim() || null,
        ativo: body.ativo,
        updated_at: new Date().toISOString(),
      };

      // Remover campos undefined
      Object.keys(payload).forEach(key => {
        if (payload[key as keyof typeof payload] === undefined) {
          delete payload[key as keyof typeof payload];
        }
      });

      const { data, error } = await supabase
        .from('fabrica_produtos')
        .update(payload)
        .eq('id', produtoId)
        .select()
        .single();

      if (error) throw error;

      console.log(`Produto ${produtoId} atualizado por ${user.email}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          data,
          message: 'Produto atualizado com sucesso' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /api/produtos/:id - Deletar produto
    if (req.method === 'DELETE' && produtoId) {
      // Verificar se é admin
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!userRole || !['admin', 'supervisor'].includes(userRole.role)) {
        throw new Error('Acesso negado - apenas administradores');
      }

      const { error } = await supabase
        .from('fabrica_produtos')
        .delete()
        .eq('id', produtoId);

      if (error) throw error;

      console.log(`Produto ${produtoId} deletado por ${user.email}`);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Produto deletado com sucesso' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Método não suportado');

  } catch (error) {
    console.error('Erro na API de produtos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

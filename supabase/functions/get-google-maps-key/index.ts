import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GOOGLE_MAPS_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔑 get-google-maps-key: Iniciando');

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('❌ Authorization header ausente');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('❌ Token inválido:', userError?.message);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('✅ Usuário autenticado:', user.id);

    // SECURITY: Use service role to check profile + role (bypass RLS for admin check)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('aprovado')
      .eq('id', user.id)
      .single();

    if (!profile?.aprovado) {
      return new Response(
        JSON.stringify({ error: 'User not approved' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // SECURITY: Restrict to users with trade or commercial module access
    const { data: moduleAccess } = await supabaseAdmin
      .from('usuario_permissoes_modulos')
      .select('modulo_id, modulos_sistema!inner(codigo)')
      .eq('usuario_id', user.id);

    const { data: userRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = userRole?.role === 'admin';
    const allowedModules = ['trade_marketing', 'comercial', 'fabrica'];
    const hasModuleAccess = moduleAccess?.some((m: any) => 
      allowedModules.includes(m.modulos_sistema?.codigo)
    );

    if (!isAdmin && !hasModuleAccess) {
      console.warn('⚠️ Usuário sem permissão para acessar Google Maps key:', user.id);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if (!GOOGLE_MAPS_KEY) {
      console.error('❌ GOOGLE_PLACES_API_KEY não configurado');
      return new Response(
        JSON.stringify({ error: 'Google Maps key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Google Maps key retornada');
    return new Response(
      JSON.stringify({ key: GOOGLE_MAPS_KEY }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro na função:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

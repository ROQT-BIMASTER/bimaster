import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔑 get-mapbox-token: Função invocada');
    
    // Validate JWT token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('❌ Token de autorização não fornecido');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ Token inválido:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('✅ Usuário autenticado:', user.id);

    // Check if user is approved
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('aprovado')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.aprovado) {
      console.error('❌ Usuário não aprovado');
      return new Response(
        JSON.stringify({ error: 'User not approved' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if (!MAPBOX_TOKEN) {
      console.error('❌ MAPBOX_ACCESS_TOKEN não configurado no ambiente');
      return new Response(
        JSON.stringify({ error: 'Mapbox token not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('✅ Token Mapbox retornado para usuário aprovado:', user.id);
    return new Response(
      JSON.stringify({ token: MAPBOX_TOKEN }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Erro na função get-mapbox-token:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

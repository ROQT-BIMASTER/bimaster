import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🔍 [geocode] Requisição recebida');
  
  if (req.method === 'OPTIONS') {
    console.log('🔍 [geocode] OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 [geocode] Processando requisição POST');
    const { address } = await req.json();
    console.log('🔍 [geocode] Endereço recebido:', address);

    if (!address) {
      console.log('❌ [geocode] Endereço não fornecido');
      throw new Error('Address is required');
    }

    if (!MAPBOX_TOKEN) {
      console.log('❌ [geocode] Token Mapbox não configurado');
      throw new Error('Mapbox token not configured');
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=BR`;
    
    console.log('🔍 [geocode] Chamando API Mapbox...');
    const response = await fetch(url);
    console.log('🔍 [geocode] Status da resposta Mapbox:', response.status);
    
    const data = await response.json();
    console.log('🔍 [geocode] Dados recebidos:', JSON.stringify(data).substring(0, 200));

    if (!data.features || data.features.length === 0) {
      console.log('❌ [geocode] Endereço não encontrado no Mapbox');
      return new Response(
        JSON.stringify({ error: 'Address not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const feature = data.features[0];
    const [longitude, latitude] = feature.center;
    
    console.log('✅ [geocode] Coordenadas encontradas:', { latitude, longitude });

    return new Response(
      JSON.stringify({
        latitude,
        longitude,
        formatted_address: feature.place_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ [geocode] Erro:', error);
    console.error('❌ [geocode] Stack:', error instanceof Error ? error.stack : 'No stack');
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

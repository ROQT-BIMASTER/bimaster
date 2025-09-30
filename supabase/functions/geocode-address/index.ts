import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();

    if (!address) {
      throw new Error('Address is required');
    }

    if (!MAPBOX_TOKEN) {
      throw new Error('Mapbox token not configured');
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=BR`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Address not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const feature = data.features[0];
    const [longitude, latitude] = feature.center;

    return new Response(
      JSON.stringify({
        latitude,
        longitude,
        formatted_address: feature.place_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { validateJWT } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { handleError } from "../_shared/error-handler.ts";

const GeocodeSchema = z.object({
  address: z.string().min(1).max(500),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await validateJWT(req);
    await checkRateLimit({ prefix: "geocode", limit: 100, req, userId: auth.userId });

    const body = await req.json();
    const { address } = validateBody(body, GeocodeSchema);

    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    if (!MAPBOX_TOKEN) throw new Error('Mapbox token not configured');

    const validPrefixes = ['pk.', 'sk.', 'pk_', 'sk_'];
    if (!validPrefixes.some(prefix => MAPBOX_TOKEN.startsWith(prefix))) {
      throw new Error('Invalid Mapbox token format');
    }

    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=BR`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Address not found' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const feature = data.features[0];
    const [longitude, latitude] = feature.center;

    return new Response(
      JSON.stringify({ latitude, longitude, formatted_address: feature.place_name }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return handleError(error, getCorsHeaders(req));
  }
});

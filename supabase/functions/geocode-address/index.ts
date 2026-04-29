import { secureHandler } from "../_shared/secure-handler.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const GeocodeSchema = z
  .object({
    address: z.string().min(1).max(500),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 100, rateLimitPrefix: "geocode" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const headers = { ...cors, "Content-Type": "application/json" };

      const body = await req.json().catch(() => ({}));
      const { address } = validateBody(body, GeocodeSchema);

      const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
      if (!MAPBOX_TOKEN) throw new Error("Mapbox token not configured");

      const validPrefixes = ["pk.", "sk.", "pk_", "sk_"];
      if (!validPrefixes.some((prefix) => MAPBOX_TOKEN.startsWith(prefix))) {
        throw new Error("Invalid Mapbox token format");
      }

      const encodedAddress = encodeURIComponent(address);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}&limit=1&country=BR`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return new Response(JSON.stringify({ error: "Address not found" }), {
          headers,
          status: 404,
        });
      }

      const feature = data.features[0];
      const [longitude, latitude] = feature.center;

      return new Response(
        JSON.stringify({ latitude, longitude, formatted_address: feature.place_name }),
        { headers }
      );
    }
  )
);

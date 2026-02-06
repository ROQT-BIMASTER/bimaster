import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

// Apenas campos Basic (gratuitos) - NÃO incluir campos Pro/Enterprise
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.location",
  "places.addressComponents",
].join(",");

interface PlaceResult {
  id: string;
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  location?: { latitude: number; longitude: number };
  addressComponents?: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }>;
}

function extractAddressField(
  components: PlaceResult["addressComponents"],
  type: string
): string | null {
  if (!components) return null;
  const comp = components.find((c) => c.types.includes(type));
  return comp ? comp.longText : null;
}

function extractShortAddressField(
  components: PlaceResult["addressComponents"],
  type: string
): string | null {
  if (!components) return null;
  const comp = components.find((c) => c.types.includes(type));
  return comp ? comp.shortText : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      console.error("GOOGLE_PLACES_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Google Places API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { query, cidade, uf, maxResults = 20 } = body;

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build search query with location context
    let textQuery = query;
    if (cidade && uf) {
      textQuery = `${query} em ${cidade}, ${uf}`;
    } else if (cidade) {
      textQuery = `${query} em ${cidade}`;
    } else if (uf) {
      textQuery = `${query} em ${uf}`;
    }

    console.log(`🔍 Searching: "${textQuery}" | max: ${maxResults} | user: ${user.id}`);

    const allPlaces: PlaceResult[] = [];
    let pageToken: string | null = null;
    let pageCount = 0;
    const maxPages = Math.ceil(Math.min(maxResults, 200) / 20);

    // Paginate through results
    do {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}/${maxPages}...`);

      const requestBody: Record<string, unknown> = {
        textQuery,
        regionCode: "BR",
        languageCode: "pt-BR",
        maxResultCount: 20,
      };

      if (pageToken) {
        requestBody.pageToken = pageToken;
      }

      const response = await fetch(GOOGLE_PLACES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Google Places API error (${response.status}):`, errorText);
        
        // If we already have some results, return them instead of failing
        if (allPlaces.length > 0) {
          console.warn(`⚠️ Stopping pagination at page ${pageCount} due to error, returning ${allPlaces.length} results`);
          break;
        }
        
        return new Response(
          JSON.stringify({ error: "Google Places API error", details: errorText }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const places = data.places || [];
      
      console.log(`  ✅ Got ${places.length} results on page ${pageCount}`);
      allPlaces.push(...places);

      pageToken = data.nextPageToken || null;

      // Small delay between pages to be respectful
      if (pageToken && allPlaces.length < maxResults) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } while (pageToken && allPlaces.length < maxResults && pageCount < maxPages);

    console.log(`📊 Total results fetched: ${allPlaces.length}`);

    // Transform and save to database
    const leadsToUpsert = allPlaces.map((place) => {
      const cidade = extractAddressField(place.addressComponents, "administrative_area_level_2");
      const uf = extractShortAddressField(place.addressComponents, "administrative_area_level_1");
      const cep = extractAddressField(place.addressComponents, "postal_code");

      return {
        google_place_id: place.id,
        nome: place.displayName?.text || "Sem nome",
        telefone: place.nationalPhoneNumber || null,
        telefone_internacional: place.internationalPhoneNumber || null,
        endereco: place.formattedAddress || null,
        cidade: cidade || null,
        uf: uf || null,
        cep: cep || null,
        latitude: place.location?.latitude || null,
        longitude: place.location?.longitude || null,
        website: place.websiteUri || null,
        rating: place.rating || null,
        total_avaliacoes: place.userRatingCount || 0,
        tipos: place.types || [],
        status: "novo",
        busca_query: query,
        busca_regiao: cidade && uf ? `${cidade}/${uf}` : (cidade || uf || null),
        minerado_por: user.id,
      };
    });

    if (leadsToUpsert.length > 0) {
      // Upsert in batches of 50
      const batchSize = 50;
      let savedCount = 0;
      let duplicateCount = 0;

      for (let i = 0; i < leadsToUpsert.length; i += batchSize) {
        const batch = leadsToUpsert.slice(i, i + batchSize);
        
        const { data: upsertData, error: upsertError } = await supabase
          .from("leads_minerados")
          .upsert(batch, {
            onConflict: "google_place_id",
            ignoreDuplicates: false,
          })
          .select("id, google_place_id");

        if (upsertError) {
          console.error(`Error upserting batch ${i / batchSize + 1}:`, upsertError.message);
        } else {
          savedCount += upsertData?.length || 0;
        }
      }

      // Count how many were new vs updated
      const { count: totalInDb } = await supabase
        .from("leads_minerados")
        .select("id", { count: "exact", head: true })
        .in("google_place_id", leadsToUpsert.map((l) => l.google_place_id));

      console.log(`💾 Saved/updated ${savedCount} leads to database`);

      return new Response(
        JSON.stringify({
          success: true,
          totalFetched: allPlaces.length,
          totalSaved: savedCount,
          totalInDb: totalInDb || savedCount,
          query: textQuery,
          pages: pageCount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalFetched: 0,
        totalSaved: 0,
        query: textQuery,
        message: "No results found",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

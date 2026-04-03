import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
const PLUGGY_CDN_URL = "https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js";


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const response = await fetch(PLUGGY_CDN_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Pluggy script: ${response.statusText}`);
    }
    const scriptContent = await response.text();

    return new Response(scriptContent, {
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error in Pluggy proxy:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paths } = await req.json();
    if (!Array.isArray(paths) || paths.length === 0) {
      return new Response(
        JSON.stringify({ error: "paths array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl = Deno.env.get("SUPABASE_URL")!;

    const results = await Promise.all(
      paths.map(async (path: string) => {
        const start = performance.now();
        try {
          const res = await fetch(`${baseUrl}/functions/v1${path}/status`, {
            method: "GET",
            signal: AbortSignal.timeout(5000),
          });
          await res.text().catch(() => {});
          const latency = Math.round(performance.now() - start);
          const online =
            res.ok ||
            res.status === 401 ||
            res.status === 403 ||
            res.status === 405;
          return { path, status: online ? "online" : "offline", latency };
        } catch {
          return { path, status: "offline", latency: 0 };
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

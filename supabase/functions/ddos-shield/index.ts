import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limits (requests per minute)
const LIMITS = {
  anonymous: 60,
  authenticated: 120,
  china_department: 240,
  block_duration_minutes: 5,
  window_seconds: 60,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, function_name } = await req.json();

    // Action: check — verify if request should be allowed
    if (action === "check") {
      const authHeader = req.headers.get("Authorization");
      let identifier: string;
      let identifierType: "user" | "ip";
      let limit = LIMITS.anonymous;

      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "");
        const supabaseUser = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );

        const { data: claimsData } = await supabaseUser.auth.getClaims(token);
        if (claimsData?.claims?.sub) {
          identifier = claimsData.claims.sub;
          identifierType = "user";
          limit = LIMITS.authenticated;

          // Check if user belongs to China department (2x limit)
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("departamento_id")
            .eq("id", identifier)
            .single();

          if (profile?.departamento_id) {
            const { data: dept } = await supabaseAdmin
              .from("departamentos")
              .select("nome")
              .eq("id", profile.departamento_id)
              .single();

            if (dept?.nome?.toLowerCase() === "china") {
              limit = LIMITS.china_department;
            }
          }
        } else {
          identifier = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
          identifierType = "ip";
        }
      } else {
        identifier = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        identifierType = "ip";
      }

      // Check if currently blocked
      const { data: blocked } = await supabaseAdmin
        .from("ddos_rate_limits")
        .select("blocked_until")
        .eq("identifier", identifier)
        .not("blocked_until", "is", null)
        .gte("blocked_until", new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (blocked) {
        const retryAfter = Math.ceil(
          (new Date(blocked.blocked_until).getTime() - Date.now()) / 1000
        );
        return new Response(
          JSON.stringify({
            allowed: false,
            retry_after: retryAfter,
            reason: "rate_limited",
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(retryAfter),
            },
          }
        );
      }

      // Get current window count
      const windowStart = new Date(
        Date.now() - LIMITS.window_seconds * 1000
      ).toISOString();

      const { data: existing } = await supabaseAdmin
        .from("ddos_rate_limits")
        .select("id, request_count")
        .eq("identifier", identifier)
        .gte("window_start", windowStart)
        .is("blocked_until", null)
        .order("window_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentCount = (existing?.request_count || 0) + 1;

      if (currentCount > limit) {
        // Block the identifier
        const blockedUntil = new Date(
          Date.now() + LIMITS.block_duration_minutes * 60 * 1000
        ).toISOString();

        await supabaseAdmin.from("ddos_rate_limits").upsert({
          id: existing?.id || undefined,
          identifier,
          identifier_type: identifierType,
          request_count: currentCount,
          window_start: existing ? undefined : new Date().toISOString(),
          blocked_until: blockedUntil,
        });

        return new Response(
          JSON.stringify({
            allowed: false,
            retry_after: LIMITS.block_duration_minutes * 60,
            reason: "rate_limited",
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(LIMITS.block_duration_minutes * 60),
            },
          }
        );
      }

      // Increment counter
      if (existing) {
        await supabaseAdmin
          .from("ddos_rate_limits")
          .update({ request_count: currentCount })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("ddos_rate_limits").insert({
          identifier,
          identifier_type: identifierType,
          request_count: 1,
          window_start: new Date().toISOString(),
        });
      }

      return new Response(
        JSON.stringify({
          allowed: true,
          remaining: limit - currentCount,
          limit,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Action: cleanup — remove expired records
    if (action === "cleanup") {
      await supabaseAdmin.rpc("cleanup_ddos_rate_limits");
      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Action: status — get current stats
    if (action === "status") {
      const { count: totalRecords } = await supabaseAdmin
        .from("ddos_rate_limits")
        .select("*", { count: "exact", head: true });

      const { count: blockedCount } = await supabaseAdmin
        .from("ddos_rate_limits")
        .select("*", { count: "exact", head: true })
        .not("blocked_until", "is", null)
        .gte("blocked_until", new Date().toISOString());

      return new Response(
        JSON.stringify({
          total_tracked: totalRecords || 0,
          currently_blocked: blockedCount || 0,
          limits: LIMITS,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: check, cleanup, status" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

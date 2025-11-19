import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const queueSecret = Deno.env.get("QUEUE_PROCESSOR_SECRET");

    if (!supabaseUrl || !supabaseAnonKey || !queueSecret) {
      console.error("❌ Missing environment configuration for trigger-photo-queue");
      return new Response(
        JSON.stringify({ error: "Function not fully configured" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    console.log("✅ trigger-photo-queue called from frontend");

    // Call the secure queue processor with the secret
    const processorUrl = `${supabaseUrl}/functions/v1/process-photo-analysis-queue`;
    const response = await fetch(processorUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
        "x-queue-secret": queueSecret,
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Queue processor error:", result);
      return new Response(
        JSON.stringify({ error: result.error || "Failed to process queue" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: response.status,
        }
      );
    }

    console.log("✅ Queue processing completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("❌ Error triggering photo queue:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

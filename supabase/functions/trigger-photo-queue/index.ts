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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader) {
      throw new Error("Unauthorized");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log(`✅ User ${user.id} triggered photo queue processing`);

    // Get the queue processor secret
    const queueSecret = Deno.env.get('QUEUE_PROCESSOR_SECRET');
    
    if (!queueSecret) {
      throw new Error('Queue processor not configured');
    }

    // Call the queue processor with the secret
    const processorUrl = `${supabaseUrl}/functions/v1/process-photo-analysis-queue`;
    const response = await fetch(processorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'x-queue-secret': queueSecret,
      },
      body: JSON.stringify({}),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Queue processor error:', result);
      throw new Error(result.error || 'Failed to process queue');
    }

    console.log('✅ Queue processing completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error triggering photo queue:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: errorMessage === "Unauthorized" ? 401 : 500
      }
    );
  }
});

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let event: Record<string, unknown>;
  try {
    event = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventType = event.event as string | undefined;
  const itemId = event.itemId as string | undefined;

  if (!eventType || !itemId) {
    return new Response(
      JSON.stringify({ error: "Missing event or itemId" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(`📩 Pluggy webhook: ${eventType} | itemId: ${itemId}`);

  // Fire-and-forget async processing
  const processAsync = async () => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (eventType) {
      case "item/created": {
        console.log(`✅ item/created for ${itemId}`);
        // Connection already saved by frontend onSuccess — just log
        break;
      }

      case "item/updated": {
        console.log(`🔄 item/updated for ${itemId}`);
        // Update bank_connections status and last_sync
        await supabase
          .from("bank_connections")
          .update({
            status: "connected",
            last_sync: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("pluggy_item_id", itemId);
        break;
      }

      case "item/error": {
        const errorData = event.error;
        console.error(`❌ item/error for ${itemId}:`, errorData);
        await supabase
          .from("bank_connections")
          .update({
            status: "error",
            updated_at: new Date().toISOString(),
          })
          .eq("pluggy_item_id", itemId);
        break;
      }

      default:
        console.log(`⚠️ Unhandled event type: ${eventType}`);
    }
  };

  // Process in background — respond immediately
  processAsync().catch((err) =>
    console.error("❌ Async processing error:", err)
  );

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

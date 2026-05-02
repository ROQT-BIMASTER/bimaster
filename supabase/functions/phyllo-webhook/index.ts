import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyPhylloSignature, logWebhookSignatureFailure } from "../_shared/webhook-hmac.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const headers = getCorsHeaders(req);
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  // ===== HMAC signature verification (fail-closed) =====
  const secret = Deno.env.get("PHYLLO_WEBHOOK_SECRET");
  if (!secret) {
    console.error("PHYLLO_WEBHOOK_SECRET not configured — refusing webhook");
    return new Response(JSON.stringify({ error: "webhook secret not configured" }), { status: 503, headers: jsonHeaders });
  }
  const rawBody = await req.text();
  const sigHeader = req.headers.get("phyllo-signature") ?? req.headers.get("x-phyllo-signature");
  const valid = await verifyPhylloSignature(rawBody, sigHeader, secret);
  if (!valid) {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await logWebhookSignatureFailure(sb, "phyllo", sigHeader ? "invalid signature" : "missing signature", req.headers.get("cf-connecting-ip"));
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401, headers: jsonHeaders });
  }

  try {
    const body = JSON.parse(rawBody);
    console.log("Phyllo webhook received:", JSON.stringify(body).substring(0, 500));

    const { event, data } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    switch (event) {
      case "ACCOUNTS.CONNECTED":
      case "ACCOUNTS.UPDATED": {
        // Update influencer data when account connects/updates
        if (data?.account_id && data?.external_id) {
          const clientId = Deno.env.get("PHYLLO_CLIENT_ID");
          const clientSecret = Deno.env.get("PHYLLO_CLIENT_SECRET");
          if (clientId && clientSecret) {
            const authToken = btoa(`${clientId}:${clientSecret}`);
            const res = await fetch(`https://api.getphyllo.com/v1/social/accounts/${data.account_id}`, {
              headers: { Authorization: `Basic ${authToken}` },
            });
            if (res.ok) {
              const profile = await res.json();
              // Try to find matching influencer by username
              const username = profile.username || profile.platform_username;
              if (username) {
                await supabase
                  .from("influencers")
                  .update({
                    avatar_url: profile.image_url || profile.profile_image_url,
                    followers_count: profile.reputation?.follower_count || profile.follower_count,
                    engagement_rate: profile.reputation?.engagement_rate,
                  })
                  .ilike("username", username);
              }
            }
          }
        }
        break;
      }

      case "CONTENT.ADDED":
      case "CONTENT.UPDATED": {
        console.log("Content event received, data will sync on next fetch");
        break;
      }

      case "INCOME.ADDED": {
        console.log("Income event received:", data?.transaction_id);
        break;
      }

      default:
        console.log("Unhandled webhook event:", event);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: jsonHeaders,
    });
  } catch (error) {
    console.error("phyllo-webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: jsonHeaders,
    });
  }
});

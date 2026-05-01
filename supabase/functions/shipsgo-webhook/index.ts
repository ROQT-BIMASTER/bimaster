// shipsgo-webhook — Recebe eventos da ShipsGo (created/updated/deleted).
// Validação HMAC-SHA256 via SHIPSGO_WEBHOOK_SECRET. Idempotente.
//
// Configurar este endpoint no painel ShipsGo:
//   https://<project-ref>.functions.supabase.co/shipsgo-webhook
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyShipsgoSignature, mapOceanShipment, mapOceanEvents } from "../_shared/shipsgo.ts";

// Webhook é público — auth via signature HMAC. Não usa secureHandler para
// preservar o body bruto necessário ao cálculo da assinatura.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type, x-shipsgo-webhook-signature",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const raw = await req.text();
  const signature = req.headers.get("x-shipsgo-webhook-signature");
  const valid = await verifyShipsgoSignature(raw, signature);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: any = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    await sb.from("shipsgo_webhook_log").insert({
      payload: { raw },
      signature_valid: valid,
      error_message: "Invalid JSON",
    });
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType: string = payload?.event ?? payload?.event_type ?? "unknown";
  const remote = payload?.data ?? payload?.shipment ?? payload;
  const shipsgoId = String(remote?.id ?? remote?.shipment_id ?? "");

  // Log primeiro (auditoria)
  const { data: logRow } = await sb
    .from("shipsgo_webhook_log")
    .insert({
      shipsgo_id: shipsgoId || null,
      event_type: eventType,
      signature_valid: valid,
      payload,
    })
    .select("id")
    .single();

  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  if (!shipsgoId) {
    await sb
      .from("shipsgo_webhook_log")
      .update({ error_message: "Missing shipment id" })
      .eq("id", logRow?.id);
    return new Response("Missing shipment id", { status: 400 });
  }

  try {
    if (eventType.toLowerCase().includes("delete")) {
      await sb
        .from("shipsgo_shipments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("shipsgo_id", shipsgoId);
    } else {
      const mapped = mapOceanShipment(remote);
      const { data: upserted } = await sb
        .from("shipsgo_shipments")
        .upsert({ ...mapped, raw_payload: remote }, { onConflict: "shipsgo_id" })
        .select("id")
        .single();

      const events = mapOceanEvents(remote);
      if (upserted && events.length > 0) {
        await sb
          .from("shipsgo_shipment_events")
          .upsert(
            events
              .filter((e) => e.event_at)
              .map((e) => ({ ...e, shipment_id: upserted.id })),
            { onConflict: "shipment_id,event_code,event_at,location_unlocode" },
          );
      }
    }

    await sb
      .from("shipsgo_webhook_log")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", logRow?.id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await sb
      .from("shipsgo_webhook_log")
      .update({ error_message: e?.message ?? "Unknown error" })
      .eq("id", logRow?.id);
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

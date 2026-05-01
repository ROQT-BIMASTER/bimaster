// shipsgo-webhook-replay — reprocessa uma entrada de shipsgo_webhook_log.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { z, validateBody } from "../_shared/validate.ts";
import { mapOceanShipment, mapOceanEvents } from "../_shared/shipsgo.ts";

const Schema = z.object({ webhook_id: z.string().uuid() }).strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "shipsgo-webhook-replay" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const json = { ...cors, "Content-Type": "application/json" };

      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      const { data: roleRow } = await sb.from("user_roles")
        .select("role").eq("user_id", ctx.userId!).eq("role", "admin").maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ error: "Acesso restrito" }), { status: 403, headers: json });
      }

      const body = await req.json().catch(() => ({}));
      const { webhook_id } = validateBody(body, Schema);

      const { data: log, error } = await sb.from("shipsgo_webhook_log")
        .select("id, payload, shipsgo_id").eq("id", webhook_id).maybeSingle();
      if (error || !log) {
        return new Response(JSON.stringify({ error: "Log não encontrado" }), { status: 404, headers: json });
      }

      try {
        const remote = log.payload?.shipment ?? log.payload;
        const mapped = mapOceanShipment(remote);
        const events = mapOceanEvents(remote);

        const { data: existing } = await sb.from("shipsgo_shipments")
          .select("id").eq("shipsgo_id", mapped.shipsgo_id).maybeSingle();

        let shipmentId = existing?.id;
        if (existing) {
          await sb.from("shipsgo_shipments").update(mapped).eq("id", existing.id);
        } else {
          const { data: ins } = await sb.from("shipsgo_shipments")
            .insert({ ...mapped, raw_payload: remote }).select("id").single();
          shipmentId = ins?.id;
        }

        if (shipmentId && events.length > 0) {
          await sb.from("shipsgo_shipment_events").insert(
            events.map((e) => ({ ...e, shipment_id: shipmentId })),
          );
        }

        await sb.from("shipsgo_webhook_log").update({
          processed_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", webhook_id);

        return new Response(JSON.stringify({ ok: true, shipment_id: shipmentId }), { headers: json });
      } catch (e: any) {
        await sb.from("shipsgo_webhook_log").update({
          error_message: `replay: ${e?.message ?? "erro"}`,
        }).eq("id", webhook_id);
        return new Response(JSON.stringify({ error: e?.message ?? "Falha no replay" }), { status: 500, headers: json });
      }
    },
  ),
);

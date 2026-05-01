// shipsgo-sync-shipment — Pull manual de um shipment + eventos + geojson.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { shipsgoFetch, mapOceanShipment, mapOceanEvents } from "../_shared/shipsgo.ts";

const BodySchema = z
  .object({
    shipment_id: z.string().uuid(), // id local
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 60, rateLimitPrefix: "shipsgo-sync" },
    async (req) => {
      const cors = getCorsHeaders(req);
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { ...cors, "Content-Type": "application/json" },
        });

      const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return json(400, { error: parsed.error.flatten() });

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: local, error: lErr } = await sb
        .from("shipsgo_shipments")
        .select("id, shipsgo_id")
        .eq("id", parsed.data.shipment_id)
        .maybeSingle();

      if (lErr) return json(500, { error: lErr.message });
      if (!local?.shipsgo_id) return json(404, { error: "Shipment não encontrado ou sem ID remoto" });

      const [remote, geojson] = await Promise.all([
        shipsgoFetch<any>(`/ocean/shipments/${encodeURIComponent(local.shipsgo_id)}`),
        shipsgoFetch<any>(`/ocean/shipments/${encodeURIComponent(local.shipsgo_id)}/geojson`).catch(() => null),
      ]);

      const mapped = mapOceanShipment(remote);

      const { error: uErr } = await sb
        .from("shipsgo_shipments")
        .update({ ...mapped, geojson, raw_payload: remote })
        .eq("id", local.id);

      if (uErr) return json(500, { error: uErr.message });

      const events = mapOceanEvents(remote);
      if (events.length > 0) {
        await sb
          .from("shipsgo_shipment_events")
          .upsert(
            events
              .filter((e) => e.event_at)
              .map((e) => ({ ...e, shipment_id: local.id })),
            { onConflict: "shipment_id,event_code,event_at,location_unlocode" },
          );
      }

      return json(200, { ok: true, events_count: events.length });
    },
  ),
);

// shipsgo-create-shipment — Cria rastreamento de container Ocean na ShipsGo
// e armazena/atualiza em `shipsgo_shipments`.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { shipsgoFetch, mapOceanShipment, mapOceanEvents } from "../_shared/shipsgo.ts";

const BodySchema = z
  .object({
    embarque_id: z.string().uuid().optional(),
    ordem_compra_id: z.string().uuid().optional(),
    container_number: z.string().trim().min(4).max(20).optional(),
    bl_number: z.string().trim().min(4).max(40).optional(),
    booking_number: z.string().trim().min(3).max(40).optional(),
    carrier_code: z.string().trim().min(2).max(10).optional(),
  })
  .strict()
  .refine(
    (d) => d.container_number || d.bl_number || d.booking_number,
    "Informe container_number, bl_number ou booking_number",
  );

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 30, rateLimitPrefix: "shipsgo-create" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { ...cors, "Content-Type": "application/json" },
        });

      const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) {
        return json(400, { error: parsed.error.flatten() });
      }
      const input = parsed.data;

      // Cria shipment na ShipsGo
      const remote = await shipsgoFetch<any>("/ocean/shipments", {
        method: "POST",
        body: {
          container_number: input.container_number,
          bl_number: input.bl_number,
          booking_number: input.booking_number,
          carrier_code: input.carrier_code,
        },
      });

      const mapped = mapOceanShipment(remote);

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: upserted, error: upErr } = await sb
        .from("shipsgo_shipments")
        .upsert(
          {
            ...mapped,
            embarque_id: input.embarque_id ?? null,
            ordem_compra_id: input.ordem_compra_id ?? null,
            raw_payload: remote,
            created_by: ctx.userId ?? null,
          },
          { onConflict: "shipsgo_id" },
        )
        .select()
        .single();

      if (upErr) return json(500, { error: upErr.message });

      // Eventos iniciais (se vierem no payload)
      const events = mapOceanEvents(remote);
      if (events.length > 0 && upserted) {
        await sb
          .from("shipsgo_shipment_events")
          .upsert(
            events
              .filter((e) => e.event_at)
              .map((e) => ({ ...e, shipment_id: upserted.id })),
            { onConflict: "shipment_id,event_code,event_at,location_unlocode" },
          );
      }

      return json(200, { shipment: upserted, events_count: events.length });
    },
  ),
);

/**
 * send-push-notification — envia Web Push (VAPID) para um usuário.
 *
 * Body: { user_id, title, body, url?, tag?, urgent? }
 *
 * Auth: "any" — chamado tanto por usuários (preview/teste) quanto pelo
 * trigger SQL via pg_net (service-role). O service-role bypassa RLS para
 * ler `push_subscriptions` de qualquer user_id.
 *
 * Estratégia de erro: 410 Gone / 404 → remove a subscription (cliente
 * cancelou no SO). Outros erros: log e continua para as demais subs.
 */
import { z } from "https://esm.sh/zod@3.23.8";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const Body = z.object({
  user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().max(500).optional().default(""),
  url: z.string().max(500).optional(),
  tag: z.string().max(120).optional(),
  urgent: z.boolean().optional().default(false),
  icon: z.string().url().max(500).optional(),
}).strict();

const VAPID_PUBLIC_KEY =
  "BChIsoAhrQdcIRDz-bnD7sTzvDHhIjda8Qx-DQilMlXF1vidHYvjOZlwDb2lGSPl50ELCoarxKtBl-eaGtyfjvY";

Deno.serve(secureHandler(
  { auth: "any", rateLimit: 120, rateLimitPrefix: "send-push" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);

    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:notifications@bimaster.online";
    if (!privateKey) {
      return new Response(JSON.stringify({ error: "VAPID not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    let payload: z.infer<typeof Body>;
    try {
      const parsed = Body.safeParse(await req.json());
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      payload = parsed.data;
    } catch {
      return new Response(JSON.stringify({ error: "invalid body" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    webpush.setVapidDetails(subject, VAPID_PUBLIC_KEY, privateKey);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Authorization: service-role/API-key callers may push to any user (used by
    // pg_net triggers). JWT callers can only push to themselves unless admin.
    const isApiKey = (ctx as any)?.authSource === "api_key";
    const callerId: string | null = (ctx as any)?.userId ?? null;
    if (!isApiKey) {
      if (!callerId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (callerId !== payload.user_id) {
        const { data: adminRole } = await sb
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId)
          .eq("role", "admin")
          .maybeSingle();
        if (!adminRole) {
          return new Response(
            JSON.stringify({ error: "Forbidden: cannot push to other users" }),
            { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
          );
        }
      }
    }



    const { data: subs, error } = await sb
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", payload.user_id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/dashboard/chat",
      tag: payload.tag,
      urgent: payload.urgent,
      icon: payload.icon,
    });

    let sent = 0;
    let removed = 0;
    const errors: string[] = [];

    await Promise.all(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notificationPayload,
          { TTL: payload.urgent ? 60 : 3600, urgency: payload.urgent ? "high" : "normal" },
        );
        sent++;
      } catch (e: any) {
        const status = e?.statusCode;
        if (status === 404 || status === 410) {
          // Subscription expirada/cancelada — remove
          await sb.from("push_subscriptions").delete().eq("id", s.id);
          removed++;
        } else {
          errors.push(`${status ?? "?"}: ${e?.body ?? e?.message ?? "unknown"}`);
        }
      }
    }));

    return new Response(JSON.stringify({ sent, removed, errors }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  },
));

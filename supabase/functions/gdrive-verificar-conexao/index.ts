// supabase/functions/gdrive-verificar-conexao/index.ts
// Verifica se o connector Google Drive da agência está conectado e válido.
// Admin-only. Atualiza google_drive_config.connection_status.

import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const VERIFY_URL = "https://connector-gateway.lovable.dev/api/v1/verify_credentials";

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "gdrive-verificar" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      // Admin only
      const { data: roles } = await sb
        .from("user_roles").select("role").eq("user_id", ctx.userId);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "forbidden" }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const lovable = Deno.env.get("LOVABLE_API_KEY");
      const drive = Deno.env.get("GOOGLE_DRIVE_API_KEY");

      if (!drive) {
        await sb.from("google_drive_config").update({
          connection_status: "nao_configurado",
          last_verified_at: new Date().toISOString(),
        }).neq("id", "00000000-0000-0000-0000-000000000000");
        return new Response(
          JSON.stringify({
            ok: false,
            status: "nao_configurado",
            message: "Connector Google Drive ainda não foi vinculado ao projeto.",
          }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      try {
        const res = await fetch(VERIFY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovable}`,
            "X-Connection-Api-Key": drive,
            "Content-Type": "application/json",
          },
        });
        const body = await res.json().catch(() => ({}));
        const verified = res.ok && (body.outcome === "verified" || body.outcome === "skipped");

        await sb.from("google_drive_config").update({
          connection_status: verified ? "conectado" : "erro",
          last_verified_at: new Date().toISOString(),
        }).neq("id", "00000000-0000-0000-0000-000000000000");

        return new Response(
          JSON.stringify({
            ok: verified,
            status: verified ? "conectado" : "erro",
            outcome: body.outcome,
            latency_ms: body.latency_ms,
            error: body.error || (res.ok ? null : `status ${res.status}`),
          }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sb.from("google_drive_config").update({
          connection_status: "erro",
          last_verified_at: new Date().toISOString(),
        }).neq("id", "00000000-0000-0000-0000-000000000000");
        return new Response(
          JSON.stringify({ ok: false, status: "erro", error: msg }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    },
  ),
);

// supabase/functions/gdrive-compartilhar-pasta/index.ts
// Cria/remove permissão "anyone with link reader" na pasta de um briefing.

import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const DRIVE_API = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

const BodySchema = z.object({
  briefing_id: z.string().uuid(),
  acao: z.enum(["compartilhar", "revogar"]),
}).strict();

Deno.serve(
  secureHandler(
    { auth: "jwt", rateLimit: 20, rateLimitPrefix: "gdrive-share" },
    async (req, ctx) => {
      const cors = getCorsHeaders(req);
      const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: parsed.error.flatten() }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const { briefing_id, acao } = parsed.data;

      const lovable = Deno.env.get("LOVABLE_API_KEY");
      const drive = Deno.env.get("GOOGLE_DRIVE_API_KEY");
      if (!drive) {
        return new Response(JSON.stringify({ ok: false, error: "not_configured" }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const headers = {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": drive,
        "Content-Type": "application/json",
      };

      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: briefing } = await sb
        .from("briefings")
        .select("id, google_drive_folder_id, google_drive_folder_url, google_drive_share_url")
        .eq("id", briefing_id).maybeSingle();
      if (!briefing?.google_drive_folder_id) {
        return new Response(JSON.stringify({ ok: false, error: "pasta_inexistente" }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const folderId = briefing.google_drive_folder_id;

      try {
        if (acao === "compartilhar") {
          const res = await fetch(
            `${DRIVE_API}/files/${folderId}/permissions?supportsAllDrives=true`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({ role: "reader", type: "anyone" }),
            },
          );
          if (!res.ok) {
            const t = await res.text();
            throw new Error(`share_failed[${res.status}]: ${t.slice(0, 200)}`);
          }
          const shareUrl = `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;
          await sb.from("briefings").update({ google_drive_share_url: shareUrl }).eq("id", briefing_id);
          return new Response(JSON.stringify({ ok: true, share_url: shareUrl }),
            { headers: { ...cors, "Content-Type": "application/json" } });
        }

        // revogar
        const listRes = await fetch(
          `${DRIVE_API}/files/${folderId}/permissions?supportsAllDrives=true&fields=permissions(id,type)`,
          { headers },
        );
        const listData = await listRes.json();
        const anyonePerm = (listData.permissions || []).find((p: any) => p.type === "anyone");
        if (anyonePerm) {
          await fetch(
            `${DRIVE_API}/files/${folderId}/permissions/${anyonePerm.id}?supportsAllDrives=true`,
            { method: "DELETE", headers },
          );
        }
        await sb.from("briefings").update({ google_drive_share_url: null }).eq("id", briefing_id);
        return new Response(JSON.stringify({ ok: true }),
          { headers: { ...cors, "Content-Type": "application/json" } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return new Response(JSON.stringify({ ok: false, error: msg }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
      }
    },
  ),
);

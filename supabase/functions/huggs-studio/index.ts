// Estúdio Huggs - Edge Function única que orquestra avatares, vozes,
// geração de vídeo e tradução via HeyGen. White-label: o cliente nunca vê "HeyGen".
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const HG_BASE_V2 = "https://api.heygen.com/v2";
const HG_BASE_V1 = "https://api.heygen.com/v1";

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function hgFetch(path: string, init: RequestInit = {}) {
  const apiKey = Deno.env.get("HEYGEN_API_KEY");
  if (!apiKey) throw new Error("HEYGEN_API_KEY missing");
  const url = path.startsWith("http") ? path : `${HG_BASE_V2}${path}`;
  const headers = new Headers(init.headers || {});
  headers.set("X-Api-Key", apiKey);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const r = await fetch(url, { ...init, headers });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) {
    throw new Error(`HeyGen ${r.status}: ${json?.message || json?.error || text}`);
  }
  return json;
}

const Body = z.object({
  action: z.enum([
    "list_avatars", "list_voices",
    "create_video", "video_status", "list_my_videos",
    "create_translation", "translation_status", "list_my_translations",
    "list_translation_languages",
  ]),
  payload: z.record(z.string(), z.any()).optional(),
}).strict();

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 60, rateLimitPrefix: "huggs-studio" },
  async (req, ctx) => {
    const cors = getCorsHeaders(req);
    const userId = ctx.userId!;
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { action, payload = {} } = parsed.data;
    const db = svc();

    // Verifica acesso (admin OR marketing)
    const { data: canAccess } = await db.rpc("can_access_huggs_studio", { _user_id: userId });
    if (!canAccess) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    try {
      let result: any;
      switch (action) {
        case "list_avatars": {
          const data = await hgFetch("/avatars");
          // HeyGen retorna { data: { avatars: [...], talking_photos: [...] } }
          result = {
            avatars: data?.data?.avatars || [],
            talking_photos: data?.data?.talking_photos || [],
          };
          break;
        }
        case "list_voices": {
          const data = await hgFetch("/voices");
          // Filtra por idiomas mais comuns para reduzir payload
          const langs = (payload.languages as string[] | undefined) || ["Portuguese", "English", "Spanish"];
          const all = data?.data?.voices || [];
          result = {
            voices: langs.length
              ? all.filter((v: any) => langs.some(l => (v.language || "").toLowerCase().includes(l.toLowerCase())))
              : all,
          };
          break;
        }
        case "create_video": {
          const schema = z.object({
            titulo: z.string().min(1).max(200),
            script: z.string().min(1).max(5000),
            avatar_id: z.string().min(1),
            voice_id: z.string().min(1),
            avatar_type: z.enum(["avatar", "talking_photo"]).default("avatar"),
            background: z.string().optional(),
          }).strict();
          const p = schema.parse(payload);

          const charBlock: any = p.avatar_type === "talking_photo"
            ? { type: "talking_photo", talking_photo_id: p.avatar_id }
            : { type: "avatar", avatar_id: p.avatar_id, avatar_style: "normal" };

          const body = {
            video_inputs: [{
              character: charBlock,
              voice: { type: "text", input_text: p.script, voice_id: p.voice_id },
              background: { type: "color", value: p.background || "#1a1a1a" },
            }],
            dimension: { width: 1920, height: 1080 },
          };
          const hg = await hgFetch("/video/generate", { method: "POST", body: JSON.stringify(body) });
          const videoId = hg?.data?.video_id;
          if (!videoId) throw new Error("video_id não retornado pelo provedor");

          const { data: row, error: insertErr } = await db.from("huggs_studio_videos").insert({
            user_id: userId,
            titulo: p.titulo,
            script: p.script,
            heygen_video_id: videoId,
            status: "processing",
            language: "pt",
            source_type: "avatar",
            metadata: { avatar_id: p.avatar_id, voice_id: p.voice_id, avatar_type: p.avatar_type },
          }).select().single();
          if (insertErr) throw insertErr;
          result = { id: row.id, video_id: videoId, status: "processing" };
          break;
        }
        case "video_status": {
          const schema = z.object({ id: z.string().uuid() }).strict();
          const p = schema.parse(payload);
          const { data: row } = await db.from("huggs_studio_videos")
            .select("*").eq("id", p.id).eq("user_id", userId).single();
          if (!row) throw new Error("Vídeo não encontrado");
          if (row.status === "completed" || row.status === "failed") {
            result = row; break;
          }
          if (!row.heygen_video_id) { result = row; break; }
          const hg = await hgFetch(`${HG_BASE_V1}/video_status.get?video_id=${row.heygen_video_id}`);
          const d = hg?.data || {};
          const newStatus = d.status === "completed" ? "completed"
            : d.status === "failed" ? "failed"
            : "processing";
          const update: any = { status: newStatus };
          if (d.video_url) update.video_url = d.video_url;
          if (d.thumbnail_url) update.thumbnail_url = d.thumbnail_url;
          if (d.duration) update.duration_seconds = d.duration;
          if (d.error) update.error_message = typeof d.error === "string" ? d.error : JSON.stringify(d.error);
          const { data: updated } = await db.from("huggs_studio_videos")
            .update(update).eq("id", p.id).select().single();
          result = updated;
          break;
        }
        case "list_my_videos": {
          const { data } = await db.from("huggs_studio_videos")
            .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
          result = { videos: data || [] };
          break;
        }
        case "list_translation_languages": {
          const data = await hgFetch(`${HG_BASE_V2}/video_translate/target_languages`);
          result = { languages: data?.data?.languages || data?.languages || [] };
          break;
        }
        case "create_translation": {
          const schema = z.object({
            title: z.string().min(1).max(200),
            video_url: z.string().url(),
            output_language: z.string().min(2),
          }).strict();
          const p = schema.parse(payload);
          const hg = await hgFetch(`${HG_BASE_V2}/video_translate`, {
            method: "POST",
            body: JSON.stringify({
              video_url: p.video_url,
              output_language: p.output_language,
              title: p.title,
            }),
          });
          const tId = hg?.data?.video_translate_id;
          if (!tId) throw new Error("translation_id não retornado");
          const { data: row, error } = await db.from("huggs_studio_translations").insert({
            user_id: userId,
            title: p.title,
            source_url: p.video_url,
            target_language: p.output_language,
            heygen_translation_id: tId,
            status: "processing",
          }).select().single();
          if (error) throw error;
          result = { id: row.id, translation_id: tId, status: "processing" };
          break;
        }
        case "translation_status": {
          const schema = z.object({ id: z.string().uuid() }).strict();
          const p = schema.parse(payload);
          const { data: row } = await db.from("huggs_studio_translations")
            .select("*").eq("id", p.id).eq("user_id", userId).single();
          if (!row) throw new Error("Tradução não encontrada");
          if (row.status === "completed" || row.status === "failed") { result = row; break; }
          if (!row.heygen_translation_id) { result = row; break; }
          const hg = await hgFetch(`${HG_BASE_V2}/video_translate/${row.heygen_translation_id}`);
          const d = hg?.data || {};
          const newStatus = d.status === "success" ? "completed"
            : d.status === "failed" ? "failed"
            : "processing";
          const update: any = { status: newStatus };
          if (d.url) update.video_url = d.url;
          if (d.message) update.error_message = d.message;
          const { data: updated } = await db.from("huggs_studio_translations")
            .update(update).eq("id", p.id).select().single();
          result = updated;
          break;
        }
        case "list_my_translations": {
          const { data } = await db.from("huggs_studio_translations")
            .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
          result = { translations: data || [] };
          break;
        }
      }
      return new Response(JSON.stringify({ ok: true, data: result }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro interno";
      console.error("[huggs-studio]", action, msg);
      return new Response(JSON.stringify({ ok: false, error: msg }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  },
));

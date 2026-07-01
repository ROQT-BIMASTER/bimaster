// supabase/functions/cache-post-media/index.ts
// Baixa mídia crua (imagem/vídeo) das URLs efêmeras dos posts e persiste
// no bucket privado `mkt-midia`. Autorização: x-cron-secret OU admin JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BYTES = 50 * 1024 * 1024; // 50MB
const FETCH_TIMEOUT_MS = 15_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function extFromContentType(ct: string): string | null {
  const t = ct.toLowerCase().split(";")[0].trim();
  if (t === "image/jpeg" || t === "image/jpg") return "jpg";
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  if (t === "image/gif") return "gif";
  if (t === "video/mp4") return "mp4";
  if (t === "video/quicktime") return "mov";
  if (t.startsWith("image/")) return "img";
  if (t.startsWith("video/")) return "vid";
  return null;
}

function isSupportedCt(ct: string): boolean {
  const t = ct.toLowerCase();
  return t.startsWith("image/") || t.startsWith("video/");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return j(405, { error: "method_not_allowed" });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const CRON_SECRET = Deno.env.get("CRON_SECRET");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ---- Auth: cron secret OU admin JWT ----
    const cronHeader = req.headers.get("x-cron-secret");
    let authorized = false;
    if (CRON_SECRET && cronHeader && cronHeader === CRON_SECRET) {
      authorized = true;
    } else {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token) {
        const userClient = createClient(SUPABASE_URL, ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userRes } = await userClient.auth.getUser();
        const uid = userRes?.user?.id;
        if (uid) {
          const { data: isAdmin } = await admin.rpc("has_role", {
            _user_id: uid,
            _role: "admin",
          });
          if (isAdmin) authorized = true;
        }
      }
    }
    if (!authorized) return j(403, { error: "forbidden" });

    const body = (await req.json().catch(() => ({}))) as {
      limit?: number;
      post_id?: string;
    };

    let limit = Number.isFinite(body?.limit) ? Number(body.limit) : DEFAULT_LIMIT;
    if (limit < 1) limit = 1;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    // ---- Selecionar posts ----
    let query = admin
      .from("mkt_posts")
      .select("id, midia_origem_url, midia_status")
      .not("midia_origem_url", "is", null)
      .limit(limit);

    if (body?.post_id) {
      query = admin
        .from("mkt_posts")
        .select("id, midia_origem_url, midia_status")
        .eq("id", body.post_id)
        .not("midia_origem_url", "is", null);
    } else {
      query = query.eq("midia_status", "pendente");
    }

    const { data: posts, error: qErr } = await query;
    if (qErr) {
      console.error("cache_post_media_select_failed", qErr.message);
      return j(500, { error: "select_failed" });
    }

    let ok_count = 0;
    let error_count = 0;
    let sem_midia_count = 0;
    let too_big_count = 0;

    for (const p of posts ?? []) {
      const url = p.midia_origem_url as string;
      const id = p.id as string;

      let status: "ok" | "sem_midia" | "erro" = "erro";
      let cachePath: string | null = null;
      let contentType: string | null = null;

      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
      try {
        const resp = await fetch(url, { signal: ac.signal, redirect: "follow" });
        clearTimeout(t);
        if (!resp.ok) {
          status = "erro";
        } else {
          const ct = resp.headers.get("content-type") ?? "";
          if (!isSupportedCt(ct)) {
            status = "sem_midia";
            sem_midia_count++;
          } else {
            const cl = Number(resp.headers.get("content-length") ?? "0");
            if (cl && cl > MAX_BYTES) {
              status = "sem_midia";
              too_big_count++;
            } else {
              const buf = new Uint8Array(await resp.arrayBuffer());
              if (buf.byteLength > MAX_BYTES) {
                status = "sem_midia";
                too_big_count++;
              } else {
                const ext = extFromContentType(ct) ?? "bin";
                const path = `posts/${id}.${ext}`;
                const { error: upErr } = await admin.storage
                  .from("mkt-midia")
                  .upload(path, buf, {
                    contentType: ct,
                    upsert: true,
                    cacheControl: "3600",
                  });
                if (upErr) {
                  console.error("cache_post_media_upload_failed", id, upErr.message);
                  status = "erro";
                } else {
                  status = "ok";
                  cachePath = path;
                  contentType = ct;
                  ok_count++;
                }
              }
            }
          }
        }
      } catch (e) {
        clearTimeout(t);
        console.error("cache_post_media_fetch_failed", id, (e as Error)?.name ?? "err");
        status = "erro";
      }

      if (status === "erro") error_count++;

      const patch: Record<string, unknown> = {
        midia_status: status,
        midia_cached_at: new Date().toISOString(),
      };
      if (cachePath) patch.midia_cache_path = cachePath;
      if (contentType) patch.midia_content_type = contentType;

      const { error: upErr } = await admin
        .from("mkt_posts")
        .update(patch)
        .eq("id", id);
      if (upErr) console.error("cache_post_media_status_update_failed", id, upErr.message);
    }

    return j(200, {
      ok: true,
      processed: posts?.length ?? 0,
      ok_count,
      error_count,
      sem_midia_count,
      too_big_count,
    });
  } catch (e) {
    console.error("cache_post_media_unexpected", (e as Error)?.message);
    return j(500, { error: "unexpected" });
  }
});

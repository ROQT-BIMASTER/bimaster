// Ingest Influencer Media
// =========================
// Baixa avatar ou thumbnail de post sob demanda e armazena no bucket privado
// "influencer-media", gravando o storage_path no registro correspondente.
//
// Body:
//   { kind: "avatar", influencer_id?: uuid, discovered_profile_id?: uuid }
//   { kind: "post",   post_id: uuid }

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { secureHandler } from "../_shared/secure-handler.ts";

const BUCKET = "influencer-media";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function extFromContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

async function downloadAndStore(
  serviceClient: any,
  url: string,
  storagePath: string,
): Promise<{ path: string; contentType: string } | null> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`download_${res.status}`);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!ALLOWED.some((a) => ct.includes(a.split("/")[1]))) {
    throw new Error(`invalid_content_type:${ct}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error("file_too_large");

  const ext = extFromContentType(ct);
  const finalPath = `${storagePath}.${ext}`;

  const { error } = await serviceClient.storage.from(BUCKET).upload(finalPath, buf, {
    contentType: ct || `image/${ext}`,
    upsert: true,
  });
  if (error) throw new Error(`upload_failed:${error.message}`);
  return { path: finalPath, contentType: ct };
}

Deno.serve(secureHandler({ auth: "none", rateLimit: 10, rateLimitPrefix: "ingest-influencer-media" }, async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const headers = getCorsHeaders(req);
  const jsonHeaders = { ...headers, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: jsonHeaders });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: jsonHeaders });
    }
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const { kind } = body;

    // ===========================
    // Avatar (influencer ou perfil descoberto)
    // ===========================
    if (kind === "avatar") {
      const influencerId = body.influencer_id;
      const discoveredId = body.discovered_profile_id;
      if (!influencerId && !discoveredId) {
        return new Response(JSON.stringify({ error: "informe influencer_id ou discovered_profile_id" }),
          { status: 400, headers: jsonHeaders });
      }

      let row: any = null;
      let table: "influencers" | "discovered_profiles" = "influencers";
      if (influencerId) {
        const { data } = await serviceClient.from("influencers")
          .select("id, platform, username, avatar_url, avatar_storage_path")
          .eq("id", influencerId).single();
        row = data;
      } else {
        table = "discovered_profiles";
        const { data } = await serviceClient.from("discovered_profiles")
          .select("id, platform, username, avatar_url, avatar_storage_path")
          .eq("id", discoveredId).single();
        row = data;
      }
      if (!row) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: jsonHeaders });

      // Idempotente
      if (row.avatar_storage_path) {
        return new Response(JSON.stringify({
          data: { path: row.avatar_storage_path, already: true },
        }), { status: 200, headers: jsonHeaders });
      }
      if (!row.avatar_url) {
        return new Response(JSON.stringify({ error: "no_source_url" }), { status: 400, headers: jsonHeaders });
      }

      const basePath = `avatars/${row.platform}/${row.username}`;
      const result = await downloadAndStore(serviceClient, row.avatar_url, basePath);
      if (!result) throw new Error("download_failed");

      // Atualiza em ambas as tabelas se possível
      if (table === "influencers") {
        await serviceClient.from("influencers")
          .update({ avatar_storage_path: result.path })
          .eq("id", row.id);
        // tenta atualizar perfil descoberto correspondente
        await serviceClient.from("discovered_profiles")
          .update({ avatar_storage_path: result.path })
          .eq("platform", row.platform).eq("username", row.username.toLowerCase());
      } else {
        await serviceClient.from("discovered_profiles")
          .update({ avatar_storage_path: result.path })
          .eq("id", row.id);
        await serviceClient.from("influencers")
          .update({ avatar_storage_path: result.path })
          .eq("platform", row.platform).eq("username", row.username);
      }

      return new Response(JSON.stringify({ data: { path: result.path } }),
        { status: 200, headers: jsonHeaders });
    }

    // ===========================
    // Post media
    // ===========================
    if (kind === "post") {
      const postId = body.post_id;
      if (!postId) {
        return new Response(JSON.stringify({ error: "post_id obrigatório" }),
          { status: 400, headers: jsonHeaders });
      }
      const { data: post } = await serviceClient.from("influencer_posts")
        .select("id, influencer_id, platform_post_id, thumbnail_url, media_url, post_type, thumbnail_storage_path, media_storage_path")
        .eq("id", postId).single();
      if (!post) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: jsonHeaders });

      const updates: Record<string, any> = {};
      const basePath = `posts/${post.influencer_id}/${post.platform_post_id || post.id}`;

      // Thumbnail (sempre tenta se URL existir e não estiver salva ainda)
      if (post.thumbnail_url && !post.thumbnail_storage_path) {
        try {
          const r = await downloadAndStore(serviceClient, post.thumbnail_url, `${basePath}-thumb`);
          if (r) updates.thumbnail_storage_path = r.path;
        } catch (e) {
          logger.error("[ingest-media] thumbnail err", e);
        }
      }

      // Mídia principal (apenas se for imagem para evitar vídeos pesados)
      if (post.media_url && !post.media_storage_path && post.post_type === "image") {
        try {
          const r = await downloadAndStore(serviceClient, post.media_url, `${basePath}-media`);
          if (r) updates.media_storage_path = r.path;
        } catch (e) {
          logger.error("[ingest-media] media err", e);
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.media_ingested_at = new Date().toISOString();
        await serviceClient.from("influencer_posts").update(updates).eq("id", post.id);
      }

      return new Response(JSON.stringify({
        data: {
          post_id: post.id,
          thumbnail_storage_path: updates.thumbnail_storage_path || post.thumbnail_storage_path,
          media_storage_path: updates.media_storage_path || post.media_storage_path,
        },
      }), { status: 200, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: "kind inválido" }), { status: 400, headers: jsonHeaders });

  } catch (error) {
    logger.error("ingest-influencer-media error:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: "internal_error", message }),
      { status: 500, headers: jsonHeaders });
  }
}));

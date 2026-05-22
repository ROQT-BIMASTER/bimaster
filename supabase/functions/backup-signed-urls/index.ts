// Gera URLs assinadas (1h) para uma lista de (bucket, path).
// Uso interno de backup pré-restore. Restrito a admin via service-role check.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { timingSafeEqual } from "../_shared/timing-safe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_TOKEN = Deno.env.get("BACKUP_SHARED_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = req.headers.get("x-backup-token") ?? "";
  if (!SHARED_TOKEN || !timingSafeEqual(token, SHARED_TOKEN)) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const items: Array<{ bucket: string; path: string }> = body.items ?? [];
  if (!Array.isArray(items) || items.length === 0 || items.length > 1000) {
    return new Response(JSON.stringify({ error: "items[] required (1..1000)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const expiresIn = 3600;
  const results: Array<{ bucket: string; path: string; url?: string; error?: string }> = [];

  for (const it of items) {
    const { data, error } = await supabase.storage
      .from(it.bucket)
      .createSignedUrl(it.path, expiresIn);
    if (error || !data?.signedUrl) {
      results.push({ bucket: it.bucket, path: it.path, error: error?.message ?? "no url" });
    } else {
      results.push({ bucket: it.bucket, path: it.path, url: data.signedUrl });
    }
  }

  return new Response(JSON.stringify({ expiresIn, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

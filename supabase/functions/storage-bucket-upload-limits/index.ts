import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const ONE_GB_BYTES = 1024 * 1024 * 1024;

const TARGET_BUCKETS = [
  "projeto-anexos",
  "documento-anexos",
  "attachments",
  "marketing-assets",
  "briefing-cofre",
  "chat-anexos",
  "aprovacao-documentos",
  "fluxo-artes",
  "aprovacao-artes",
  "trade-assets",
] as const;

const ADOBE_MIME_TYPES = [
  "application/postscript",
  "application/illustrator",
  "application/vnd.adobe.illustrator",
  "image/vnd.adobe.photoshop",
  "application/x-photoshop",
  "application/photoshop",
  "image/psd",
  "application/octet-stream",
] as const;

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function normalizeMimeTypes(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

Deno.serve(secureHandler(
  { auth: "jwt", rateLimit: 5, rateLimitPrefix: "storage-bucket-upload-limits" },
  async (req, ctx) => {
    if (req.method !== "POST") {
      return json(req, { error: "method_not_allowed" }, 405);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return json(req, { error: "admin_required" }, 403);
    }

    const before = await admin
      .schema("storage")
      .from("buckets")
      .select("id, public, file_size_limit, allowed_mime_types")
      .in("id", [...TARGET_BUCKETS])
      .order("id");

    if (before.error) {
      return json(req, { error: "bucket_read_failed", detail: before.error.message }, 500);
    }

    const updates = [];
    for (const bucket of before.data ?? []) {
      const currentMimeTypes = normalizeMimeTypes(bucket.allowed_mime_types);
      const nextMimeTypes = currentMimeTypes
        ? Array.from(new Set([...currentMimeTypes, ...ADOBE_MIME_TYPES]))
        : undefined;

      const { data, error } = await admin.storage.updateBucket(bucket.id, {
        public: false,
        fileSizeLimit: ONE_GB_BYTES,
        ...(nextMimeTypes ? { allowedMimeTypes: nextMimeTypes } : {}),
      });

      updates.push({
        id: bucket.id,
        ok: !error,
        error: error?.message ?? null,
        result: data ?? null,
      });
    }

    const after = await admin
      .schema("storage")
      .from("buckets")
      .select("id, public, file_size_limit, allowed_mime_types")
      .in("id", [...TARGET_BUCKETS])
      .order("id");

    return json(req, {
      target_file_size_limit: ONE_GB_BYTES,
      adobe_mime_types: ADOBE_MIME_TYPES,
      before: before.data ?? [],
      updates,
      after: after.data ?? [],
      after_error: after.error?.message ?? null,
    });
  },
));
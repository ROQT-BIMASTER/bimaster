/**
 * admin-align-storage-buckets
 * ------------------------------------------------------------------
 * Alinha a configuração dos buckets (tipos aceitos + limite por arquivo) com a
 * allowlist única do front (`src/lib/utils/file-security.ts`).
 *
 * Motivo: quando o bucket aceita menos tipos que a tela, o arquivo passa na
 * validação local, sobe e é recusado pelo servidor — gerando o erro genérico
 * relatado pela equipe da China.
 *
 * Somente administradores podem executar.
 */
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/heic", "image/heif",
  "image/bmp", "image/tiff", "image/svg+xml",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv", "text/plain", "application/xml", "text/xml",
  "application/zip", "application/x-zip-compressed",
  "application/vnd.rar", "application/x-rar-compressed", "application/x-rar",
  "application/x-7z-compressed",
  "video/mp4", "video/quicktime", "video/webm",
  "application/octet-stream",
  "application/postscript", "application/illustrator", "application/vnd.adobe.illustrator",
  "image/vnd.adobe.photoshop", "application/x-photoshop", "application/photoshop", "image/psd",
  "image/x-eps", "application/eps", "application/x-eps",
  "application/coreldraw", "application/x-coreldraw", "application/cdr", "image/x-coreldraw",
  "image/vnd.dwg", "application/acad", "application/x-acad", "image/vnd.dxf",
];

const DEFAULT_BUCKETS = [
  "china-documentos",
  "china-pasta-digital",
  "china-chat-anexos",
  "china-pareceres",
  "china-submissao-foto-oficial",
];

const FILE_SIZE_LIMIT = 1024 * 1024 * 1024; // 1 GB

const Body = z
  .object({
    buckets: z.array(z.string().min(1).max(63)).max(50).optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();

Deno.serve(
  secureHandler(
    { auth: "none", rateLimit: 10, rateLimitPrefix: "admin-align-storage-buckets", skipWaf: true },
    async (req) => {
      const cors = getCorsHeaders(req);
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { ...cors, "Content-Type": "application/json" },
        });

      const url = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(url, serviceKey);

      // Autorização: segredo interno (pg_cron/manutenção), service-role bearer
      // ou JWT de administrador.
      const cronSecret = req.headers.get("x-cron-secret") ?? "";
      const authz = req.headers.get("Authorization") ?? "";
      const bearer = authz.startsWith("Bearer ") ? authz.slice(7) : "";

      let authorized = !!bearer && bearer === serviceKey;

      if (!authorized && cronSecret) {
        const envSecret = Deno.env.get("CRON_SECRET") ?? "";
        if (envSecret && cronSecret === envSecret) authorized = true;
        if (!authorized) {
          try {
            const { data } = await admin.rpc("_internal_cron_secret" as never);
            if (data && cronSecret === (data as unknown as string)) authorized = true;
          } catch {
            /* ignora */
          }
        }
      }

      if (!authorized && bearer) {
        try {
          const { data: userData } = await admin.auth.getUser(bearer);
          const uid = userData?.user?.id;
          if (uid) {
            const { data: isAdmin } = await admin.rpc("has_role", { _user_id: uid, _role: "admin" });
            authorized = !!isAdmin;
          }
        } catch {
          /* ignora */
        }
      }

      if (!authorized) return json({ error: "Acesso restrito a administradores." }, 403);


      let raw: unknown = {};
      try {
        raw = await req.json();
      } catch {
        raw = {};
      }
      const parsed = Body.safeParse(raw);
      if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);

      const buckets = parsed.data.buckets?.length ? parsed.data.buckets : DEFAULT_BUCKETS;
      const results: Array<Record<string, unknown>> = [];

      for (const bucket of buckets) {
        if (parsed.data.dryRun) {
          results.push({ bucket, skipped: "dry-run" });
          continue;
        }
        const res = await fetch(`${url}/storage/v1/bucket/${bucket}`, {
          method: "PUT",
          headers: {
            authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: bucket,
            name: bucket,
            public: false,
            file_size_limit: FILE_SIZE_LIMIT,
            allowed_mime_types: ALLOWED_MIME_TYPES,
          }),
        });
        const payload = await res.text();
        results.push({ bucket, ok: res.ok, status: res.status, response: payload.slice(0, 300) });
      }

      return json({ ok: results.every((r) => r.ok !== false), results });
    },
  ),
);

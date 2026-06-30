// Worker do canhoto sob demanda (Result).
// pull -> conector pega pendentes; upload -> grava arquivo + status pronto;
// fail -> marca sem_imagem/erro. Auth: Bearer RUBYSP_SYNC_TOKEN.
import { z } from "https://esm.sh/zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const PullSchema = z.object({
  action: z.literal("pull"),
  limit: z.number().int().min(1).max(200).default(20),
}).strict();

const UploadSchema = z.object({
  action: z.literal("upload"),
  rubysp_pedido_id: z.number().int(),
  mime: z.string().min(1).max(100),
  base64: z.string().min(1),
  local: z.string().optional().nullable(),
}).strict();

const FailSchema = z.object({
  action: z.literal("fail"),
  rubysp_pedido_id: z.number().int(),
  motivo: z.string().min(1).max(500),
}).strict();

const BodySchema = z.union([PullSchema, UploadSchema, FailSchema]);

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "application/pdf") return "pdf";
  if (m === "image/tiff") return "tif";
  return "bin";
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 120, rateLimitPrefix: "canhoto-rubysp", skipWaf: true },
  async (req) => {
    const cors = getCorsHeaders(req);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });

    if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

    const expected = Deno.env.get("RUBYSP_SYNC_TOKEN");
    if (!expected) return json(500, { error: "server_misconfigured" });

    const authHeader = req.headers.get("Authorization") ?? "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!provided || !constantTimeEquals(provided, expected)) {
      return json(401, { error: "unauthorized" });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json(400, { error: "invalid_json" });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(400, { error: "validation_error", details: parsed.error.flatten() });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    try {
      if (parsed.data.action === "pull") {
        const limit = parsed.data.limit;
        const { data: pendentes, error } = await supabase
          .from("canhoto_rubysp")
          .select("rubysp_pedido_id")
          .eq("status", "pendente")
          .order("solicitado_em", { ascending: true })
          .limit(limit);
        if (error) throw error;
        const ids = (pendentes ?? []).map((p) => p.rubysp_pedido_id as number);
        let enriched: Array<{ rubysp_pedido_id: number; empresa_id: number | null }> = [];
        if (ids.length > 0) {
          const { data: peds, error: pedErr } = await supabase
            .from("erp_pedidos_rubysp")
            .select("rubysp_pedido_id, empresa_id")
            .in("rubysp_pedido_id", ids);
          if (pedErr) throw pedErr;
          const map = new Map<number, number | null>();
          for (const p of peds ?? []) {
            map.set(p.rubysp_pedido_id as number, (p.empresa_id as number | null) ?? null);
          }
          enriched = ids.map((id) => ({ rubysp_pedido_id: id, empresa_id: map.get(id) ?? null }));
        }
        return json(200, { pendentes: enriched });
      }

      if (parsed.data.action === "upload") {
        const { rubysp_pedido_id, mime, base64, local } = parsed.data;
        const bytes = base64ToBytes(base64);
        const ext = extFromMime(mime);
        const path = `${rubysp_pedido_id}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("canhotos")
          .upload(path, bytes, { contentType: mime, upsert: true });
        if (upErr) throw upErr;

        const now = new Date().toISOString();
        const { error: dbErr } = await supabase
          .from("canhoto_rubysp")
          .upsert({
            rubysp_pedido_id,
            status: "pronto",
            storage_path: path,
            mime,
            local: local ?? null,
            motivo: null,
            processado_em: now,
          }, { onConflict: "rubysp_pedido_id" });
        if (dbErr) throw dbErr;
        return json(200, { ok: true });
      }

      const { rubysp_pedido_id, motivo } = parsed.data;
      const now = new Date().toISOString();
      const status = motivo === "sem_imagem" ? "sem_imagem" : "erro";
      const { error: dbErr } = await supabase
        .from("canhoto_rubysp")
        .upsert({
          rubysp_pedido_id,
          status,
          motivo,
          processado_em: now,
        }, { onConflict: "rubysp_pedido_id" });
      if (dbErr) throw dbErr;
      return json(200, { ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(500, { error: "internal_error", details: msg });
    }
  },
));

// Reimports legacy Asana attachments whose storage_path is still the raw
// (now-expired) asanausercontent URL. Re-fetches a fresh download_url via the
// Asana API and uploads the binary into the projeto-anexos bucket.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const ASANA_API = "https://app.asana.com/api/1.0";
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const TIME_BUDGET_MS = 50_000;

function sanitizeFilename(name: string): string {
  return (name || "attachment").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 180) || "attachment";
}

async function asanaGet(path: string, pat: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${ASANA_API}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${pat}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Asana ${path}: ${res.status} ${JSON.stringify(data)}`);
  return data?.data;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const corsHeaders = getCorsHeaders(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Token inválido" }, 401);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const pat = (body.pat as string | undefined) || Deno.env.get("ASANA_PAT");
    if (!pat) return json({ error: "ASANA_PAT não configurado" }, 400);

    const mode = (body.mode as string) || "run"; // "count" | "run"

    // Count remaining
    const { count: pending } = await adminClient
      .from("projeto_tarefa_anexos")
      .select("id", { count: "exact", head: true })
      .like("storage_path", "http%")
      .not("asana_gid", "is", null);

    if (mode === "count") return json({ pending: pending ?? 0 });

    const batchSize = Math.min(Math.max(Number(body.batch_size) || 25, 1), 50);

    const { data: rows, error: selErr } = await adminClient
      .from("projeto_tarefa_anexos")
      .select("id, asana_gid, nome, tarefa_id")
      .like("storage_path", "http%")
      .not("asana_gid", "is", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (selErr) return json({ error: selErr.message }, 500);

    const start = Date.now();
    const results: Array<{ id: string; status: string; error?: string }> = [];
    let imported = 0, expired = 0, failed = 0;

    for (const row of rows || []) {
      if (Date.now() - start > TIME_BUDGET_MS) {
        results.push({ id: row.id, status: "skipped_time_budget" });
        continue;
      }
      try {
        const att = await asanaGet(`/attachments/${row.asana_gid}`, pat, {
          opt_fields: "name,download_url,host,view_url,permanent_url,size,resource_subtype",
        });
        const isAsanaHosted = (att?.host === "asana") && !!att?.download_url;

        if (!isAsanaHosted) {
          // Treat as external link — preserve URL but mark properly
          const link = att?.permanent_url || att?.view_url || att?.download_url || "";
          await adminClient.from("projeto_tarefa_anexos").update({
            storage_path: link ? `external://${link}` : `external://unknown`,
            tipo_arquivo: `external:${att?.host || "link"}`,
          }).eq("id", row.id);
          results.push({ id: row.id, status: "converted_external" });
          imported++;
          continue;
        }

        if (att.size && att.size > MAX_ATTACHMENT_BYTES) {
          await adminClient.from("projeto_tarefa_anexos").update({
            tipo_arquivo: "asana_too_large",
          }).eq("id", row.id);
          results.push({ id: row.id, status: "too_large" });
          failed++;
          continue;
        }

        const dl = await fetch(att.download_url, { headers: { Authorization: `Bearer ${pat}` } });
        if (!dl.ok) {
          // Likely 403 expired or removed on Asana side
          await adminClient.from("projeto_tarefa_anexos").update({
            tipo_arquivo: "asana_expired",
          }).eq("id", row.id);
          results.push({ id: row.id, status: "expired", error: `HTTP ${dl.status}` });
          expired++;
          continue;
        }
        const contentType = dl.headers.get("content-type") || "application/octet-stream";
        const buf = new Uint8Array(await dl.arrayBuffer());
        if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
          await adminClient.from("projeto_tarefa_anexos").update({
            tipo_arquivo: "asana_too_large",
          }).eq("id", row.id);
          results.push({ id: row.id, status: "too_large" });
          failed++;
          continue;
        }

        const safeName = sanitizeFilename(att.name || row.nome || "attachment");
        const storagePath = `imported/asana/${row.tarefa_id}/${row.asana_gid}-${safeName}`;

        const { error: upErr } = await adminClient.storage
          .from("projeto-anexos")
          .upload(storagePath, buf, { contentType, upsert: true });
        if (upErr) {
          results.push({ id: row.id, status: "upload_failed", error: upErr.message });
          failed++;
          continue;
        }

        await adminClient.from("projeto_tarefa_anexos").update({
          storage_path: storagePath,
          tipo_arquivo: contentType,
          tamanho: buf.byteLength,
        }).eq("id", row.id);

        results.push({ id: row.id, status: "imported" });
        imported++;
      } catch (e: any) {
        results.push({ id: row.id, status: "error", error: String(e?.message || e) });
        failed++;
      }
    }

    return json({
      processed: rows?.length ?? 0,
      imported,
      expired,
      failed,
      remaining: Math.max(0, (pending ?? 0) - imported - expired - failed),
      results,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

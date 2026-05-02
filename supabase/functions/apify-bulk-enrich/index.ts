// Enriquecimento em lote via Apify de todos os influenciadores monitorados.
// Reaproveita a edge function apify-sync-influencer item a item, com concorrência limitada.
// Grava cada execução em apify_run_log com batch_id para acompanhamento de progresso.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const CONCURRENCY = 3;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { influencer_ids, only_missing } = body ?? {};

    let query = serviceClient.from("influencers").select("id, avatar_url, followers_count").eq("status", "active");
    if (Array.isArray(influencer_ids) && influencer_ids.length > 0) {
      query = query.in("id", influencer_ids.filter((x: any) => typeof x === "string"));
    }
    const { data: rows, error: listErr } = await query;
    if (listErr) {
      return new Response(JSON.stringify({ error: listErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let targets = (rows ?? []).map((r: any) => r.id as string);
    if (only_missing) {
      targets = (rows ?? [])
        .filter((r: any) => !r.avatar_url || !r.followers_count || r.followers_count === 0)
        .map((r: any) => r.id as string);
    }

    if (targets.length === 0) {
      return new Response(JSON.stringify({ data: { batch_id: null, total: 0, message: "Nenhum influenciador para processar" } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const batchId = crypto.randomUUID();

    // Marca start no log para o frontend conseguir contar
    await serviceClient.from("apify_run_log").insert({
      user_id: user.id,
      actor_id: "bulk-enrich:start",
      batch_id: batchId,
      status: "ok",
      duration_ms: 0,
      items_count: targets.length,
      input_summary: { total: targets.length, only_missing: !!only_missing },
    });

    // Dispara em background — não aguarda terminar
    const runBatch = async () => {
      const queue = [...targets];
      const workers: Promise<void>[] = [];
      for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
        workers.push((async () => {
          while (queue.length > 0) {
            const id = queue.shift();
            if (!id) break;
            const started = Date.now();
            try {
              const res = await fetch(`${supabaseUrl}/functions/v1/apify-sync-influencer`, {
                method: "POST",
                headers: { Authorization: authHeader, "Content-Type": "application/json" },
                body: JSON.stringify({ influencer_id: id }),
              });
              const json = await res.json().catch(() => ({}));
              const r = json?.data?.results?.[0];
              await serviceClient.from("apify_run_log").insert({
                user_id: user.id,
                actor_id: "bulk-enrich:item",
                batch_id: batchId,
                status: r?.ok ? "ok" : "error",
                duration_ms: Date.now() - started,
                items_count: r?.posts_upserted ?? 0,
                error_message: r?.ok ? null : (r?.error ?? "sync_failed"),
                input_summary: { influencer_id: id },
              });
            } catch (err) {
              await serviceClient.from("apify_run_log").insert({
                user_id: user.id,
                actor_id: "bulk-enrich:item",
                batch_id: batchId,
                status: "error",
                duration_ms: Date.now() - started,
                items_count: 0,
                error_message: err instanceof Error ? err.message : "unknown",
                input_summary: { influencer_id: id },
              });
            }
          }
        })());
      }
      await Promise.all(workers);
      await serviceClient.from("apify_run_log").insert({
        user_id: user.id,
        actor_id: "bulk-enrich:done",
        batch_id: batchId,
        status: "ok",
        duration_ms: 0,
        items_count: targets.length,
      });
    };

    // EdgeRuntime.waitUntil para manter execução depois da resposta
    // @ts-ignore deno deploy
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runBatch());
    } else {
      runBatch().catch((e) => logger.error("bulk enrich failed", e));
    }

    return new Response(JSON.stringify({ data: { batch_id: batchId, total: targets.length } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    logger.error("apify-bulk-enrich error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

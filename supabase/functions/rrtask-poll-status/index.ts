// Edge Function: rrtask-poll-status
//
// Dois modos:
//
// 1) Modo CRON (sem body OU body vazio):
//    - Disparado por pg_cron a cada 5 min.
//    - Autenticação por header `x-cron-secret` (timingSafeEqual com vault).
//    - Cadência: 5 min em horário comercial (08-18 BRT), 15 min fora.
//    - Processa lote round-robin de até 200 briefings (ordenado por last_polled_at).
//
// 2) Modo SINGLE on-demand (body: { briefing_id }):
//    - Autenticação por JWT do usuário (Authorization: Bearer ...).
//    - Só processa o briefing solicitado, sem janela de cadência.
//    - Usado pela UI para refletir o status da agência ao abrir o briefing,
//      como reforço caso o webhook do Notion ainda não tenha entregue.
//
// Toda a lógica de leitura+update vive em _shared/rrtask-apply-page.ts e é
// compartilhada com `rrtask-webhook` (push do Notion).
import { createClient } from "npm:@supabase/supabase-js@2";
import { timingSafeEqual } from "https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { applyRrtaskPage, type BriefingMirrorRow } from "../_shared/rrtask-apply-page.ts";

const BATCH_SIZE = 200;

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 60, rateLimitPrefix: "rrtask-poll-status" },
  async (req) => {
    const corsHeaders = getCorsHeaders(req);
    const J = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const rrToken = Deno.env.get("HUGGS_RR_TOKEN");
    if (!rrToken) return J({ ok: false, error: "rr_token_missing" }, 412);

    // Lê body (pode ser vazio em chamadas do cron).
    let body: { briefing_id?: string } = {};
    try {
      const raw = await req.text();
      if (raw && raw.trim().length > 0) body = JSON.parse(raw);
    } catch {
      return J({ ok: false, error: "invalid_json" }, 400);
    }

    // ===================== MODO SINGLE (on-demand, JWT) =====================
    if (body.briefing_id && typeof body.briefing_id === "string") {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) {
        return J({ ok: false, error: "unauthorized" }, 401);
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claims?.claims?.sub) {
        return J({ ok: false, error: "unauthorized" }, 401);
      }

      const { data: row, error: rowErr } = await admin
        .from("briefings")
        .select("id, rrtask_page_id, rrtask_last_edited_time, rrtask_aprovacao, rrtask_data_aprovacao, tarefa_id")
        .eq("id", body.briefing_id)
        .maybeSingle();

      if (rowErr) return J({ ok: false, error: rowErr.message }, 500);
      if (!row || !row.rrtask_page_id) {
        return J({ ok: true, skipped: "no_rrtask_page" });
      }

      const outcome = await applyRrtaskPage({
        sb: admin,
        rrToken,
        briefing: row as BriefingMirrorRow,
        source: "poll",
      });
      return J({ ok: true, mode: "single", outcome });
    }

    // ===================== MODO CRON (lote, cron-secret) =====================
    const provided = req.headers.get("x-cron-secret") ?? "";
    const { data: expected, error: vaultErr } = await admin.rpc(
      "_get_rrtask_cron_secret",
    );
    if (vaultErr || !expected || !provided) {
      return J({ ok: false, error: "forbidden" }, 403);
    }
    const enc = new TextEncoder();
    const a = enc.encode(provided);
    const b = enc.encode(expected as string);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return J({ ok: false, error: "forbidden" }, 403);
    }

    // Janela de cadência: 5 min comercial / 15 min fora.
    const now = new Date();
    const horaBRT = (now.getUTCHours() - 3 + 24) % 24;
    const comercial = horaBRT >= 8 && horaBRT < 18;
    if (!comercial && now.getUTCMinutes() % 15 !== 0) {
      return J({ ok: true, skipped: "fora_de_janela", hora_brt: horaBRT });
    }

    const { data: rows, error: rowsErr } = await admin
      .from("briefings")
      .select(
        "id, rrtask_page_id, rrtask_last_edited_time, rrtask_aprovacao, rrtask_data_aprovacao, tarefa_id",
      )
      .not("rrtask_page_id", "is", null)
      .order("rrtask_last_polled_at", { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (rowsErr) return J({ ok: false, error: rowsErr.message }, 500);

    let atualizadas = 0;
    let writeBacks = 0;
    let erros = 0;
    let semMudanca = 0;

    for (const r of rows ?? []) {
      try {
        const outcome = await applyRrtaskPage({
          sb: admin,
          rrToken,
          briefing: r as BriefingMirrorRow,
          source: "poll",
        });
        if (outcome.kind === "updated") {
          atualizadas++;
          if (outcome.write_back) writeBacks++;
        } else if (outcome.kind === "no_change" || outcome.kind === "archived") {
          semMudanca++;
        } else {
          erros++;
        }
      } catch (e) {
        erros++;
        console.error(`[rrtask-poll-status] briefing ${r.id}`, e);
      }
    }

    return J({
      ok: true,
      mode: "cron",
      processadas: rows?.length ?? 0,
      atualizadas,
      sem_mudanca: semMudanca,
      write_backs: writeBacks,
      erros,
    });
  },
));

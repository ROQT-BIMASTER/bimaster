// Edge Function: rrtask-poll-status
// Fase 2 — Lê o status das tasks RR-Tasks (Notion da agência) e espelha de
// volta nas colunas rrtask_* da tabela `briefings`.
//
// - Chamada agendada (pg_cron */5 * * * *).
// - Protegida por `Authorization: Bearer <service_role JWT>` — validação via
//   `supabase.auth.getClaims(token)` checando `claims.role === 'service_role'`
//   (mesmo padrão do `asana-sync`; aceita tanto a chave legacy quanto a do
//   sistema novo de signing-keys, ao contrário de comparação literal de string).
//   O cron `rrtask-poll-status-every-5min` monta o header com
//   `_get_vault_secret('email_queue_service_role_key')`.
// - Cadência efetiva: 5 min em horário comercial (08-18 BRT), 15 min fora.
// - Leitura apenas, EXCETO write-back da "Data Aprovação Conteúdo" (regra R09)
//   quando "Aprovação de Conteúdo" = "Aprovado" e a data está vazia.
import { createClient } from "npm:@supabase/supabase-js@2";
import { secureHandler } from "../_shared/secure-handler.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { notion, type NotionPage } from "../_shared/notion-client.ts";

const BATCH_SIZE = 200;

// Opção A: ISO-8601 com offset BRT (-03:00) carimbado no momento do write-back.
function isoBrtNow(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().replace("Z", "-03:00");
}

const sel = (p: unknown) =>
  (p as { select?: { name?: string } } | null)?.select?.name ?? null;
const st = (p: unknown) =>
  (p as { status?: { name?: string } } | null)?.status?.name ?? null;
const dt = (p: unknown) =>
  (p as { date?: { start?: string } } | null)?.date?.start ?? null;

Deno.serve(secureHandler(
  { auth: "none", rateLimit: 30, rateLimitPrefix: "rrtask-poll-status" },
  async (req) => {
    const corsHeaders = getCorsHeaders(req);
    const J = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // 1. Authorization: Bearer <service_role JWT> — valida via getClaims
    //    (mesmo padrão do asana-sync; aceita legacy e signing-keys)
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    if (!token) return J({ ok: false, error: "forbidden" }, 403);

    const sbAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claimsData, error: claimsErr } = await sbAuth.auth.getClaims(token);
    if (claimsErr || claimsData?.claims?.role !== "service_role") {
      return J({ ok: false, error: "forbidden" }, 403);
    }

    // 2. Janela de cadência: 5 min comercial / 15 min fora
    const now = new Date();
    const horaBRT = (now.getUTCHours() - 3 + 24) % 24;
    const comercial = horaBRT >= 8 && horaBRT < 18;
    if (!comercial && now.getUTCMinutes() % 15 !== 0) {
      return J({ ok: true, skipped: "fora_de_janela", hora_brt: horaBRT });
    }

    const rrToken = Deno.env.get("HUGGS_RR_TOKEN");
    if (!rrToken) return J({ ok: false, error: "rr_token_missing" }, 412);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 3. Briefings com page no RR-Tasks — round-robin por last_polled_at
    const { data: rows, error: rowsErr } = await sb
      .from("briefings")
      .select(
        "id, rrtask_page_id, rrtask_last_edited_time, rrtask_aprovacao, rrtask_data_aprovacao",
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
        const page = await notion<NotionPage>(rrToken, `/pages/${r.rrtask_page_id}`);
        if (!page.ok || !page.data) {
          erros++;
          await sb.from("rrtask_sync_log").insert({
            briefing_id: r.id,
            action: "poll",
            status: "error",
            rrtask_page_id: r.rrtask_page_id,
            error_message: `notion_${page.status}: ${page.errorText?.slice(0, 200) ?? ""}`,
          });
          continue;
        }
        if (page.data.archived || page.data.in_trash) {
          // Não atualiza nem registra erro — só carimba o poll para round-robin
          await sb
            .from("briefings")
            .update({ rrtask_last_polled_at: new Date().toISOString() })
            .eq("id", r.id);
          continue;
        }

        const lastEdited = page.data.last_edited_time ?? null;

        // Skip rápido: nada mudou. Apenas carimba last_polled_at.
        if (lastEdited && lastEdited === r.rrtask_last_edited_time) {
          await sb
            .from("briefings")
            .update({ rrtask_last_polled_at: new Date().toISOString() })
            .eq("id", r.id);
          semMudanca++;
          continue;
        }

        const P = (page.data.properties ?? {}) as Record<string, unknown>;
        const aprov = sel(P["Aprovação de Conteúdo"]);
        const status = st(P["Status"]);
        const etapa = sel(P["Etapa"]);
        let dataAprov = dt(P["Data Aprovação Conteúdo"]);

        // R09 write-back: Aprovado + data vazia → carimbar agora (BRT)
        if (aprov === "Aprovado" && !dataAprov) {
          const iso = isoBrtNow();
          const patch = await notion(rrToken, `/pages/${r.rrtask_page_id}`, {
            method: "PATCH",
            body: JSON.stringify({
              properties: {
                "Data Aprovação Conteúdo": { date: { start: iso } },
              },
            }),
          });
          if (patch.ok) {
            dataAprov = iso;
            writeBacks++;
          } else {
            await sb.from("rrtask_sync_log").insert({
              briefing_id: r.id,
              action: "poll",
              status: "error",
              rrtask_page_id: r.rrtask_page_id,
              error_message: `r09_writeback_${patch.status}: ${patch.errorText?.slice(0, 200) ?? ""}`,
            });
          }
        }

        const { error: upErr } = await sb
          .from("briefings")
          .update({
            rrtask_aprovacao: aprov,
            rrtask_status: status,
            rrtask_etapa: etapa,
            rrtask_data_aprovacao: dataAprov ? dataAprov.slice(0, 10) : null,
            rrtask_last_edited_time: lastEdited,
            rrtask_last_polled_at: new Date().toISOString(),
          })
          .eq("id", r.id);

        if (upErr) {
          erros++;
          await sb.from("rrtask_sync_log").insert({
            briefing_id: r.id,
            action: "poll",
            status: "error",
            rrtask_page_id: r.rrtask_page_id,
            error_message: `db_update: ${upErr.message}`,
          });
          continue;
        }

        atualizadas++;
        await sb.from("rrtask_sync_log").insert({
          briefing_id: r.id,
          action: "poll",
          status: "success",
          rrtask_page_id: r.rrtask_page_id,
        });
      } catch (e) {
        erros++;
        console.error(`[rrtask-poll-status] briefing ${r.id}`, e);
        await sb.from("rrtask_sync_log").insert({
          briefing_id: r.id,
          action: "poll",
          status: "error",
          rrtask_page_id: r.rrtask_page_id,
          error_message: (e as Error)?.message?.slice(0, 300) ?? "unknown",
        }).then(() => {}, () => {});
      }
    }

    return J({
      ok: true,
      processadas: rows?.length ?? 0,
      atualizadas,
      sem_mudanca: semMudanca,
      write_backs: writeBacks,
      erros,
    });
  },
));

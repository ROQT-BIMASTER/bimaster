// Shared helper: reads a Notion RR-Tasks page and mirrors its status fields
// onto the corresponding `briefings` row. Used by both the scheduled poller
// (`rrtask-poll-status`) and the Notion webhook receiver (`rrtask-webhook`).
//
// Returns a small report so callers can log/aggregate counters.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notion, type NotionPage } from "./notion-client.ts";

export type ApplyOutcome =
  | { kind: "updated"; write_back: boolean }
  | { kind: "no_change" }
  | { kind: "archived" }
  | { kind: "error"; message: string; status?: number };

export interface BriefingMirrorRow {
  id: string;
  rrtask_page_id: string;
  rrtask_last_edited_time: string | null;
  rrtask_aprovacao?: string | null;
  rrtask_data_aprovacao?: string | null;
  tarefa_id?: string | null;
}

const sel = (p: unknown) =>
  (p as { select?: { name?: string } } | null)?.select?.name ?? null;
const st = (p: unknown) =>
  (p as { status?: { name?: string } } | null)?.status?.name ?? null;
const dt = (p: unknown) =>
  (p as { date?: { start?: string } } | null)?.date?.start ?? null;

function isoBrtNow(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().replace("Z", "-03:00");
}

/**
 * Reads the Notion page and patches the matching briefing row.
 * Also handles the R09 write-back ("Data Aprovação Conteúdo" when status = Aprovado and date empty).
 * Always stamps `rrtask_last_polled_at`.
 */
export async function applyRrtaskPage(opts: {
  sb: SupabaseClient;
  rrToken: string;
  briefing: BriefingMirrorRow;
  source: "poll" | "webhook";
}): Promise<ApplyOutcome> {
  const { sb, rrToken, briefing, source } = opts;
  const nowIso = new Date().toISOString();

  const page = await notion<NotionPage>(rrToken, `/pages/${briefing.rrtask_page_id}`);
  if (!page.ok || !page.data) {
    const msg = `notion_${page.status}: ${page.errorText?.slice(0, 200) ?? ""}`;
    await sb.from("rrtask_sync_log").insert({
      briefing_id: briefing.id,
      action: source,
      status: "error",
      rrtask_page_id: briefing.rrtask_page_id,
      error_message: msg,
    });
    return { kind: "error", message: msg, status: page.status };
  }

  if (page.data.archived || page.data.in_trash) {
    await sb
      .from("briefings")
      .update({ rrtask_last_polled_at: nowIso })
      .eq("id", briefing.id);
    return { kind: "archived" };
  }

  const lastEdited = page.data.last_edited_time ?? null;

  // No diff → just stamp polled_at.
  if (lastEdited && lastEdited === briefing.rrtask_last_edited_time) {
    await sb
      .from("briefings")
      .update({ rrtask_last_polled_at: nowIso })
      .eq("id", briefing.id);
    return { kind: "no_change" };
  }

  const P = (page.data.properties ?? {}) as Record<string, unknown>;
  const aprov = sel(P["Aprovação de Conteúdo"]);
  const status = st(P["Status"]);
  const etapa = sel(P["Etapa"]);
  let dataAprov = dt(P["Data Aprovação Conteúdo"]);

  let writeBack = false;
  if (aprov === "Aprovado" && !dataAprov) {
    const iso = isoBrtNow();
    const patch = await notion(rrToken, `/pages/${briefing.rrtask_page_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          "Data Aprovação Conteúdo": { date: { start: iso } },
        },
      }),
    });
    if (patch.ok) {
      dataAprov = iso;
      writeBack = true;
    } else {
      await sb.from("rrtask_sync_log").insert({
        briefing_id: briefing.id,
        action: source,
        status: "error",
        rrtask_page_id: briefing.rrtask_page_id,
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
      rrtask_last_polled_at: nowIso,
    })
    .eq("id", briefing.id);

  if (upErr) {
    await sb.from("rrtask_sync_log").insert({
      briefing_id: briefing.id,
      action: source,
      status: "error",
      rrtask_page_id: briefing.rrtask_page_id,
      error_message: `db_update: ${upErr.message}`,
    });
    return { kind: "error", message: upErr.message };
  }

  // PR-D2b-fix: espelha status/etapa na projeto_tarefa nativa, pareando por
  // rrtask_page_id (chave única real do RR). briefings.tarefa_id fica 100%
  // do fluxo de tarefas genéricas — não é mais usado pelo espelho RR.
  if (briefing.rrtask_page_id) {
    try {
      await sb.from("projeto_tarefas")
        .update({ status, estagio: etapa, updated_at: nowIso })
        .eq("rrtask_page_id", briefing.rrtask_page_id);
    } catch (e) {
      console.error(`[rrtask-apply-page] mirror page ${briefing.rrtask_page_id}`, e);
    }
  }

  await sb.from("rrtask_sync_log").insert({
    briefing_id: briefing.id,
    action: source,
    status: "success",
    rrtask_page_id: briefing.rrtask_page_id,
  });

  return { kind: "updated", write_back: writeBack };
}

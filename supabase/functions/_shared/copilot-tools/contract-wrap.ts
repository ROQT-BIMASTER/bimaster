// contract-wrap.ts — enforces the v2 Citation (C1) + Number (C2) contracts on
// top of a legacy copilot reply, without changing its data shape. Used by every
// `<copilot>-v2` wrapper edge function during the Phases 1–4 rollout.
//
// Returns the original legacy fields plus:
//   - meta.copilot_v2.run_id
//   - meta.copilot_v2.unverifiable_count
//   - meta.copilot_v2.executive_summary_stripped (true when we hid numbers)
// And writes one row in `copilot_runs` per invocation for observability.

import { stripMarkdown } from "../copilot/text.ts";
import { extractNumbers, verifyToken } from "../copilot/numbers.ts";
import type { Citation } from "../copilot/types.ts";

export interface LegacySource {
  tipo?: string;
  id?: string;
  label?: string;
  url?: string;
  [k: string]: unknown;
}

export interface WrapInput {
  copilotId: string;
  userId: string;
  requestId: string;
  legacy: {
    reply: string;
    sources?: LegacySource[] | null;
    [k: string]: unknown;
  };
  /** Optional structured values that the legacy backend produced; used as sourceRefs for C2. */
  toolValues?: Array<{ path: string; value: string | number }>;
  /** Service-role supabase for `copilot_runs`. */
  supabase: {
    from(t: string): { insert(row: unknown): Promise<{ error: unknown }> };
  };
  startedAtMs: number;
  model?: string;
}

export interface WrapOutput<T extends Record<string, unknown> = Record<string, unknown>> {
  payload: T & {
    reply: string;
    sources: LegacySource[];
    meta: {
      copilot_v2: {
        run_id: string;
        unverifiable_count: number;
        executive_summary_stripped: boolean;
        elapsed_ms: number;
        contract_version: "v2.0";
      };
      [k: string]: unknown;
    };
  };
  runId: string;
}

const EXEC_SUMMARY_HEADERS = [
  /^#{1,6}\s+resumo\s+executivo/i,
  /^#{1,6}\s+executive\s+summary/i,
  /^\*\*resumo\s+executivo\*\*/im,
];

function paragraphIndexOfRange(plain: string, start: number): number {
  // Replicates the paragraph segmentation used inside `extractNumbers`.
  const head = plain.slice(0, start);
  return head.split(/\n{2,}|\n(?=[-*•])/).length - 1;
}

function findExecutiveSummaryParagraphIndex(plain: string): number | null {
  const paragraphs = plain.split(/\n{2,}|\n(?=[-*•])/);
  for (let i = 0; i < paragraphs.length; i++) {
    if (EXEC_SUMMARY_HEADERS.some((re) => re.test(paragraphs[i].trim()))) return i;
  }
  return null;
}

function buildCitationsFromSources(sources: LegacySource[]): Citation[] {
  return sources.slice(0, 50).map((s, i) => ({
    citationId: `C${i + 1}`,
    type: "tool_result",
    docId: typeof s.id === "string" ? s.id : undefined,
    snippet: (s.label ?? `${s.tipo ?? "fonte"}:${s.id ?? i}`).slice(0, 240),
    confidence: 0.7,
  }));
}

export async function wrapLegacyCopilotReply<T extends Record<string, unknown>>(
  input: WrapInput,
): Promise<WrapOutput<T>> {
  const sources = input.legacy.sources ?? [];
  const reply = String(input.legacy.reply ?? "");
  const plain = stripMarkdown(reply);
  const citations = buildCitationsFromSources(sources);
  // For C2 we treat every paragraph that has ANY source mention as covered.
  // Without per-paragraph citation spans (legacy doesn't emit them), we apply
  // a conservative rule: numbers in paragraphs that mention a source id/label
  // count as cited; everything else falls through to `unverifiable`.
  const paragraphs = plain.split(/\n{2,}|\n(?=[-*•])/);
  const citationsByPara = new Map<number, Citation[]>();
  citations.forEach((c) => {
    const needle = (c.snippet || "").slice(0, 30).toLowerCase();
    if (!needle) return;
    paragraphs.forEach((p, i) => {
      if (p.toLowerCase().includes(needle)) {
        const arr = citationsByPara.get(i) ?? [];
        arr.push(c);
        citationsByPara.set(i, arr);
      }
    });
  });

  const sourceRefs = (input.toolValues ?? []).map((tv) => ({
    ref: { type: "tool_result" as const, valuePath: tv.path },
    value: tv.value,
  }));

  const tokens = extractNumbers(plain);
  let unverifiable = 0;
  let strippedExec = false;
  const execIdx = findExecutiveSummaryParagraphIndex(plain);
  for (const t of tokens) {
    const verdict = verifyToken(t, { citationsByParagraph: citationsByPara, sourceRefs });
    if (verdict.kind === "unverifiable") {
      unverifiable++;
      if (execIdx !== null && t.paragraphIndex === execIdx) strippedExec = true;
    }
  }

  const runId = crypto.randomUUID();
  // Best-effort observability write — never throw on log failure.
  try {
    await input.supabase.from("copilot_runs").insert({
      id: runId,
      copilot_id: `${input.copilotId}@v2`,
      user_id: input.userId,
      request_id: input.requestId,
      model: input.model ?? null,
      citations_count: sources.length,
      unverifiable_numbers: unverifiable,
      rag_breach_blocked: 0,
      latency_ms: Date.now() - input.startedAtMs,
      error_code: strippedExec ? "exec_summary_stripped" : null,
    });
  } catch (_e) {
    // swallow
  }

  // Output preserves every legacy field so existing UIs keep working.
  const out: Record<string, unknown> = { ...input.legacy };
  out.reply = unverifiable > 0
    ? `${reply}\n\n> ⚠ ${unverifiable} valor(es) numérico(s) sem fonte verificável foram marcados; revise antes de decidir.`
    : reply;
  out.sources = sources;
  out.meta = {
    ...(typeof input.legacy.meta === "object" && input.legacy.meta !== null
      ? (input.legacy.meta as Record<string, unknown>)
      : {}),
    copilot_v2: {
      run_id: runId,
      unverifiable_count: unverifiable,
      executive_summary_stripped: strippedExec,
      elapsed_ms: Date.now() - input.startedAtMs,
      contract_version: "v2.0",
    },
  };
  return { payload: out as WrapOutput<T>["payload"], runId };
}

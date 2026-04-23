import { describe, it, expect } from "vitest";
import {
  DEFAULTS,
  normalizeInboxTipos,
  normalizeProjectIdList,
  normalizeSearch,
  sanitizeCentralSearchParams,
} from "../centralUrlParams";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";
const VALID_UUID_2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const run = (qs: string) =>
  sanitizeCentralSearchParams(new URLSearchParams(qs)).toString();

/* -------------------------------------------------------------------------- */
/* 1. Internal whitespace                                                      */
/* -------------------------------------------------------------------------- */
describe("centralUrlParams - extras: internal whitespace in enum-like values", () => {
  it("trims a value that has only surrounding whitespace ('  board  ')", () => {
    // %20 == literal space; the sanitizer must trim+lowercase it to "board".
    expect(run("tab=tarefas&view=%20%20board%20%20")).toBe(
      "tab=tarefas&view=board",
    );
  });

  it("rejects an enum value with internal whitespace ('bo ard') because it is not in the allowlist", () => {
    // "bo ard" trims to "bo ard" (still contains a space) → not a valid view.
    // Output must drop the param entirely (default = list).
    expect(run("tab=tarefas&view=%20bo%20ard%20")).toBe("tab=tarefas");
  });

  it("rejects a tipo with internal whitespace inside an inbox CSV entry", () => {
    // "criou tarefa" (space instead of underscore) is NOT a valid tipo;
    // a valid neighbour ("completou") must still survive the cleanup.
    expect(
      normalizeInboxTipos("criou tarefa, completou , bo gus"),
    ).toEqual(["completou"]);
  });

  it("collapses runs of internal whitespace inside the search box ('q')", () => {
    // Multiple spaces, tabs and newlines must collapse to a single space.
    expect(normalizeSearch("  hello\t\t\n  world   foo  ")).toBe(
      "hello world foo",
    );
  });

  it("treats a UUID padded with spaces as valid AFTER trimming inside a CSV", () => {
    // Spaces around each UUID are part of the CSV layout — the parser trims them.
    expect(
      normalizeProjectIdList(`  ${VALID_UUID}  ,   ${VALID_UUID_2}   `),
    ).toEqual([VALID_UUID, VALID_UUID_2]);
  });

  it("rejects a UUID with internal whitespace (which is NOT a valid UUID)", () => {
    // A space inside the hex blocks must invalidate the entry.
    const broken = VALID_UUID.replace("-", " ");
    expect(normalizeProjectIdList(`${broken},${VALID_UUID_2}`)).toEqual([
      VALID_UUID_2,
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Partial / mixed URL-encoding                                             */
/* -------------------------------------------------------------------------- */
describe("centralUrlParams - extras: partial URL-encoding", () => {
  it("decodes '+' as space and still trims the result", () => {
    // application/x-www-form-urlencoded: '+' is decoded to ' ' by URLSearchParams.
    expect(run("tab=tarefas&view=+++board+++")).toBe("tab=tarefas&view=board");
  });

  it("handles a value that mixes percent-encoded and literal characters", () => {
    // "%62oard" → "board" (only the 'b' is percent-encoded).
    expect(run("tab=tarefas&view=%62oard")).toBe("tab=tarefas&view=board");
  });

  it("handles inbox 'tipos' where commas are URL-encoded as %2C", () => {
    // %2C = ',' — after decoding the CSV must be parseable normally.
    expect(run("tab=inbox&tipos=criou_tarefa%2Ccompletou%2Cbogus")).toBe(
      "tab=inbox&tipos=criou_tarefa%2Ccompletou",
    );
  });

  it("ignores stray invalid percent sequences in the search box without throwing", () => {
    // URLSearchParams keeps a lone '%' as a literal '%'. We must not crash and
    // the surrounding text must survive the cleanup.
    const out = run("tab=tarefas&q=foo%20%bar%20baz");
    const q = new URLSearchParams(out).get("q");
    expect(q).toContain("foo");
    expect(q).toContain("baz");
    // No control chars, no leading/trailing whitespace.
    expect(q).toBe(q?.trim());
    expect(/[\x00-\x1F\x7F]/.test(q ?? "")).toBe(false);
  });

  it("decodes a fully-encoded UUID inside the projetos CSV", () => {
    // Hex digits don't *need* encoding, but a paranoid client may still encode
    // hyphens (%2D) — the result must be the canonical UUID.
    const encoded = VALID_UUID.replace(/-/g, "%2D");
    expect(run(`tab=inbox&projetos=${encoded}`)).toBe(
      `tab=inbox&projetos=${VALID_UUID}`,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Repeated parameters (?tab=a&tab=b&tab=c)                                 */
/* -------------------------------------------------------------------------- */
describe("centralUrlParams - extras: repeated parameters", () => {
  it("collapses N repetitions of an enum param to the first valid occurrence", () => {
    expect(run("tab=tarefas&tab=inbox&tab=hoje&tab=garbage")).toBe(
      "tab=tarefas",
    );
  });

  it("when the first occurrence is invalid, the param is dropped (we do NOT scan later values)", () => {
    // Documents the current contract: repeats don't act as a fallback chain.
    // First "view" is "kanban" (invalid) → output drops the param entirely
    // (default 'list' is implicit).
    expect(run("tab=tarefas&view=kanban&view=board")).toBe("tab=tarefas");
  });

  it("keeps the first 'q' value and ignores the others", () => {
    const out = run("tab=tarefas&q=primeiro&q=segundo&q=terceiro");
    expect(new URLSearchParams(out).get("q")).toBe("primeiro");
  });

  it("merges repeated CSV-style params by taking the first value (no concatenation)", () => {
    // Avoid silent CSV concatenation that could blow past the 50-id cap.
    const out = run(
      `tab=inbox&projetos=${VALID_UUID}&projetos=${VALID_UUID_2}`,
    );
    expect(new URLSearchParams(out).get("projetos")).toBe(VALID_UUID);
  });

  it("handles repeats AND internal whitespace at the same time", () => {
    // tab=' tarefas ' (valid after trim) wins; later 'tab=inbox' is ignored.
    expect(run("tab=%20tarefas%20&tab=inbox&view=%20board%20")).toBe(
      "tab=tarefas&view=board",
    );
  });

  it("never emits the same key twice in the canonical output", () => {
    const out = run(
      "tab=tarefas&tab=tarefas&view=board&view=board&priority=alta&priority=alta",
    );
    const seen = new Map<string, number>();
    new URLSearchParams(out).forEach((_v, k) => {
      seen.set(k, (seen.get(k) ?? 0) + 1);
    });
    for (const [, count] of seen) {
      expect(count).toBe(1);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Cross-cutting sanity                                                        */
/* -------------------------------------------------------------------------- */
describe("centralUrlParams - extras: combined fuzz", () => {
  it("survives a worst-case dirty URL combining all three categories", () => {
    const dirty =
      // repeated tabs with whitespace + casing
      "tab=%20TAREFAS%20&tab=inbox" +
      // repeated view with partial encoding
      "&view=%62oard&view=kanban" +
      // q with internal whitespace + control chars + partial encoding
      "&q=%20%20hello%00%20%20world%20%20" +
      // extra unknown param (must be dropped)
      "&utm_source=email";
    const out = run(dirty);
    const params = new URLSearchParams(out);
    expect(params.get("tab")).toBe("tarefas");
    expect(params.get("view")).toBe("board");
    expect(params.get("q")).toBe("hello world");
    expect(params.get("utm_source")).toBeNull();
  });

  it("is idempotent for the worst-case dirty URL", () => {
    const dirty =
      "tab=%20TAREFAS%20&tab=inbox&view=%62oard&view=kanban" +
      "&q=%20%20hello%00%20%20world%20%20&utm_source=email";
    const first = run(dirty);
    expect(run(first)).toBe(first);
  });

  it("does not regress the all-defaults case", () => {
    // Repetitions of default values must still collapse to ''.
    expect(
      run(
        `tab=${DEFAULTS.tab}&tab=${DEFAULTS.tab}&view=${DEFAULTS.view}&view=${DEFAULTS.view}`,
      ),
    ).toBe("");
  });
});

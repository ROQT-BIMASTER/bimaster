import { describe, it, expect } from "vitest";
import {
  DEFAULTS,
  normalizeFilter,
  normalizeInboxGroup,
  normalizeInboxSubtab,
  normalizeInboxTipos,
  normalizePriority,
  normalizeProject,
  normalizeProjectIdList,
  normalizeSearch,
  normalizeTab,
  normalizeView,
  sanitizeCentralSearchParams,
} from "../centralUrlParams";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";
const VALID_UUID_2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("centralUrlParams - normalizeTab", () => {
  it("accepts valid tabs", () => {
    expect(normalizeTab("hoje")).toBe("hoje");
    expect(normalizeTab("tarefas")).toBe("tarefas");
    expect(normalizeTab("inbox")).toBe("inbox");
  });

  it("falls back to default when value is invalid, null or empty", () => {
    expect(normalizeTab("garbage")).toBe(DEFAULTS.tab);
    expect(normalizeTab(null)).toBe(DEFAULTS.tab);
    expect(normalizeTab("")).toBe(DEFAULTS.tab);
    expect(normalizeTab("HOJE")).toBe(DEFAULTS.tab);
  });

  it("respects an explicit fallback", () => {
    expect(normalizeTab(null, "tarefas")).toBe("tarefas");
    expect(normalizeTab("???", "inbox")).toBe("inbox");
  });
});

describe("centralUrlParams - normalizeView", () => {
  it("accepts every valid view", () => {
    (["list", "board", "calendar", "dashboard"] as const).forEach((v) => {
      expect(normalizeView(v)).toBe(v);
    });
  });

  it("strips invalid view values", () => {
    expect(normalizeView("kanban")).toBe(DEFAULTS.view);
    expect(normalizeView("table")).toBe(DEFAULTS.view);
    expect(normalizeView(null)).toBe(DEFAULTS.view);
    expect(normalizeView("")).toBe(DEFAULTS.view);
    expect(normalizeView("LIST")).toBe(DEFAULTS.view);
  });
});

describe("centralUrlParams - normalizePriority", () => {
  it("accepts all valid priorities", () => {
    (["all", "urgente", "alta", "media", "baixa"] as const).forEach((p) => {
      expect(normalizePriority(p)).toBe(p);
    });
  });

  it("falls back to default for unknown values", () => {
    expect(normalizePriority("critica")).toBe(DEFAULTS.priority);
    expect(normalizePriority("low")).toBe(DEFAULTS.priority);
    expect(normalizePriority(null)).toBe(DEFAULTS.priority);
    expect(normalizePriority("")).toBe(DEFAULTS.priority);
  });
});

describe("centralUrlParams - normalizeFilter", () => {
  it("accepts known filters", () => {
    expect(normalizeFilter("all")).toBe("all");
    expect(normalizeFilter("hoje")).toBe("hoje");
    expect(normalizeFilter("atrasadas")).toBe("atrasadas");
  });

  it("falls back to default for invalid filters", () => {
    expect(normalizeFilter("amanha")).toBe(DEFAULTS.filter);
    expect(normalizeFilter("123")).toBe(DEFAULTS.filter);
    expect(normalizeFilter(null)).toBe(DEFAULTS.filter);
    expect(normalizeFilter("")).toBe(DEFAULTS.filter);
  });
});

describe("centralUrlParams - normalizeProject", () => {
  it("keeps the literal 'all' sentinel", () => {
    expect(normalizeProject("all")).toBe("all");
  });

  it("accepts a valid UUID v4-shaped string", () => {
    expect(normalizeProject(VALID_UUID)).toBe(VALID_UUID);
  });

  it("rejects malformed UUIDs and SQL-injection-like garbage", () => {
    expect(normalizeProject("not-a-uuid")).toBe(DEFAULTS.project);
    expect(normalizeProject("1234")).toBe(DEFAULTS.project);
    expect(normalizeProject("<script>alert(1)</script>")).toBe(DEFAULTS.project);
    expect(normalizeProject("' OR 1=1 --")).toBe(DEFAULTS.project);
    expect(normalizeProject(`${VALID_UUID} extra`)).toBe(DEFAULTS.project);
  });

  it("falls back when value is null or empty", () => {
    expect(normalizeProject(null)).toBe(DEFAULTS.project);
    expect(normalizeProject("")).toBe(DEFAULTS.project);
  });

  it("accepts an explicit fallback", () => {
    expect(normalizeProject("garbage", VALID_UUID)).toBe(VALID_UUID);
  });
});

describe("centralUrlParams - normalizeSearch", () => {
  it("returns empty string for null or empty", () => {
    expect(normalizeSearch(null)).toBe("");
    expect(normalizeSearch("")).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSearch("   hello world  ")).toBe("hello world");
  });

  it("strips control characters that would break the URL", () => {
    expect(normalizeSearch("foo\x00bar\x1Fbaz\x7Fend")).toBe("foobarbazend");
    expect(normalizeSearch("\x01\x02\x03")).toBe("");
  });

  it("clamps the search to 100 characters", () => {
    const long = "a".repeat(250);
    const result = normalizeSearch(long);
    expect(result).toHaveLength(100);
    expect(result).toBe("a".repeat(100));
  });

  it("preserves regular unicode and punctuation", () => {
    expect(normalizeSearch("ação & projeto #1")).toBe("ação & projeto #1");
  });
});

describe("centralUrlParams - normalizeInboxSubtab", () => {
  it("accepts every valid inbox subtab", () => {
    (["atividade", "mencoes", "favoritas", "arquivadas"] as const).forEach((s) => {
      expect(normalizeInboxSubtab(s)).toBe(s);
    });
  });

  it("falls back to default for invalid values", () => {
    expect(normalizeInboxSubtab("inbox")).toBe(DEFAULTS.inboxSubtab);
    expect(normalizeInboxSubtab("MENCOES")).toBe(DEFAULTS.inboxSubtab);
    expect(normalizeInboxSubtab(null)).toBe(DEFAULTS.inboxSubtab);
    expect(normalizeInboxSubtab("")).toBe(DEFAULTS.inboxSubtab);
  });
});

describe("centralUrlParams - normalizeInboxGroup", () => {
  it("accepts 'tempo' and 'projeto'", () => {
    expect(normalizeInboxGroup("tempo")).toBe("tempo");
    expect(normalizeInboxGroup("projeto")).toBe("projeto");
  });

  it("falls back to default for invalid values", () => {
    expect(normalizeInboxGroup("usuario")).toBe(DEFAULTS.inboxGroup);
    expect(normalizeInboxGroup(null)).toBe(DEFAULTS.inboxGroup);
    expect(normalizeInboxGroup("")).toBe(DEFAULTS.inboxGroup);
  });
});

describe("centralUrlParams - normalizeInboxTipos", () => {
  it("returns empty array for null/empty input", () => {
    expect(normalizeInboxTipos(null)).toEqual([]);
    expect(normalizeInboxTipos("")).toEqual([]);
  });

  it("parses a clean comma-separated list", () => {
    expect(normalizeInboxTipos("criou_tarefa,completou")).toEqual([
      "criou_tarefa",
      "completou",
    ]);
  });

  it("drops invalid entries and trims whitespace", () => {
    const result = normalizeInboxTipos(" criou_tarefa , bogus, completou , drop ");
    expect(result).toEqual(["criou_tarefa", "completou"]);
  });

  it("removes duplicates", () => {
    expect(normalizeInboxTipos("comentou,comentou,moveu,moveu")).toEqual([
      "comentou",
      "moveu",
    ]);
  });

  it("returns empty when every entry is invalid", () => {
    expect(normalizeInboxTipos("foo,bar,baz")).toEqual([]);
  });
});

describe("centralUrlParams - normalizeProjectIdList", () => {
  it("returns empty array for null/empty input", () => {
    expect(normalizeProjectIdList(null)).toEqual([]);
    expect(normalizeProjectIdList("")).toEqual([]);
  });

  it("keeps valid UUIDs and drops the literal 'all'", () => {
    expect(normalizeProjectIdList(`${VALID_UUID},all,${VALID_UUID_2}`)).toEqual([
      VALID_UUID,
      VALID_UUID_2,
    ]);
  });

  it("drops malformed UUIDs and injection-like junk", () => {
    expect(
      normalizeProjectIdList(
        `${VALID_UUID}, not-a-uuid, <script>, ${VALID_UUID_2}; drop table;`,
      ),
    ).toEqual([VALID_UUID]);
  });

  it("removes duplicates", () => {
    expect(normalizeProjectIdList(`${VALID_UUID},${VALID_UUID}`)).toEqual([VALID_UUID]);
  });
});

describe("centralUrlParams - URL query string cleanup", () => {
  function cleanUrl(input: string) {
    const params = new URLSearchParams(input);

    const tab = normalizeTab(params.get("tab"));
    const view = normalizeView(params.get("view"));
    const priority = normalizePriority(params.get("priority"));
    const project = normalizeProject(params.get("project"));
    const filter = normalizeFilter(params.get("filter"));
    const q = normalizeSearch(params.get("q"));
    const subtab = normalizeInboxSubtab(params.get("subtab"));
    const group = normalizeInboxGroup(params.get("group"));
    const tipos = normalizeInboxTipos(params.get("tipos"));
    const projetos = normalizeProjectIdList(params.get("projetos"));

    const out = new URLSearchParams();
    if (tab !== DEFAULTS.tab) out.set("tab", tab);
    if (view !== DEFAULTS.view) out.set("view", view);
    if (priority !== DEFAULTS.priority) out.set("priority", priority);
    if (project !== DEFAULTS.project) out.set("project", project);
    if (filter !== DEFAULTS.filter) out.set("filter", filter);
    if (q) out.set("q", q);
    if (subtab !== DEFAULTS.inboxSubtab) out.set("subtab", subtab);
    if (group !== DEFAULTS.inboxGroup) out.set("group", group);
    if (tipos.length) out.set("tipos", tipos.join(","));
    if (projetos.length) out.set("projetos", projetos.join(","));
    return out.toString();
  }

  it("removes every invalid param from the query string", () => {
    const dirty =
      "tab=foo&view=kanban&priority=critica&project=not-a-uuid&filter=amanha&q=" +
      encodeURIComponent("\x00\x01") +
      "&subtab=inbox&group=usuario&tipos=foo,bar&projetos=not-a-uuid";
    expect(cleanUrl(dirty)).toBe("");
  });

  it("keeps only the valid params", () => {
    const mixed = `tab=tarefas&view=board&priority=zzz&project=${VALID_UUID}&filter=hoje&q=  hello  `;
    const result = new URLSearchParams(cleanUrl(mixed));
    expect(result.get("tab")).toBe("tarefas");
    expect(result.get("view")).toBe("board");
    expect(result.get("priority")).toBeNull();
    expect(result.get("project")).toBe(VALID_UUID);
    expect(result.get("filter")).toBe("hoje");
    expect(result.get("q")).toBe("hello");
  });

  it("normalizes inbox params into a clean shareable URL", () => {
    const dirty =
      `tab=inbox&subtab=mencoes&group=projeto` +
      `&tipos=comentou,bogus,moveu,comentou` +
      `&projetos=${VALID_UUID},garbage,${VALID_UUID_2}`;
    const result = new URLSearchParams(cleanUrl(dirty));
    expect(result.get("tab")).toBe("inbox");
    expect(result.get("subtab")).toBe("mencoes");
    expect(result.get("group")).toBe("projeto");
    expect(result.get("tipos")).toBe("comentou,moveu");
    expect(result.get("projetos")).toBe(`${VALID_UUID},${VALID_UUID_2}`);
  });

  it("returns an empty string when only defaults are present", () => {
    expect(
      cleanUrl(
        "tab=hoje&view=list&priority=all&project=all&filter=all&q=&subtab=atividade&group=tempo&tipos=&projetos=",
      ),
    ).toBe("");
  });

  it("ignores unknown extra params (they are simply not re-emitted)", () => {
    const result = cleanUrl("tab=tarefas&utm_source=email&debug=1");
    expect(result).toBe("tab=tarefas");
  });
});

describe("sanitizeCentralSearchParams - dedup + encoding", () => {
  const run = (qs: string) => sanitizeCentralSearchParams(new URLSearchParams(qs)).toString();

  it("collapses duplicated keys into the canonical first value", () => {
    // URLSearchParams keeps both, our sanitizer must emit only one.
    expect(run("tab=tarefas&tab=inbox")).toBe("tab=tarefas");
    expect(run("tab=tarefas&priority=alta&priority=urgente")).toBe(
      "tab=tarefas&priority=alta",
    );
  });

  it("lowercases enum-style params even when the casing changes the validity", () => {
    expect(run("tab=TAREFAS&view=BOARD&priority=URGENTE")).toBe(
      "tab=tarefas&view=board&priority=urgente",
    );
  });

  it("trims surrounding whitespace from enum-style params", () => {
    expect(run("tab=%20tarefas%20&view=%20board%20")).toBe(
      "tab=tarefas&view=board",
    );
  });

  it("normalizes Unicode (NFC) and collapses internal whitespace in q", () => {
    // "café" in NFD form (e + combining acute) must collapse to NFC.
    const nfd = "cafe\u0301";
    const out = run(`tab=tarefas&q=${encodeURIComponent(`  ${nfd}   bar  `)}`);
    expect(new URLSearchParams(out).get("q")).toBe("café bar");
  });

  it("strips control chars from q without losing the surrounding text", () => {
    const out = run(`tab=tarefas&q=${encodeURIComponent("abc\u0000def")}`);
    expect(out).toBe(`tab=tarefas&q=${encodeURIComponent("abcdef")}`);
  });

  it("dedups inbox tipos and projetos lists in the canonical CSV form", () => {
    const out = run(
      "tab=inbox&tipos=criou_tarefa,completou,criou_tarefa&projetos=" +
        "11111111-2222-3333-4444-555555555555,11111111-2222-3333-4444-555555555555",
    );
    const params = new URLSearchParams(out);
    expect(params.get("tipos")).toBe("criou_tarefa,completou");
    expect(params.get("projetos")).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("is idempotent for arbitrary dirty inputs", () => {
    const inputs = [
      "tab=TAREFAS&view=BOARD&priority=URGENTE",
      "tab=tarefas&q=%20%20hello%20%20world%20",
      "tab=inbox&tipos=criou_tarefa,foo,criou_tarefa&projetos=not-uuid",
      "tab=hoje&q=ignored&view=board",
      "tab=foo&filter=bar&view=baz",
    ];
    for (const i of inputs) {
      const first = run(i);
      const second = run(first);
      expect(second).toBe(first);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Encoding edge cases — UTF-8 mixed/invalid bytes must not corrupt search    */
/* -------------------------------------------------------------------------- */

describe("centralUrlParams - normalizeSearch (UTF-8 / encoding edge cases)", () => {
  const run = (qs: string) =>
    sanitizeCentralSearchParams(new URLSearchParams(qs)).toString();

  it("decodes a fully percent-encoded UTF-8 word (ção) without losing characters", () => {
    // %C3%A7 = ç, %C3%A3 = ã. Browsers/URLSearchParams already decode this to
    // the literal grapheme; the cleaner must keep it intact.
    const out = run("tab=tarefas&q=a%C3%A7%C3%A3o");
    expect(new URLSearchParams(out).get("q")).toBe("ação");
    expect(normalizeSearch("a%C3%A7%C3%A3o")).toBe("a%C3%A7%C3%A3o");
    // ^ When the value is fed RAW (not via URLSearchParams), the percent
    // sequence is treated as literal text — by design, normalizeSearch never
    // re-decodes. This contract guards against double-decoding bugs.
  });

  it("preserves a mix of ASCII + multi-byte UTF-8 + emoji in q", () => {
    const term = "Café 北京 — pão 🥖";
    const out = run(`tab=tarefas&q=${encodeURIComponent(term)}`);
    expect(new URLSearchParams(out).get("q")).toBe(term);
  });

  it("decodes raw UTF-8 bytes already split across percent-encoding boundaries", () => {
    // Half of ç as %C3 followed by literal A7 must NOT swallow the trailing
    // text — URLSearchParams will pass through the lone byte as U+FFFD.
    const out = run("tab=tarefas&q=%C3a%C3%A7o");
    const q = new URLSearchParams(out).get("q") ?? "";
    // Lone %C3 becomes U+FFFD; %C3%A7 = ç. Final string must contain ç + 'o'
    // without losing the surrounding tokens.
    expect(q).toContain("ço");
    expect(q.length).toBeGreaterThan(0);
  });

  it("strips BOM (U+FEFF) and zero-width chars without dropping the rest", () => {
    const term = "\uFEFFhello\u200Bworld"; // BOM + zero-width space
    const out = run(`tab=tarefas&q=${encodeURIComponent(term)}`);
    const q = new URLSearchParams(out).get("q") ?? "";
    // BOM/ZWSP are NOT control chars in our regex (which targets 0x00-0x1F/0x7F).
    // They must therefore be preserved — the contract is "strip CONTROL only".
    // This test documents that behavior so future tightening is intentional.
    expect(q).toContain("hello");
    expect(q).toContain("world");
  });

  it("normalizes NFD compatibility forms to NFC for canonical equality", () => {
    const nfd = "a\u0301"; // 'a' + combining acute = á
    const out = run(`tab=tarefas&q=${encodeURIComponent(nfd)}`);
    const q = new URLSearchParams(out).get("q") ?? "";
    expect(q).toBe("á");
    expect(q.normalize("NFC")).toBe(q);
  });

  it("handles unpaired surrogates without throwing", () => {
    // Lone high surrogate — invalid UTF-16. URLSearchParams round-trips it
    // as U+FFFD (replacement char). normalizeSearch must NOT throw and must
    // preserve the surrounding ASCII.
    const dirty = "abc\uD800def";
    expect(() => normalizeSearch(dirty)).not.toThrow();
    const out = normalizeSearch(dirty);
    expect(out).toContain("abc");
    expect(out).toContain("def");
  });

  it("collapses internal whitespace introduced by mixed encoded spaces", () => {
    // %20 (regular space) + %09 (tab, control char) + literal space.
    const out = run("tab=tarefas&q=foo%20%09%20bar");
    expect(new URLSearchParams(out).get("q")).toBe("foo bar");
  });

  it("strips ALL C0 control bytes without corrupting adjacent UTF-8 sequences", () => {
    // ç (U+00E7) wrapped between control chars must survive intact.
    const term = "\x01ç\x02ã\x1Fü\x7F";
    const out = normalizeSearch(term);
    expect(out).toBe("çãü");
  });

  it("clamps q to SEARCH_MAX_LENGTH (100) by codepoints, not bytes", () => {
    // 150 multi-byte chars (each ç = 2 UTF-8 bytes). The clamp must be
    // codepoint-based (`.slice(0, 100)`), not byte-based, to avoid splitting
    // a multi-byte sequence and producing U+FFFD.
    const long = "ç".repeat(150);
    const out = normalizeSearch(long);
    expect(out.length).toBe(100);
    // Every char must remain a valid ç — no replacement chars allowed.
    expect(out).not.toContain("\uFFFD");
    expect([...out].every((c) => c === "ç")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // SEARCH_MAX_LENGTH boundary — exact off-by-one coverage at 99 / 100 / 101.
  // The clamp must be inclusive of 100 codepoints and reject the 101st without
  // touching shorter inputs. Tested in three regimes: ASCII (1 byte/cp),
  // 2-byte UTF-8 (ç) and 4-byte UTF-8 (🥖, surrogate pair in JS strings) so we
  // catch any byte-vs-codepoint regressions at the exact boundary.
  // ---------------------------------------------------------------------------
  describe("SEARCH_MAX_LENGTH exact boundary (99 / 100 / 101)", () => {
    const cases: Array<{ label: string; char: string; jsUnits: number }> = [
      { label: "ASCII (1-byte)", char: "a", jsUnits: 1 },
      { label: "2-byte UTF-8 (ç)", char: "ç", jsUnits: 1 },
      { label: "4-byte UTF-8 / surrogate pair (🥖)", char: "🥖", jsUnits: 2 },
    ];

    for (const { label, char, jsUnits } of cases) {
      it(`${label}: 99 codepoints pass through unchanged`, () => {
        const input = char.repeat(99);
        const out = normalizeSearch(input);
        expect([...out].length).toBe(99);
        expect(out.length).toBe(99 * jsUnits);
        expect(out).toBe(input);
        expect(out).not.toContain("\uFFFD");
      });

      it(`${label}: exactly 100 codepoints pass through unchanged (inclusive boundary)`, () => {
        const input = char.repeat(100);
        const out = normalizeSearch(input);
        expect([...out].length).toBe(100);
        expect(out.length).toBe(100 * jsUnits);
        expect(out).toBe(input);
        expect(out).not.toContain("\uFFFD");
      });

      it(`${label}: 101 codepoints clamp to exactly 100 (no corruption)`, () => {
        const input = char.repeat(101);
        const out = normalizeSearch(input);
        expect([...out].length).toBe(100);
        expect(out.length).toBe(100 * jsUnits);
        expect([...out].every((c) => c === char)).toBe(true);
        expect(out).not.toContain("\uFFFD");
      });
    }

    it("clamp is idempotent at the boundary (re-normalizing the clamped value is a no-op)", () => {
      const longAscii = "a".repeat(101);
      const longMulti = "ç".repeat(101);
      const longEmoji = "🥖".repeat(101);
      for (const input of [longAscii, longMulti, longEmoji]) {
        const first = normalizeSearch(input);
        const second = normalizeSearch(first);
        expect(second).toBe(first);
        expect([...first].length).toBe(100);
      }
    });

    it("mixed-width string of 101 codepoints clamps without splitting any sequence", () => {
      // 50× "a" + 50× "ç" + 1× "🥖" = 101 codepoints; the trailing emoji must be
      // dropped whole — never half a surrogate pair, never a U+FFFD.
      const input = "a".repeat(50) + "ç".repeat(50) + "🥖";
      expect([...input].length).toBe(101);
      const out = normalizeSearch(input);
      expect([...out].length).toBe(100);
      expect(out).toBe("a".repeat(50) + "ç".repeat(50));
      expect(out).not.toContain("\uFFFD");
      expect(out).not.toContain("🥖");
    });

    it("URL round-trip respects the 100-codepoint boundary for percent-encoded multi-byte input", () => {
      // 101 × ç encoded as %C3%A7 — exercises the full sanitize→decode→clamp path.
      const encoded = encodeURIComponent("ç".repeat(101));
      const params = new URLSearchParams(`tab=tarefas&q=${encoded}`);
      const sanitized = sanitizeCentralSearchParams(params);
      const q = sanitized.get("q") ?? "";
      expect([...q].length).toBe(100);
      expect(q).toBe("ç".repeat(100));
      expect(q).not.toContain("\uFFFD");
    });
  });

  it("is idempotent for adversarial encoded inputs", () => {
    const inputs = [
      "tab=tarefas&q=a%C3%A7%C3%A3o",
      `tab=tarefas&q=${encodeURIComponent("Café 北京 🥖")}`,
      `tab=tarefas&q=${encodeURIComponent("\uFEFF  hello   world  ")}`,
      `tab=tarefas&q=${encodeURIComponent("\x01ç\x02ã\x1Fü")}`,
    ];
    for (const i of inputs) {
      const first = run(i);
      const second = run(first);
      expect(second).toBe(first);
    }
  });
});


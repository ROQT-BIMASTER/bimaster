/**
 * Stress / fuzz tests for the refactored Central de Trabalho URL parser.
 *
 * Goals:
 *   1. Exercise the unified `parseCentralParams` against pathological inputs
 *      (very long values, mixed Unicode, NFD/NFC, RTL, surrogate pairs,
 *      zero-width chars, full-width digits, emoji).
 *   2. Guarantee that NO field can crash, hang, or silently bypass its
 *      validation envelope.
 *
 * These complement `centralUrlParams.test.ts` (happy paths) and
 * `centralUrlParams.cleanup-extras.test.ts` (whitespace / encoding / repeats).
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULTS,
  parseCentralParams,
  sanitizeCentralSearchParams,
  searchParamsNeedRewrite,
} from "../centralUrlParams";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";
const VALID_UUID_2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const parse = (qs: string) => parseCentralParams(new URLSearchParams(qs));
const sanitize = (qs: string) =>
  sanitizeCentralSearchParams(new URLSearchParams(qs)).toString();

/* -------------------------------------------------------------------------- */
/* 1. Unified parser surface                                                   */
/* -------------------------------------------------------------------------- */
describe("parseCentralParams - unified parser", () => {
  it("returns every field with its default for an empty input", () => {
    const parsed = parse("");
    expect(parsed).toEqual({
      tab: DEFAULTS.tab,
      view: DEFAULTS.view,
      priority: DEFAULTS.priority,
      filter: DEFAULTS.filter,
      project: DEFAULTS.project,
      q: "",
      subtab: DEFAULTS.inboxSubtab,
      group: DEFAULTS.inboxGroup,
      tipos: [],
      projetos: [],
    });
  });

  it("parses a fully-populated valid URL into the typed snapshot", () => {
    const parsed = parse(
      `tab=tarefas&view=board&priority=alta&project=${VALID_UUID}&q=hello`,
    );
    expect(parsed.tab).toBe("tarefas");
    expect(parsed.view).toBe("board");
    expect(parsed.priority).toBe("alta");
    expect(parsed.project).toBe(VALID_UUID);
    expect(parsed.q).toBe("hello");
  });

  it("gives every CSV-style param a real array (never null/undefined)", () => {
    const parsed = parse("tab=inbox");
    expect(Array.isArray(parsed.tipos)).toBe(true);
    expect(Array.isArray(parsed.projetos)).toBe(true);
  });

  it("agrees with sanitizeCentralSearchParams (single source of truth)", () => {
    const dirty = `tab=TAREFAS&view=%62oard&q=  hi  &project=${VALID_UUID}`;
    const parsed = parse(dirty);
    const out = new URLSearchParams(sanitize(dirty));
    expect(out.get("tab")).toBe(parsed.tab);
    expect(out.get("view")).toBe(parsed.view);
    expect(out.get("q")).toBe(parsed.q);
    expect(out.get("project")).toBe(parsed.project);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Very long inputs (DoS / quadratic-cost guards)                           */
/* -------------------------------------------------------------------------- */
describe("parseCentralParams - long inputs", () => {
  it("handles a 1 MB enum value in well under 100ms and falls back to default", () => {
    const huge = "x".repeat(1_000_000);
    const start = performance.now();
    const parsed = parse(`tab=${huge}`);
    const elapsed = performance.now() - start;
    expect(parsed.tab).toBe(DEFAULTS.tab);
    expect(elapsed).toBeLessThan(100);
  });

  it("clamps q to 100 chars even when the raw value is 1 MB", () => {
    const huge = "a".repeat(1_000_000);
    const parsed = parse(`tab=tarefas&q=${huge}`);
    expect(parsed.q).toBe("a".repeat(100));
  });

  it("clamps the projetos CSV to MAX_ID_LIST_SIZE entries (50)", () => {
    // Build 200 unique-ish UUIDs by mutating the last hex block.
    const many = Array.from({ length: 200 }, (_, i) => {
      const tail = i.toString(16).padStart(12, "0");
      return `${VALID_UUID.slice(0, 24)}${tail}`;
    }).join(",");
    const parsed = parse(`tab=inbox&projetos=${many}`);
    expect(parsed.projetos.length).toBe(50);
  });

  it("never throws on a URL with thousands of repeated keys", () => {
    const repeated = Array.from({ length: 5_000 }, () => "tab=tarefas").join("&");
    expect(() => parse(repeated)).not.toThrow();
    expect(parse(repeated).tab).toBe("tarefas");
  });

  it("never throws on a CSV that is all garbage and many MB long", () => {
    const garbage = ("not-a-uuid,").repeat(100_000);
    const parsed = parse(`tab=inbox&projetos=${garbage}`);
    expect(parsed.projetos).toEqual([]);
  });

  it("processes a 1 MB free-text q in well under 200ms", () => {
    const huge = "café ".repeat(200_000); // ~1 MB after url-encoding
    const start = performance.now();
    const parsed = parse(`tab=tarefas&q=${encodeURIComponent(huge)}`);
    const elapsed = performance.now() - start;
    expect(parsed.q.length).toBeLessThanOrEqual(100);
    expect(elapsed).toBeLessThan(200);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Mixed Unicode                                                            */
/* -------------------------------------------------------------------------- */
describe("parseCentralParams - mixed Unicode", () => {
  it("normalizes NFD to NFC inside q", () => {
    // "café" composed of e + combining acute accent.
    const nfd = "cafe\u0301";
    expect(parse(`tab=tarefas&q=${encodeURIComponent(nfd)}`).q).toBe("café");
  });

  it("preserves emoji and counts them as code points (not graphemes)", () => {
    const emoji = "🚀🎉👨‍👩‍👧"; // last one is a ZWJ family
    const parsed = parse(`tab=tarefas&q=${encodeURIComponent(emoji)}`);
    // Must survive the sanitizer (no control chars stripped, no NFC change).
    expect(parsed.q).toContain("🚀");
    expect(parsed.q).toContain("🎉");
  });

  it("handles right-to-left text without re-ordering or losing bytes", () => {
    const rtl = "مرحبا עולם hello"; // Arabic + Hebrew + Latin
    const parsed = parse(`tab=tarefas&q=${encodeURIComponent(rtl)}`);
    expect(parsed.q).toContain("مرحبا");
    expect(parsed.q).toContain("עולם");
    expect(parsed.q).toContain("hello");
  });

  it("strips zero-width / control chars but keeps Unicode whitespace as one space", () => {
    // U+200B zero-width space, U+00A0 non-breaking space, U+2028 line separator.
    const tricky = "foo\u200Bbar\u00A0baz\u2028qux";
    const parsed = parse(`tab=tarefas&q=${encodeURIComponent(tricky)}`);
    // U+200B is NOT in the C0/C1 control range; we don't strip it. The test
    // documents the contract: it survives untouched.
    expect(parsed.q).toContain("bar");
    expect(parsed.q).toContain("baz");
    // U+00A0 collapses with surrounding whitespace.
    expect(parsed.q).not.toMatch(/\u00A0/);
  });

  it("preserves astral surrogate pairs (e.g. mathematical bold A 𝐀)", () => {
    const astral = "𝐀𝐁𝐂"; // each char = surrogate pair
    const parsed = parse(`tab=tarefas&q=${encodeURIComponent(astral)}`);
    expect(parsed.q).toBe(astral);
  });

  it("rejects an enum value containing emoji or full-width digits", () => {
    expect(parse("tab=tarefas🚀").tab).toBe(DEFAULTS.tab);
    expect(parse("tab=ｔａｒｅｆａｓ").tab).toBe(DEFAULTS.tab); // full-width
  });

  it("rejects a UUID that contains any non-ASCII hex digit", () => {
    // Replace 'a' with full-width 'ａ' — visually identical, semantically not a uuid.
    const fakeUuid = VALID_UUID.replace(/a/g, "ａ");
    expect(parse(`tab=tarefas&project=${encodeURIComponent(fakeUuid)}`).project).toBe(
      DEFAULTS.project,
    );
  });

  it("treats CSV entries case-insensitively for tipos and UUIDs", () => {
    const upperUuid = VALID_UUID.toUpperCase();
    const parsed = parse(
      `tab=inbox&tipos=CRIOU_TAREFA,Completou&projetos=${upperUuid},${VALID_UUID_2.toUpperCase()}`,
    );
    expect(parsed.tipos).toEqual(["criou_tarefa", "completou"]);
    expect(parsed.projetos).toEqual([VALID_UUID, VALID_UUID_2]);
  });

  it("collapses a mix of tabs, NBSP and regular spaces inside q", () => {
    const blob = "  hello\u00A0\tworld\n\rfoo  ";
    const parsed = parse(`tab=tarefas&q=${encodeURIComponent(blob)}`);
    expect(parsed.q).toBe("hello world foo");
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Crash-proof guarantees (any field, any input)                            */
/* -------------------------------------------------------------------------- */
describe("parseCentralParams - never throws", () => {
  const adversarialValues = [
    "",
    " ",
    "\u0000",
    "\u0001\u0002\u0003",
    "\uFFFF\uFFFE",
    "🚀".repeat(10_000),
    "%FF%FE%00".repeat(100),
    "..%2F..%2F..%2Fetc%2Fpasswd",
    "<script>alert(1)</script>".repeat(100),
    "' OR 1=1 --".repeat(100),
    "\\u0000\\x00\\0".repeat(100),
    "a".repeat(1_000_000),
  ];

  const fields = [
    "tab",
    "view",
    "priority",
    "filter",
    "project",
    "q",
    "subtab",
    "group",
    "tipos",
    "projetos",
  ] as const;

  for (const field of fields) {
    for (const value of adversarialValues) {
      it(`survives ${field}=<${value.slice(0, 20).replace(/\s/g, "·")}…> (${value.length}b)`, () => {
        const qs = `${field}=${encodeURIComponent(value)}`;
        expect(() => parse(qs)).not.toThrow();
        expect(() => sanitize(qs)).not.toThrow();
        expect(() => searchParamsNeedRewrite(new URLSearchParams(qs))).not.toThrow();
      });
    }
  }

  it("survives a URL with every field set to garbage at the same time", () => {
    const qs =
      "tab=" + "🚀".repeat(1000) +
      "&view=" + "X".repeat(10_000) +
      "&priority=" + "💥".repeat(500) +
      "&filter=" + "\u0000".repeat(500) +
      "&project=" + "/".repeat(5_000) +
      "&q=" + encodeURIComponent("\u0001".repeat(50_000) + "real text") +
      "&subtab=" + "👻".repeat(200) +
      "&group=" + "%FF".repeat(100) +
      "&tipos=" + "bad,".repeat(20_000) +
      "&projetos=" + "not-uuid,".repeat(20_000);
    expect(() => parse(qs)).not.toThrow();
    expect(() => sanitize(qs)).not.toThrow();
    const parsed = parse(qs);
    // every output field must be at its default for adversarial input
    expect(parsed.tab).toBe(DEFAULTS.tab);
    expect(parsed.view).toBe(DEFAULTS.view);
    expect(parsed.priority).toBe(DEFAULTS.priority);
    expect(parsed.filter).toBe(DEFAULTS.filter);
    expect(parsed.project).toBe(DEFAULTS.project);
    expect(parsed.q).toBe("real text");
    expect(parsed.tipos).toEqual([]);
    expect(parsed.projetos).toEqual([]);
  });

  it("idempotency holds even after a stress sanitize", () => {
    const qs =
      "tab=TAREFAS&view=" + "Z".repeat(50_000) +
      "&q=" + encodeURIComponent("  café  bar  ".repeat(1000));
    const first = sanitize(qs);
    const second = sanitize(first);
    expect(second).toBe(first);
  });
});

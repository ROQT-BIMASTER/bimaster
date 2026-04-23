import { describe, it, expect } from "vitest";
import {
  DEFAULTS,
  normalizeFilter,
  normalizePriority,
  normalizeProject,
  normalizeSearch,
  normalizeTab,
  normalizeView,
} from "../centralUrlParams";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

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
    expect(normalizeTab("HOJE")).toBe(DEFAULTS.tab); // case-sensitive guard
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

describe("centralUrlParams - URL query string cleanup", () => {
  /**
   * Simulates how the Central de Trabalho normalizes a full query string:
   * any invalid value should be removed (i.e. the param is dropped) so the URL
   * stays clean.
   */
  function cleanUrl(input: string) {
    const params = new URLSearchParams(input);

    const tab = normalizeTab(params.get("tab"));
    const view = normalizeView(params.get("view"));
    const priority = normalizePriority(params.get("priority"));
    const project = normalizeProject(params.get("project"));
    const filter = normalizeFilter(params.get("filter"));
    const q = normalizeSearch(params.get("q"));

    const out = new URLSearchParams();
    if (tab !== DEFAULTS.tab) out.set("tab", tab);
    if (view !== DEFAULTS.view) out.set("view", view);
    if (priority !== DEFAULTS.priority) out.set("priority", priority);
    if (project !== DEFAULTS.project) out.set("project", project);
    if (filter !== DEFAULTS.filter) out.set("filter", filter);
    if (q) out.set("q", q);
    return out.toString();
  }

  it("removes every invalid param from the query string", () => {
    const dirty =
      "tab=foo&view=kanban&priority=critica&project=not-a-uuid&filter=amanha&q=" +
      encodeURIComponent("\x00\x01");
    expect(cleanUrl(dirty)).toBe("");
  });

  it("keeps only the valid params", () => {
    const mixed = `tab=tarefas&view=board&priority=zzz&project=${VALID_UUID}&filter=hoje&q=  hello  `;
    const result = new URLSearchParams(cleanUrl(mixed));
    expect(result.get("tab")).toBe("tarefas");
    expect(result.get("view")).toBe("board");
    expect(result.get("priority")).toBeNull(); // dropped
    expect(result.get("project")).toBe(VALID_UUID);
    expect(result.get("filter")).toBe("hoje");
    expect(result.get("q")).toBe("hello");
  });

  it("returns an empty string when only defaults are present", () => {
    expect(cleanUrl("tab=hoje&view=list&priority=all&project=all&filter=all&q=")).toBe("");
  });

  it("ignores unknown extra params (they are simply not re-emitted)", () => {
    const result = cleanUrl("tab=tarefas&utm_source=email&debug=1");
    expect(result).toBe("tab=tarefas");
  });
});

/**
 * "E2E-like" tests for the Central de Trabalho URL rewrite pipeline.
 *
 * These tests do NOT mount React Router — instead they replicate the same
 * normalization pipeline used by `src/pages/CentralTrabalho.tsx` and
 * `src/components/projetos/central/ProjetoInboxContent.tsx` against a wide
 * matrix of "dirty" URLs (invalid values, duplicates, cross-tab garbage)
 * and assert that the resulting query string is what the UI would
 * `history.replace` to.
 *
 * If the production cleanup logic in `CentralTrabalho.tsx` changes, this
 * harness must be updated to mirror it — keep them in sync.
 */
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
} from "../centralUrlParams";

const UUID_A = "11111111-2222-3333-4444-555555555555";
const UUID_B = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const UUID_C = "12345678-90ab-cdef-1234-567890abcdef";

/**
 * Mirrors the cleanup useEffect from CentralTrabalho.tsx.
 * Returns the rewritten query string AND the list of keys that were
 * "corrected" (i.e. would trigger the discreet toast).
 */
function rewriteCentralUrl(
  input: string,
  opts: { fallbackTab?: ReturnType<typeof normalizeTab> } = {},
): { url: string; corrected: string[] } {
  const params = new URLSearchParams(input);
  const fallbackTab = opts.fallbackTab ?? DEFAULTS.tab;

  const rawTab = params.get("tab");
  const activeTab = normalizeTab(rawTab, fallbackTab);

  const out = new URLSearchParams();
  const corrected: string[] = [];

  // tab
  if (activeTab !== fallbackTab) out.set("tab", activeTab);
  if (rawTab !== null && rawTab !== activeTab) corrected.push("tab");

  // filter
  const rawFilter = params.get("filter");
  const filter = normalizeFilter(rawFilter);
  if (filter !== "all") out.set("filter", filter);
  if (rawFilter !== null && rawFilter !== filter) corrected.push("filter");

  if (activeTab === "tarefas") {
    const rawView = params.get("view");
    const view = normalizeView(rawView);
    if (view !== "list") out.set("view", view);
    if (rawView !== null && rawView !== view) corrected.push("view");

    const rawPriority = params.get("priority");
    const priority = normalizePriority(rawPriority);
    if (priority !== "all") out.set("priority", priority);
    if (rawPriority !== null && rawPriority !== priority) corrected.push("priority");

    const rawProject = params.get("project");
    const project = normalizeProject(rawProject);
    if (project !== "all") out.set("project", project);
    if (rawProject !== null && rawProject !== project) corrected.push("project");

    const rawQ = params.get("q");
    const q = normalizeSearch(rawQ);
    if (q) out.set("q", q);
    if (rawQ !== null && rawQ !== q) corrected.push("q");
  } else {
    // strip task-only params on non-tarefas tabs
    ["view", "priority", "project"].forEach((k) => {
      if (params.has(k)) corrected.push(k);
    });
  }

  if (activeTab === "inbox") {
    const rawSubtab = params.get("subtab");
    const subtab = normalizeInboxSubtab(rawSubtab);
    if (subtab !== DEFAULTS.inboxSubtab) out.set("subtab", subtab);
    if (rawSubtab !== null && rawSubtab !== subtab) corrected.push("subtab");

    const rawGroup = params.get("group");
    const group = normalizeInboxGroup(rawGroup);
    if (group !== DEFAULTS.inboxGroup) out.set("group", group);
    if (rawGroup !== null && rawGroup !== group) corrected.push("group");

    const rawTipos = params.get("tipos");
    const tipos = normalizeInboxTipos(rawTipos);
    if (tipos.length) out.set("tipos", tipos.join(","));
    if (
      rawTipos !== null &&
      rawTipos !== (tipos.length ? tipos.join(",") : "")
    ) {
      corrected.push("tipos");
    }

    const rawProjetos = params.get("projetos");
    const projetos = normalizeProjectIdList(rawProjetos);
    if (projetos.length) out.set("projetos", projetos.join(","));
    if (
      rawProjetos !== null &&
      rawProjetos !== (projetos.length ? projetos.join(",") : "")
    ) {
      corrected.push("projetos");
    }
  } else {
    ["subtab", "group", "tipos", "projetos"].forEach((k) => {
      if (params.has(k)) corrected.push(k);
    });
  }

  // q is forbidden on hoje
  if (activeTab === "hoje" && params.has("q")) {
    corrected.push("q");
  }

  // de-dupe corrected keys preserving order
  const seen = new Set<string>();
  const dedupCorrected = corrected.filter((k) => {
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { url: out.toString(), corrected: dedupCorrected };
}

describe("Central URL rewrite — tab", () => {
  it("removes tab=default", () => {
    const { url } = rewriteCentralUrl("tab=hoje");
    expect(url).toBe("");
  });

  it("preserves tab=tarefas", () => {
    const { url } = rewriteCentralUrl("tab=tarefas");
    expect(url).toBe("tab=tarefas");
  });

  it("falls back when tab is garbage and toasts", () => {
    const { url, corrected } = rewriteCentralUrl("tab=xxx");
    expect(url).toBe("");
    expect(corrected).toContain("tab");
  });

  it("falls back when tab uses wrong case", () => {
    const { url, corrected } = rewriteCentralUrl("tab=HOJE");
    expect(url).toBe("");
    expect(corrected).toContain("tab");
  });

  it("collapses duplicated tab params (URLSearchParams keeps the first)", () => {
    const { url } = rewriteCentralUrl("tab=tarefas&tab=inbox");
    expect(url).toBe("tab=tarefas");
  });
});

describe("Central URL rewrite — filter", () => {
  it("keeps a valid filter on tarefas", () => {
    const { url } = rewriteCentralUrl("tab=tarefas&filter=atrasadas");
    expect(url).toBe("tab=tarefas&filter=atrasadas");
  });

  it("strips filter=all", () => {
    const { url } = rewriteCentralUrl("tab=tarefas&filter=all");
    expect(url).toBe("tab=tarefas");
  });

  it("strips invalid filter and reports correction", () => {
    const { url, corrected } = rewriteCentralUrl("tab=tarefas&filter=foo");
    expect(url).toBe("tab=tarefas");
    expect(corrected).toContain("filter");
  });
});

describe("Central URL rewrite — task params", () => {
  it("keeps view/priority/project/q when valid", () => {
    const input = `tab=tarefas&view=board&priority=alta&project=${UUID_A}&q=rel`;
    const { url, corrected } = rewriteCentralUrl(input);
    expect(corrected).toEqual([]);
    const out = new URLSearchParams(url);
    expect(out.get("tab")).toBe("tarefas");
    expect(out.get("view")).toBe("board");
    expect(out.get("priority")).toBe("alta");
    expect(out.get("project")).toBe(UUID_A);
    expect(out.get("q")).toBe("rel");
  });

  it("drops invalid view/priority/project and reports each correction", () => {
    const { url, corrected } = rewriteCentralUrl(
      "tab=tarefas&view=kanban&priority=critica&project=not-a-uuid",
    );
    expect(url).toBe("tab=tarefas");
    expect(corrected.sort()).toEqual(["priority", "project", "view"]);
  });

  it("trims and clamps q to 100 chars", () => {
    const long = "a".repeat(250);
    const { url } = rewriteCentralUrl(`tab=tarefas&q=${encodeURIComponent(long)}`);
    const out = new URLSearchParams(url);
    expect(out.get("q")?.length).toBe(100);
  });

  it("strips control chars in q without losing the token", () => {
    const { url, corrected } = rewriteCentralUrl(
      `tab=tarefas&q=${encodeURIComponent("abc\u0000def")}`,
    );
    const out = new URLSearchParams(url);
    expect(out.get("q")).toBe("abcdef");
    expect(corrected).toContain("q");
  });

  it("removes empty q", () => {
    const { url } = rewriteCentralUrl("tab=tarefas&q=");
    expect(url).toBe("tab=tarefas");
  });
});

describe("Central URL rewrite — cross-tab garbage", () => {
  it("strips view/priority/project/q on hoje", () => {
    const input = `tab=hoje&view=board&priority=alta&project=${UUID_A}&q=foo`;
    const { url, corrected } = rewriteCentralUrl(input);
    expect(url).toBe("");
    expect(corrected.sort()).toEqual(["priority", "project", "q", "view"]);
  });

  it("strips inbox-only params on tarefas", () => {
    const input =
      "tab=tarefas&subtab=mencoes&group=projeto&tipos=criou_tarefa&projetos=" +
      UUID_A;
    const { url, corrected } = rewriteCentralUrl(input);
    expect(url).toBe("tab=tarefas");
    expect(corrected.sort()).toEqual(["group", "projetos", "subtab", "tipos"]);
  });

  it("strips task params on inbox", () => {
    const { url, corrected } = rewriteCentralUrl(
      "tab=inbox&view=board&priority=alta",
    );
    expect(url).toBe("tab=inbox");
    expect(corrected.sort()).toEqual(["priority", "view"]);
  });
});

describe("Central URL rewrite — inbox params", () => {
  it("keeps valid subtab/group", () => {
    const { url } = rewriteCentralUrl("tab=inbox&subtab=mencoes&group=projeto");
    const out = new URLSearchParams(url);
    expect(out.get("subtab")).toBe("mencoes");
    expect(out.get("group")).toBe("projeto");
  });

  it("strips invalid subtab and group", () => {
    const { url, corrected } = rewriteCentralUrl(
      "tab=inbox&subtab=foo&group=mes",
    );
    expect(url).toBe("tab=inbox");
    expect(corrected).toEqual(expect.arrayContaining(["subtab", "group"]));
  });

  it("filters tipos list, dropping unknown values and duplicates", () => {
    const { url, corrected } = rewriteCentralUrl(
      "tab=inbox&tipos=criou_tarefa,foo,completou,foo,bar",
    );
    const out = new URLSearchParams(url);
    expect(out.get("tipos")).toBe("criou_tarefa,completou");
    expect(corrected).toContain("tipos");
  });

  it("filters projetos list, dropping non-UUIDs and duplicates", () => {
    const { url, corrected } = rewriteCentralUrl(
      `tab=inbox&projetos=${UUID_A},not-uuid,${UUID_A},${UUID_B}`,
    );
    const out = new URLSearchParams(url);
    expect(out.get("projetos")?.split(",").sort()).toEqual([UUID_A, UUID_B].sort());
    expect(corrected).toContain("projetos");
  });

  it("clamps projetos list to 50 entries", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      // 60 unique uuids by mutating last 12 chars
      `${UUID_C.slice(0, 24)}${String(i).padStart(12, "0")}`,
    ).join(",");
    const { url } = rewriteCentralUrl(`tab=inbox&projetos=${many}`);
    const out = new URLSearchParams(url);
    expect(out.get("projetos")?.split(",").length).toBe(50);
  });
});

describe("Central URL rewrite — clean URL invariants", () => {
  it("never re-adds a param whose value equals its default", () => {
    const inputs = [
      "tab=hoje",
      "tab=tarefas&filter=all",
      "tab=tarefas&view=list",
      "tab=tarefas&priority=all",
      `tab=tarefas&project=all`,
      "tab=inbox&subtab=atividade",
      "tab=inbox&group=tempo",
    ];
    for (const i of inputs) {
      const { url } = rewriteCentralUrl(i);
      const out = new URLSearchParams(url);
      expect(out.get("filter")).toBeNull();
      expect(out.get("view")).toBeNull();
      expect(out.get("priority")).toBeNull();
      expect(out.get("project")).toBeNull();
      // tab is only kept when it's not the default
      if (out.get("tab")) {
        expect(["tarefas", "inbox"]).toContain(out.get("tab"));
      }
    }
  });

  it("is idempotent: rewriting an already-clean URL is a no-op", () => {
    const cases = [
      "",
      "tab=tarefas",
      "tab=tarefas&filter=hoje",
      `tab=tarefas&view=board&priority=alta&project=${UUID_A}&q=rel`,
      "tab=inbox&subtab=mencoes&group=projeto",
      `tab=inbox&tipos=criou_tarefa,completou&projetos=${UUID_A}`,
    ];
    for (const c of cases) {
      const first = rewriteCentralUrl(c);
      const second = rewriteCentralUrl(first.url);
      expect(second.url).toBe(first.url);
      expect(second.corrected).toEqual([]);
    }
  });

  it("reports a correction list for every dirty input", () => {
    const dirty = [
      "tab=foo",
      "tab=tarefas&filter=junk",
      "tab=tarefas&view=kanban",
      "tab=hoje&q=oops",
      "tab=inbox&subtab=foo&tipos=bad",
      `tab=tarefas&project=not-uuid&priority=critica&view=table`,
    ];
    for (const d of dirty) {
      const { corrected } = rewriteCentralUrl(d);
      expect(corrected.length).toBeGreaterThan(0);
    }
  });
});

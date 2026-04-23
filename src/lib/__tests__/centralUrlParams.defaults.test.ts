/**
 * Defaults-stripping contract for `sanitizeCentralSearchParams`.
 *
 * Hard guarantees verified here:
 *   1. Any param whose effective value equals `DEFAULTS.*` is removed.
 *   2. Only params strictly different from the default survive.
 *   3. Params invalid for the active tab are stripped (cross-tab leakage).
 *   4. The output is idempotent (sanitize ∘ sanitize = sanitize).
 *   5. `searchParamsNeedRewrite` returns false when input already canonical.
 */

import { describe, it, expect } from "vitest";
import {
  sanitizeCentralSearchParams,
  searchParamsNeedRewrite,
  DEFAULTS,
  VALID_TABS,
  VALID_VIEWS,
  VALID_PRIORITIES,
  VALID_FILTERS,
  VALID_INBOX_SUBTABS,
  VALID_INBOX_GROUPS,
  VALID_INBOX_TIPOS,
} from "../centralUrlParams";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";

function sanitize(qs: string): URLSearchParams {
  return sanitizeCentralSearchParams(new URLSearchParams(qs));
}

function keys(p: URLSearchParams): string[] {
  const out: string[] = [];
  p.forEach((_, k) => {
    if (!out.includes(k)) out.push(k);
  });
  return out.sort();
}

describe("sanitizeCentralSearchParams — defaults are never written", () => {
  it("returns an empty query when nothing is set", () => {
    expect(sanitize("").toString()).toBe("");
  });

  it("strips tab when it equals the default ('hoje')", () => {
    const out = sanitize(`tab=${DEFAULTS.tab}`);
    expect(out.has("tab")).toBe(false);
    expect(out.toString()).toBe("");
  });

  it("strips filter=all under tarefas (default)", () => {
    const out = sanitize(`tab=tarefas&filter=${DEFAULTS.filter}`);
    expect(out.get("tab")).toBe("tarefas");
    expect(out.has("filter")).toBe(false);
  });

  it("strips view=list under tarefas (default)", () => {
    const out = sanitize(`tab=tarefas&view=${DEFAULTS.view}`);
    expect(out.get("tab")).toBe("tarefas");
    expect(out.has("view")).toBe(false);
  });

  it("strips priority=all under tarefas (default)", () => {
    const out = sanitize(`tab=tarefas&priority=${DEFAULTS.priority}`);
    expect(out.has("priority")).toBe(false);
  });

  it("strips project=all under tarefas (default)", () => {
    const out = sanitize(`tab=tarefas&project=${DEFAULTS.project}`);
    expect(out.has("project")).toBe(false);
  });

  it("strips empty q under tarefas (default '')", () => {
    const out = sanitize("tab=tarefas&q=");
    expect(out.has("q")).toBe(false);
  });

  it("strips q that is only whitespace (collapses to default '')", () => {
    const out = sanitize("tab=tarefas&q=%20%20%20");
    expect(out.has("q")).toBe(false);
  });

  it("strips subtab=atividade under inbox (default)", () => {
    const out = sanitize(`tab=inbox&subtab=${DEFAULTS.inboxSubtab}`);
    expect(out.get("tab")).toBe("inbox");
    expect(out.has("subtab")).toBe(false);
  });

  it("strips group=tempo under inbox (default)", () => {
    const out = sanitize(`tab=inbox&group=${DEFAULTS.inboxGroup}`);
    expect(out.has("group")).toBe(false);
  });

  it("strips empty tipos= under inbox (default [])", () => {
    const out = sanitize("tab=inbox&tipos=");
    expect(out.has("tipos")).toBe(false);
  });

  it("strips empty projetos= under inbox (default [])", () => {
    const out = sanitize("tab=inbox&projetos=");
    expect(out.has("projetos")).toBe(false);
  });

  it("strips ALL defaults at once and returns an empty query string", () => {
    const out = sanitize(
      [
        `tab=${DEFAULTS.tab}`,
        `view=${DEFAULTS.view}`,
        `priority=${DEFAULTS.priority}`,
        `filter=${DEFAULTS.filter}`,
        `project=${DEFAULTS.project}`,
        "q=",
        `subtab=${DEFAULTS.inboxSubtab}`,
        `group=${DEFAULTS.inboxGroup}`,
        "tipos=",
        "projetos=",
      ].join("&"),
    );
    expect(out.toString()).toBe("");
  });
});

describe("sanitizeCentralSearchParams — non-defaults survive", () => {
  it("keeps tab=tarefas (non-default)", () => {
    const out = sanitize("tab=tarefas");
    expect(out.get("tab")).toBe("tarefas");
    expect(keys(out)).toEqual(["tab"]);
  });

  it("keeps tab=inbox (non-default)", () => {
    const out = sanitize("tab=inbox");
    expect(out.get("tab")).toBe("inbox");
    expect(keys(out)).toEqual(["tab"]);
  });

  it.each(VALID_VIEWS.filter((v) => v !== DEFAULTS.view))(
    "keeps view=%s under tarefas (non-default)",
    (view) => {
      const out = sanitize(`tab=tarefas&view=${view}`);
      expect(out.get("view")).toBe(view);
    },
  );

  it.each(VALID_PRIORITIES.filter((p) => p !== DEFAULTS.priority))(
    "keeps priority=%s under tarefas (non-default)",
    (priority) => {
      const out = sanitize(`tab=tarefas&priority=${priority}`);
      expect(out.get("priority")).toBe(priority);
    },
  );

  it.each(VALID_FILTERS.filter((f) => f !== DEFAULTS.filter))(
    "keeps filter=%s under tarefas (non-default)",
    (filter) => {
      const out = sanitize(`tab=tarefas&filter=${filter}`);
      expect(out.get("filter")).toBe(filter);
    },
  );

  it.each(VALID_INBOX_SUBTABS.filter((s) => s !== DEFAULTS.inboxSubtab))(
    "keeps subtab=%s under inbox (non-default)",
    (subtab) => {
      const out = sanitize(`tab=inbox&subtab=${subtab}`);
      expect(out.get("subtab")).toBe(subtab);
    },
  );

  it.each(VALID_INBOX_GROUPS.filter((g) => g !== DEFAULTS.inboxGroup))(
    "keeps group=%s under inbox (non-default)",
    (group) => {
      const out = sanitize(`tab=inbox&group=${group}`);
      expect(out.get("group")).toBe(group);
    },
  );

  it("keeps a UUID project under tarefas", () => {
    const out = sanitize(`tab=tarefas&project=${UUID_A}`);
    expect(out.get("project")).toBe(UUID_A);
  });

  it("keeps a non-empty q under tarefas", () => {
    const out = sanitize("tab=tarefas&q=relat%C3%B3rio");
    expect(out.get("q")).toBe("relatório");
  });

  it("keeps tipos with valid items under inbox", () => {
    const tipos = VALID_INBOX_TIPOS.slice(0, 2).join(",");
    const out = sanitize(`tab=inbox&tipos=${tipos}`);
    expect(out.get("tipos")).toBe(tipos);
  });

  it("keeps projetos with valid UUIDs under inbox", () => {
    const out = sanitize(`tab=inbox&projetos=${UUID_A},${UUID_B}`);
    expect(out.get("projetos")).toBe(`${UUID_A},${UUID_B}`);
  });
});

describe("sanitizeCentralSearchParams — mixed (defaults + non-defaults)", () => {
  it("removes only the default keys and keeps the rest", () => {
    const out = sanitize(
      `tab=tarefas&view=${DEFAULTS.view}&priority=alta&filter=${DEFAULTS.filter}&project=${UUID_A}&q=`,
    );
    expect(keys(out)).toEqual(["priority", "project", "tab"]);
    expect(out.get("tab")).toBe("tarefas");
    expect(out.get("priority")).toBe("alta");
    expect(out.get("project")).toBe(UUID_A);
    expect(out.has("view")).toBe(false);
    expect(out.has("filter")).toBe(false);
    expect(out.has("q")).toBe(false);
  });

  it("inbox: keeps non-default subtab and tipos, drops default group", () => {
    const out = sanitize(
      `tab=inbox&subtab=mencoes&group=${DEFAULTS.inboxGroup}&tipos=criou_tarefa`,
    );
    expect(keys(out)).toEqual(["subtab", "tab", "tipos"]);
    expect(out.get("subtab")).toBe("mencoes");
    expect(out.get("tipos")).toBe("criou_tarefa");
    expect(out.has("group")).toBe(false);
  });
});

describe("sanitizeCentralSearchParams — values that NORMALIZE to default are stripped", () => {
  it("drops view when value normalizes to the default ('LIST' → 'list')", () => {
    const out = sanitize("tab=tarefas&view=LIST");
    expect(out.has("view")).toBe(false);
  });

  it("drops priority when value normalizes to default ('  ALL  ' → 'all')", () => {
    const out = sanitize("tab=tarefas&priority=%20%20ALL%20%20");
    expect(out.has("priority")).toBe(false);
  });

  it("drops filter when invalid value falls back to default ('lixo' → 'all')", () => {
    const out = sanitize("tab=tarefas&filter=lixo");
    expect(out.has("filter")).toBe(false);
  });

  it("drops project when invalid value falls back to default ('not-uuid' → 'all')", () => {
    const out = sanitize("tab=tarefas&project=not-a-uuid");
    expect(out.has("project")).toBe(false);
  });

  it("drops subtab when invalid value falls back to default", () => {
    const out = sanitize("tab=inbox&subtab=desconhecida");
    expect(out.has("subtab")).toBe(false);
  });

  it("drops group when invalid value falls back to default", () => {
    const out = sanitize("tab=inbox&group=mes");
    expect(out.has("group")).toBe(false);
  });

  it("drops tipos when every item is invalid (list collapses to [])", () => {
    const out = sanitize("tab=inbox&tipos=foo,bar,baz");
    expect(out.has("tipos")).toBe(false);
  });

  it("drops projetos when every item is invalid (list collapses to [])", () => {
    const out = sanitize("tab=inbox&projetos=not-uuid,also-not-uuid");
    expect(out.has("projetos")).toBe(false);
  });
});

describe("sanitizeCentralSearchParams — cross-tab leakage is removed", () => {
  it("drops view/priority/project/q when tab=hoje (none apply)", () => {
    const out = sanitize(
      `tab=${DEFAULTS.tab}&view=board&priority=alta&project=${UUID_A}&q=teste`,
    );
    expect(out.toString()).toBe("");
  });

  it("drops inbox-only keys when tab=tarefas", () => {
    const out = sanitize(
      `tab=tarefas&subtab=mencoes&group=projeto&tipos=criou_tarefa&projetos=${UUID_A}`,
    );
    expect(keys(out)).toEqual(["tab"]);
  });

  it("drops tarefas-only keys (view/priority/filter/project) when tab=inbox", () => {
    const out = sanitize(
      `tab=inbox&view=board&priority=alta&filter=atrasadas&project=${UUID_A}`,
    );
    expect(keys(out)).toEqual(["tab"]);
  });
});

describe("sanitizeCentralSearchParams — idempotency & need-rewrite", () => {
  it("is idempotent for already-canonical inputs", () => {
    const inputs = [
      "",
      "tab=tarefas",
      "tab=tarefas&priority=alta",
      `tab=tarefas&project=${UUID_A}&view=board`,
      "tab=inbox&subtab=mencoes&tipos=criou_tarefa,completou",
    ];
    for (const qs of inputs) {
      const once = sanitize(qs).toString();
      const twice = sanitizeCentralSearchParams(new URLSearchParams(once)).toString();
      expect(twice).toBe(once);
    }
  });

  it("searchParamsNeedRewrite is false when input is already canonical", () => {
    const canonical = sanitize("tab=tarefas&priority=alta");
    expect(searchParamsNeedRewrite(canonical)).toBe(false);
  });

  it("searchParamsNeedRewrite is true when defaults are present", () => {
    expect(
      searchParamsNeedRewrite(
        new URLSearchParams(`tab=tarefas&view=${DEFAULTS.view}`),
      ),
    ).toBe(true);
  });

  it("searchParamsNeedRewrite is true when an unknown key is present", () => {
    expect(
      searchParamsNeedRewrite(new URLSearchParams("tab=tarefas&utm_source=x")),
    ).toBe(true);
  });

  it("never produces a key whose value equals the default (full enum sweep)", () => {
    // Build a single dirty URL with every default explicitly set, plus one
    // non-default per category to make sure the sweep doesn't accidentally
    // strip everything.
    const out = sanitize(
      [
        "tab=tarefas",
        `view=${DEFAULTS.view}`,
        "priority=alta",
        `filter=${DEFAULTS.filter}`,
        `project=${DEFAULTS.project}`,
        "q=",
      ].join("&"),
    );
    // Only the non-default ones must remain.
    expect(keys(out)).toEqual(["priority", "tab"]);
    // And no surviving value matches its default.
    out.forEach((value, key) => {
      switch (key) {
        case "tab":
          expect(value).not.toBe(DEFAULTS.tab);
          break;
        case "view":
          expect(value).not.toBe(DEFAULTS.view);
          break;
        case "priority":
          expect(value).not.toBe(DEFAULTS.priority);
          break;
        case "filter":
          expect(value).not.toBe(DEFAULTS.filter);
          break;
        case "project":
          expect(value).not.toBe(DEFAULTS.project);
          break;
        case "subtab":
          expect(value).not.toBe(DEFAULTS.inboxSubtab);
          break;
        case "group":
          expect(value).not.toBe(DEFAULTS.inboxGroup);
          break;
        case "q":
          expect(value).not.toBe("");
          break;
        case "tipos":
        case "projetos":
          expect(value.length).toBeGreaterThan(0);
          break;
      }
    });
  });

  it.each(VALID_TABS)(
    "for tab=%s: writing all defaults yields only the non-default tab key (or empty)",
    (tab) => {
      const out = sanitize(
        [
          `tab=${tab}`,
          `view=${DEFAULTS.view}`,
          `priority=${DEFAULTS.priority}`,
          `filter=${DEFAULTS.filter}`,
          `project=${DEFAULTS.project}`,
          "q=",
          `subtab=${DEFAULTS.inboxSubtab}`,
          `group=${DEFAULTS.inboxGroup}`,
          "tipos=",
          "projetos=",
        ].join("&"),
      );
      const expected = tab === DEFAULTS.tab ? [] : ["tab"];
      expect(keys(out)).toEqual(expected);
    },
  );
});

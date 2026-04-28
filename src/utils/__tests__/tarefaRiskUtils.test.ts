import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getTarefaRisk, RISK_BADGE_STYLES } from "@/utils/tarefaRiskUtils";

describe("getTarefaRisk", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T12:00:00"));
  });
  afterAll(() => vi.useRealTimers());

  it("returns completed when status is concluida", () => {
    const r = getTarefaRisk("concluida", "2020-01-01");
    expect(r.level).toBe("completed");
    expect(r.daysRemaining).toBeNull();
  });

  it("returns no_deadline when prazo is null", () => {
    const r = getTarefaRisk("pendente", null);
    expect(r.level).toBe("no_deadline");
  });

  it("returns overdue for past dates", () => {
    const r = getTarefaRisk("pendente", "2026-04-25");
    expect(r.level).toBe("overdue");
    expect(r.daysRemaining).toBeLessThan(0);
    expect(r.label).toContain("atrasada");
  });

  it("returns at_risk within alert window", () => {
    const r = getTarefaRisk("pendente", "2026-04-29", 2);
    expect(r.level).toBe("at_risk");
  });

  it("returns 'Vence hoje' when same day", () => {
    const r = getTarefaRisk("pendente", "2026-04-28");
    expect(r.level).toBe("at_risk");
    expect(r.label).toBe("Vence hoje");
  });

  it("returns on_track when far from deadline", () => {
    const r = getTarefaRisk("pendente", "2026-05-30");
    expect(r.level).toBe("on_track");
  });

  it("exposes a style for every risk level", () => {
    (["overdue", "at_risk", "on_track", "completed", "no_deadline"] as const).forEach(
      (k) => expect(RISK_BADGE_STYLES[k]).toBeDefined()
    );
  });
});

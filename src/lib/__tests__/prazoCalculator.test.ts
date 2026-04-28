import { describe, it, expect } from "vitest";
import {
  parseDateLocal,
  toISODateLocal,
  feriadosToSet,
  validarHierarquiaPrazo,
} from "@/lib/prazoCalculator";

describe("prazoCalculator helpers", () => {
  it("parseDateLocal handles YYYY-MM-DD without timezone shift", () => {
    const d = parseDateLocal("2026-03-15");
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(2);
    expect(d?.getDate()).toBe(15);
  });

  it("parseDateLocal returns null on invalid input", () => {
    expect(parseDateLocal(null)).toBeNull();
    expect(parseDateLocal("")).toBeNull();
    expect(parseDateLocal("not-a-date")).toBeNull();
  });

  it("toISODateLocal round-trips with parseDateLocal", () => {
    const iso = "2026-01-09";
    expect(toISODateLocal(parseDateLocal(iso)!)).toBe(iso);
  });

  it("feriadosToSet normalizes datas para 10 chars", () => {
    const set = feriadosToSet([{ data: "2026-12-25T00:00:00Z" }, { data: "2026-01-01" }]);
    expect(set.has("2026-12-25")).toBe(true);
    expect(set.has("2026-01-01")).toBe(true);
    expect(set.size).toBe(2);
  });

  describe("validarHierarquiaPrazo", () => {
    it("aceita quando algum prazo está ausente", () => {
      expect(validarHierarquiaPrazo({ filhoPrazo: null, paiPrazo: "2026-01-01", filhoLabel: "subtarefa", paiLabel: "tarefa" }).ok).toBe(true);
      expect(validarHierarquiaPrazo({ filhoPrazo: "2026-01-01", paiPrazo: null, filhoLabel: "x", paiLabel: "y" }).ok).toBe(true);
    });

    it("aceita quando filho <= pai", () => {
      const r = validarHierarquiaPrazo({ filhoPrazo: "2026-01-10", paiPrazo: "2026-01-15", filhoLabel: "subtarefa", paiLabel: "tarefa" });
      expect(r.ok).toBe(true);
    });

    it("rejeita quando filho > pai e devolve mensagem PT-BR", () => {
      const r = validarHierarquiaPrazo({ filhoPrazo: "2026-02-01", paiPrazo: "2026-01-15", filhoLabel: "subtarefa", paiLabel: "tarefa pai" });
      expect(r.ok).toBe(false);
      expect(r.motivo).toContain("não pode ultrapassar");
      expect(r.motivo).toContain("15/01/2026");
    });
  });
});

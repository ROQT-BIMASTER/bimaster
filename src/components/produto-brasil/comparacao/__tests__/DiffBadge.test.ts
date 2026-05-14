import { describe, it, expect } from "vitest";
import { computeDiff } from "../DiffBadge";

describe("computeDiff", () => {
  it("returns 'igual' when both sides match (case-insensitive, trimmed)", () => {
    expect(computeDiff("Lipstick", "lipstick")).toBe("igual");
    expect(computeDiff(" 100 ", 100)).toBe("igual");
  });

  it("returns 'divergente' when both sides differ", () => {
    expect(computeDiff("Lipstick", "Batom")).toBe("divergente");
    expect(computeDiff(100, 200)).toBe("divergente");
  });

  it("returns 'faltando' when only China has value", () => {
    expect(computeDiff("Lipstick", "")).toBe("faltando");
    expect(computeDiff("Lipstick", null)).toBe("faltando");
  });

  it("returns 'apenas_brasil' when only Brasil has value", () => {
    expect(computeDiff("", "Batom")).toBe("apenas_brasil");
    expect(computeDiff(null, "Batom")).toBe("apenas_brasil");
  });

  it("returns 'vazio' when both are empty", () => {
    expect(computeDiff("", "")).toBe("vazio");
    expect(computeDiff(null, undefined)).toBe("vazio");
  });
});

import { describe, it, expect } from "vitest";
import { mergeById } from "../mergeColecoes";

describe("mergeById", () => {
  it("une por id preservando ordem remota", () => {
    const local = [{ id: "a", updated_at: "1" }];
    const remote = [
      { id: "b", updated_at: "1" },
      { id: "a", updated_at: "1" },
    ];
    const out = mergeById(local, remote);
    expect(out.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("mais recente vence em conflito", () => {
    const local = [{ id: "a", updated_at: "2024-01-02", nome: "novo" } as any];
    const remote = [{ id: "a", updated_at: "2024-01-01", nome: "antigo" } as any];
    expect((mergeById(local, remote)[0] as any).nome).toBe("novo");
  });

  it("preserva pendente local sem par remoto", () => {
    const local = [
      { id: "a", updated_at: "1" },
      { id: "tmp", __pending: true, created_at: "9" },
    ];
    const remote = [{ id: "a", updated_at: "2" }];
    const out = mergeById(local, remote);
    expect(out.map((x) => x.id)).toEqual(["a", "tmp"]);
  });

  it("mantém pendente quando remoto ainda não tem updated_at", () => {
    const local = [{ id: "a", __pending: true, created_at: "1" }];
    const remote = [{ id: "a" } as any];
    expect((mergeById(local, remote)[0] as any).__pending).toBe(true);
  });
});

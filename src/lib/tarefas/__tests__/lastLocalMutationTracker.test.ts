import { describe, it, expect, beforeEach } from "vitest";
import {
  clearLocalMutationTracker,
  isEchoOfLocalMutation,
  trackLocalMutation,
} from "../lastLocalMutationTracker";

describe("lastLocalMutationTracker", () => {
  beforeEach(() => clearLocalMutationTracker());

  it("bloqueia echo dentro da janela TTL", () => {
    trackLocalMutation("t1", ["descricao"], 1000);
    expect(isEchoOfLocalMutation("t1", 1500, "descricao")).toBe(true);
  });

  it("libera echo passado o TTL", () => {
    trackLocalMutation("t1", ["descricao"], 1000);
    expect(isEchoOfLocalMutation("t1", 3000, "descricao")).toBe(false);
  });

  it("filtro por campo evita mascarar mudança de outro campo", () => {
    trackLocalMutation("t1", ["descricao"], 1000);
    expect(isEchoOfLocalMutation("t1", 1100, "status")).toBe(false);
    expect(isEchoOfLocalMutation("t1", 1100, "descricao")).toBe(true);
  });

  it("sem campo, bloqueia qualquer evento na janela", () => {
    trackLocalMutation("t1", ["descricao"], 1000);
    expect(isEchoOfLocalMutation("t1", 1100)).toBe(true);
  });
});

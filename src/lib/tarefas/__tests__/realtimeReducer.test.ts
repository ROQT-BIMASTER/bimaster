import { describe, it, expect, beforeEach } from "vitest";
import {
  applyRealtimePatch,
  comparePrecedence,
  type ReducerDeps,
  type RealtimePayload,
} from "../realtimeReducer";

const noDeps: ReducerDeps = {
  isEcho: () => false,
  isLocked: () => false,
  stashPending: () => {},
};

interface T extends Record<string, unknown> {
  id: string;
  titulo: string;
  status: string;
  updated_at: string;
  responsaveis?: Array<{ id: string; updated_at?: string }>;
}

const base: T = { id: "1", titulo: "A", status: "pendente", updated_at: "2024-01-01T00:00:00Z" };

function upd(newRow: Partial<T>, oldRow: Partial<T> = {}): RealtimePayload<T> {
  return {
    eventType: "UPDATE",
    new: { ...base, ...newRow } as T,
    old: { ...base, ...oldRow },
    commit_timestamp: "2024-01-02T00:00:00Z",
  };
}

describe("comparePrecedence", () => {
  it("version tem precedência sobre updated_at", () => {
    expect(comparePrecedence({ version: 2, updated_at: "0" }, { version: 1, updated_at: "9" })).toBeGreaterThan(0);
  });
  it("updated_at desempata sem version", () => {
    expect(comparePrecedence({ updated_at: "2" }, { updated_at: "1" })).toBeGreaterThan(0);
  });
});

describe("applyRealtimePatch", () => {
  beforeEach(() => {});

  it("aplica patch granular sem tocar campos não alterados", () => {
    const current = { ...base };
    const res = applyRealtimePatch(current, upd({ status: "concluida", updated_at: "2024-01-03T00:00:00Z" }, { status: "pendente" }), noDeps);
    expect(res.changed).toBe(true);
    expect(res.next?.status).toBe("concluida");
    expect(res.next?.titulo).toBe("A");
    expect(res.next).not.toBe(current);
  });

  it("descarta evento mais antigo que o cache", () => {
    const current = { ...base, updated_at: "2025-01-01T00:00:00Z" };
    const res = applyRealtimePatch(current, upd({ status: "concluida" }), noDeps);
    expect(res.changed).toBe(false);
    expect(res.next).toBe(current);
  });

  it("dedupe global bloqueia o evento", () => {
    const current = { ...base };
    const deps: ReducerDeps = { ...noDeps, isEcho: () => true };
    const res = applyRealtimePatch(current, upd({ status: "concluida", updated_at: "2024-01-03T00:00:00Z" }), deps);
    expect(res.changed).toBe(false);
  });

  it("campo editável travado é preservado e vai para pendente", () => {
    const current = { ...base, titulo: "local edit" };
    const stashed: Array<[string, string, unknown]> = [];
    const deps: ReducerDeps = {
      isEcho: () => false,
      isLocked: (_id, field) => field === "titulo",
      stashPending: (id, f, v) => stashed.push([id, f, v]),
    };
    const res = applyRealtimePatch(
      current,
      upd({ titulo: "remoto", status: "concluida", updated_at: "2024-01-03T00:00:00Z" }, { titulo: "A", status: "pendente" }),
      deps,
    );
    expect(res.next?.titulo).toBe("local edit");
    expect(res.next?.status).toBe("concluida");
    expect(stashed).toEqual([["1", "titulo", "remoto"]]);
  });

  it("merge por id em coleção aninhada", () => {
    const current: T = { ...base, responsaveis: [{ id: "u1", updated_at: "1" }] };
    const payload: RealtimePayload<T> = {
      eventType: "UPDATE",
      new: {
        ...base,
        updated_at: "2024-01-03T00:00:00Z",
        responsaveis: [
          { id: "u1", updated_at: "1" },
          { id: "u2", updated_at: "1" },
        ],
      },
      old: { ...base, responsaveis: [{ id: "u1", updated_at: "1" }] },
      commit_timestamp: "2024-01-03T00:00:00Z",
    };
    const res = applyRealtimePatch(current, payload, noDeps);
    expect(res.next?.responsaveis?.map((r) => r.id)).toEqual(["u1", "u2"]);
  });

  it("DELETE retorna next=null", () => {
    const res = applyRealtimePatch(
      { ...base },
      { eventType: "DELETE", new: null, old: { id: "1" }, commit_timestamp: "2024-01-05T00:00:00Z" },
      noDeps,
    );
    expect(res.next).toBeNull();
    expect(res.changed).toBe(true);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import {
  _debugQueueSize,
  _flushNow,
  clearRealtimeBatch,
  queueRealtimeEvent,
} from "../realtimeBatch";
import type { RealtimePayload } from "../realtimeReducer";

interface T extends Record<string, any> { id: string; status?: string }

function ev(id: string, ts: string, status = "x"): RealtimePayload<T> {
  return { eventType: "UPDATE", new: { id, status }, old: { id }, commit_timestamp: ts };
}

describe("realtimeBatch", () => {
  beforeEach(() => clearRealtimeBatch("scope"));

  it("coalesce eventos do mesmo id mantendo o mais recente", () => {
    const collected: RealtimePayload<T>[] = [];
    queueRealtimeEvent<T>({ scope: "scope", onFlush: (e) => collected.push(...e) }, ev("1", "2024-01-01"));
    queueRealtimeEvent<T>({ scope: "scope", onFlush: (e) => collected.push(...e) }, ev("1", "2024-01-02", "novo"));
    queueRealtimeEvent<T>({ scope: "scope", onFlush: (e) => collected.push(...e) }, ev("2", "2024-01-01"));

    expect(_debugQueueSize("scope")).toBe(2);
    _flushNow("scope");
    expect(collected.length).toBe(2);
    expect(collected.find((e) => e.new?.id === "1")?.new?.status).toBe("novo");
  });

  it("descarta evento anterior quando novo tem precedência menor", () => {
    const collected: RealtimePayload<T>[] = [];
    const opts = { scope: "scope", onFlush: (e: any) => collected.push(...e) };
    queueRealtimeEvent<T>(opts, ev("1", "2024-01-02", "novo"));
    queueRealtimeEvent<T>(opts, ev("1", "2024-01-01", "velho"));
    _flushNow("scope");
    expect(collected[0].new?.status).toBe("novo");
  });

  it("clear libera memória do escopo", () => {
    queueRealtimeEvent<T>({ scope: "scope", onFlush: () => {} }, ev("1", "2024-01-01"));
    expect(_debugQueueSize("scope")).toBe(1);
    clearRealtimeBatch("scope");
    expect(_debugQueueSize("scope")).toBe(0);
  });
});

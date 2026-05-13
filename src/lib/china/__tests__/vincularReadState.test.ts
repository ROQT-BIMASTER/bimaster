import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isVincularRead,
  markVincularRead,
  markAllVincularRead,
  clearVincularRead,
  subscribeVincularRead,
} from "../vincularReadState";

const STORAGE_KEY = "china:vincular:read:v1";

// Reseta o módulo entre testes para limpar o cache em memória interno.
beforeEach(async () => {
  window.localStorage.clear();
  vi.resetModules();
});

describe("vincularReadState", () => {
  it("marca um item como lido e persiste no localStorage", async () => {
    const mod = await import("../vincularReadState");
    expect(mod.isVincularRead("a1")).toBe(false);
    mod.markVincularRead("a1");
    expect(mod.isVincularRead("a1")).toBe(true);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw && JSON.parse(raw)).toContain("a1");
  });

  it("markAllVincularRead adiciona apenas ids novos sem duplicar", async () => {
    const mod = await import("../vincularReadState");
    mod.markVincularRead("a1");
    mod.markAllVincularRead(["a1", "a2", "a3"]);
    expect(mod.isVincularRead("a1")).toBe(true);
    expect(mod.isVincularRead("a2")).toBe(true);
    expect(mod.isVincularRead("a3")).toBe(true);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    expect(new Set(arr).size).toBe(arr.length);
  });

  it("clearVincularRead zera o estado e dispara listeners (Reset read status)", async () => {
    const mod = await import("../vincularReadState");
    mod.markAllVincularRead(["a1", "a2"]);
    const cb = vi.fn();
    const unsubscribe = mod.subscribeVincularRead(cb);

    mod.clearVincularRead();

    expect(mod.isVincularRead("a1")).toBe(false);
    expect(mod.isVincularRead("a2")).toBe(false);
    expect(cb).toHaveBeenCalledTimes(1);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw ? JSON.parse(raw) : []).toEqual([]);

    // clear novamente não dispara listener (sem mudança real)
    mod.clearVincularRead();
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("subscribeVincularRead permite cancelar a inscrição", async () => {
    const mod = await import("../vincularReadState");
    const cb = vi.fn();
    const unsubscribe = mod.subscribeVincularRead(cb);
    mod.markVincularRead("x1");
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
    mod.markVincularRead("x2");
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

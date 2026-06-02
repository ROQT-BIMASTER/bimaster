/**
 * Cross-tab membership sync contract.
 *
 * jsdom can't open two real tabs, so this exercises the same three channels
 * the production code uses (Realtime postgres_changes, BroadcastChannel,
 * document visibilitychange) inside one process and asserts that each one
 * invalidates the membership caches AND releases any leftover body
 * `pointer-events: none` lock — proving the other tab would unblock without
 * an F5.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---- supabase mock: capture the realtime handler so the test can fire it ----
const mocks = vi.hoisted(() => {
  const state: { mocks.state.realtimeHandler: ((payload: any) => void) | null } = {
    mocks.state.realtimeHandler: null,
  };
  return {
    state,
    removeChannel: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    channel: vi.fn(() => {
      const api: any = {
        on: vi.fn((_event: string, _filter: any, handler: any) => {
          mocks.state.mocks.state.realtimeHandler = handler;
          return api;
        }),
        subscribe: vi.fn(() => api),
      };
      return api;
    }),
    removeChannel: mocks.removeChannel,
  },
}));


vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-current" }, loading: false, session: {} }),
}));

vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ isAdmin: false, isGerente: false }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useProjetoMembros } from "../useProjetoMembros";

const PROJETO_ID = "projeto-abc";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function lockBodyPointerEvents() {
  document.body.style.pointerEvents = "none";
}

describe("useProjetoMembros — cross-tab membership sync", () => {
  let qc: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.state.realtimeHandler = null;
    mocks.removeChannel.mockClear();
    document.body.style.pointerEvents = "";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    invalidateSpy = vi.spyOn(qc, "invalidateQueries");
  });

  afterEach(() => {
    qc.clear();
    invalidateSpy.mockRestore();
  });

  it("Realtime DELETE in another tab invalidates membership caches and unsticks body", async () => {
    renderHook(() => useProjetoMembros(PROJETO_ID), { wrapper: wrapper(qc) });

    // Wait until the effect registered the realtime handler.
    await waitFor(() => expect(mocks.state.realtimeHandler).toBeTruthy());

    lockBodyPointerEvents();
    invalidateSpy.mockClear();

    act(() => {
      mocks.state.realtimeHandler!({ eventType: "DELETE", old: { user_id: "user-current", projeto_id: PROJETO_ID } });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (c) => (c[0] as { queryKey: unknown[] }).queryKey.join("|"),
    );
    expect(invalidatedKeys).toContain(`projeto_membros|${PROJETO_ID}`);
    expect(invalidatedKeys).toContain(`projeto-tarefas-v2|${PROJETO_ID}`);
    expect(invalidatedKeys).toContain(`projetos-membros`);
    expect(invalidatedKeys).toContain(`projetos-team-data`);
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("BroadcastChannel message from another tab invalidates caches and unsticks body", async () => {
    renderHook(() => useProjetoMembros(PROJETO_ID), { wrapper: wrapper(qc) });

    // Allow the BroadcastChannel effect to subscribe.
    await act(async () => {
      await Promise.resolve();
    });

    lockBodyPointerEvents();
    invalidateSpy.mockClear();

    await act(async () => {
      const bc = new BroadcastChannel("projeto-membros-sync");
      bc.postMessage({ type: "membro_removido", projetoId: PROJETO_ID });
      bc.close();
      // BroadcastChannel deliveries are async — flush microtasks.
      await new Promise((r) => setTimeout(r, 0));
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (c) => (c[0] as { queryKey: unknown[] }).queryKey.join("|"),
    );
    expect(invalidatedKeys).toContain(`projeto_membros|${PROJETO_ID}`);
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("ignores BroadcastChannel messages for a different projeto", async () => {
    renderHook(() => useProjetoMembros(PROJETO_ID), { wrapper: wrapper(qc) });

    await act(async () => {
      await Promise.resolve();
    });

    invalidateSpy.mockClear();

    await act(async () => {
      const bc = new BroadcastChannel("projeto-membros-sync");
      bc.postMessage({ type: "membro_removido", projetoId: "outro-projeto" });
      bc.close();
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it("visibilitychange → visible triggers cache invalidation and unsticks body", async () => {
    renderHook(() => useProjetoMembros(PROJETO_ID), { wrapper: wrapper(qc) });

    await act(async () => {
      await Promise.resolve();
    });

    lockBodyPointerEvents();
    invalidateSpy.mockClear();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (c) => (c[0] as { queryKey: unknown[] }).queryKey.join("|"),
    );
    expect(invalidatedKeys).toContain(`projeto_membros|${PROJETO_ID}`);
    expect(document.body.style.pointerEvents).toBe("");
  });
});

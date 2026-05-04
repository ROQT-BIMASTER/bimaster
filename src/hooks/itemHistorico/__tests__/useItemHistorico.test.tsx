import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  useItemHistorico,
  useComentarItem,
  HISTORICO_PAGE_SIZE,
} from "@/hooks/itemHistorico";

// ---------- helpers ----------

const ITEM_ID = "11111111-1111-1111-1111-111111111111";

function makeRows(count: number, startIndex = 0) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `row-${startIndex + i}`,
    item_id: ITEM_ID,
    user_id: "user-1",
    acao: "movimentacao",
    origem: "kanban",
    coluna_origem: "todo",
    coluna_destino: "doing",
    status_anterior: null,
    status_novo: null,
    etapa_anterior_nome: null,
    etapa_atual_nome: null,
    comentario: null,
    metadata: {},
    created_at: new Date(2026, 4, 4 - i).toISOString(),
  }));
}

/**
 * Builder de query encadeada compatível com:
 *   .from(t).select("*").eq(...).order(...).range(...).gte(...).lte(...)
 * Resolve a Promise com { data, error } no `await`.
 */
function buildQuery(rows: any[]) {
  const captured: { range?: [number, number]; eqs: any[] } = { eqs: [] };
  const q: any = {
    _captured: captured,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn(function (this: any, col: string, val: any) {
      captured.eqs.push([col, val]);
      return this;
    }),
    order: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    range: vi.fn(function (this: any, from: number, to: number) {
      captured.range = [from, to];
      return this;
    }),
    in: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve({ data: rows, error: null }),
  };
  return q;
}

function setupSupabaseMock(auditRows: any[]) {
  const auditQuery = buildQuery(auditRows);
  const profilesQuery = buildQuery([{ id: "user-1", full_name: "Alice" }]);

  (supabase.from as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => {
      if (table === "profiles") return profilesQuery;
      return auditQuery;
    },
  );

  return { auditQuery, profilesQuery };
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return { client, Wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------- useItemHistorico ----------

describe("useItemHistorico", () => {
  it("não dispara request quando itemId é null", () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useItemHistorico(null), {
      wrapper: Wrapper,
    });
    expect(result.current.isFetching).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("aplica range da primeira página e resolve nome do usuário", async () => {
    const rows = makeRows(HISTORICO_PAGE_SIZE);
    const { auditQuery } = setupSupabaseMock(rows);

    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useItemHistorico(ITEM_ID), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(auditQuery._captured.range).toEqual([0, HISTORICO_PAGE_SIZE - 1]);
    expect(auditQuery._captured.eqs).toContainEqual(["item_id", ITEM_ID]);
    const first = (result.current.data as any).pages[0][0];
    expect(first.user_nome).toBe("Alice");
    expect(result.current.hasNextPage).toBe(true);
  });

  it("não tem próxima página quando vem menos que PAGE_SIZE", async () => {
    setupSupabaseMock(makeRows(5));
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useItemHistorico(ITEM_ID), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("aplica filtro por ação quando diferente de 'todos'", async () => {
    const { auditQuery } = setupSupabaseMock(makeRows(2));
    const { Wrapper } = wrapper();
    const { result } = renderHook(
      () => useItemHistorico(ITEM_ID, { acao: "delegacao" }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(auditQuery._captured.eqs).toContainEqual(["acao", "delegacao"]);
  });

  it("não filtra quando acao é 'todos'", async () => {
    const { auditQuery } = setupSupabaseMock(makeRows(2));
    const { Wrapper } = wrapper();
    const { result } = renderHook(
      () => useItemHistorico(ITEM_ID, { acao: "todos" }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      auditQuery._captured.eqs.find(([c]: any) => c === "acao"),
    ).toBeUndefined();
  });

  it("aplica gte/lte para intervalo de datas", async () => {
    const { auditQuery } = setupSupabaseMock(makeRows(1));
    const { Wrapper } = wrapper();
    const { result } = renderHook(
      () =>
        useItemHistorico(ITEM_ID, {
          dataDe: "2026-01-01",
          dataAte: "2026-12-31",
        }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(auditQuery.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-01-01T00:00:00",
    );
    expect(auditQuery.lte).toHaveBeenCalledWith(
      "created_at",
      "2026-12-31T23:59:59",
    );
  });

  it("respeita ordem ascendente", async () => {
    const { auditQuery } = setupSupabaseMock(makeRows(1));
    const { Wrapper } = wrapper();
    const { result } = renderHook(
      () => useItemHistorico(ITEM_ID, { ordem: "asc" }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(auditQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
  });
});

// ---------- useComentarItem ----------

describe("useComentarItem", () => {
  it("invalida cache de item-historico após sucesso", async () => {
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockResolvedValue({ data: "novo-comentario-id", error: null });

    const { client, Wrapper } = wrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useComentarItem(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        itemId: ITEM_ID,
        comentario: "ok",
      });
    });

    expect(supabase.rpc).toHaveBeenCalledWith("rpc_comentar_item_aprovacao", {
      p_item_id: ITEM_ID,
      p_comentario: "ok",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["item-historico", ITEM_ID],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["item-aprovacao-auditoria", ITEM_ID],
    });
  });

  it("propaga erro da RPC sem invalidar cache", async () => {
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>) = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });

    const { client, Wrapper } = wrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useComentarItem(), {
      wrapper: Wrapper,
    });

    await expect(
      result.current.mutateAsync({ itemId: ITEM_ID, comentario: "x" }),
    ).rejects.toBeTruthy();

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

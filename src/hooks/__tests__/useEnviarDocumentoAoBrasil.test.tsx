/**
 * Regression test: useEnviarDocumentoAoBrasil deve promover o status pai
 * para "enviado_parcial" quando ainda há rascunhos, e para "enviado_brasil"
 * apenas quando todos os documentos da submissão já saíram da China.
 *
 * O hook delega à instância singleton de `supabase`, então mockamos
 * `@/integrations/supabase/client` com um query-builder fluente que registra
 * as chamadas e devolve valores controlados por cenário.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

type DocRow = { status: string };

let docsScenario: DocRow[] = [];
const updateCalls: Array<{ table: string; patch: any; eq: [string, any][] }> = [];

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/integrations/supabase/client", () => {
  function builder(table: string) {
    const eqList: [string, any][] = [];
    const api: any = {
      _table: table,
      select: (_cols: string) => api,
      update: (patch: any) => {
        api._mode = "update";
        api._patch = patch;
        return api;
      },
      eq: (col: string, val: any) => {
        eqList.push([col, val]);
        if (api._mode === "update") {
          // resolve "update" como Promise; record call
          return Promise.resolve({ error: null }).then((r) => {
            updateCalls.push({ table, patch: api._patch, eq: eqList.slice() });
            return r;
          });
        }
        // chained eq for select continues
        return api;
      },
      then: (resolve: any) => {
        // when SELECT is awaited (no further eq), resolve with scenario data
        return Promise.resolve({ data: docsScenario, error: null }).then(resolve);
      },
    };
    return api;
  }
  return {
    supabase: {
      from: (t: string) => builder(t),
    },
  };
});

import { useEnviarDocumentoAoBrasil } from "@/hooks/useEnviarDocumentoAoBrasil";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  updateCalls.length = 0;
  docsScenario = [];
});

describe("useEnviarDocumentoAoBrasil — status pai", () => {
  it("envio individual com docs em rascunho restantes → enviado_parcial", async () => {
    docsScenario = [{ status: "pendente" }, { status: "rascunho" }, { status: "rascunho" }];
    const { result } = renderHook(() => useEnviarDocumentoAoBrasil(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ submissao_id: "s1", documento_id: "d1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const subUpdate = updateCalls.find((c) => c.table === "china_produto_submissoes");
    expect(subUpdate?.patch.status).toBe("enviado_parcial");
  });

  it("envio individual sem rascunhos restantes → enviado_brasil", async () => {
    docsScenario = [{ status: "pendente" }, { status: "pendente" }];
    const { result } = renderHook(() => useEnviarDocumentoAoBrasil(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ submissao_id: "s1", documento_id: "d1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const subUpdate = updateCalls.find((c) => c.table === "china_produto_submissoes");
    expect(subUpdate?.patch.status).toBe("enviado_brasil");
  });

  it("envio em lote (sem documento_id) → sempre enviado_brasil", async () => {
    docsScenario = [{ status: "rascunho" }]; // ignorado nesse caminho
    const { result } = renderHook(() => useEnviarDocumentoAoBrasil(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ submissao_id: "s1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const subUpdate = updateCalls.find((c) => c.table === "china_produto_submissoes");
    expect(subUpdate?.patch.status).toBe("enviado_brasil");
  });
});

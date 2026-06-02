/**
 * Contrato de reconciliação banco ↔ frontend para tarefas.
 *
 * Garante que, após qualquer mutação local (updateTarefa, addResponsavel,
 * addColaborador) — seja na tarefa-pai ou em subtarefa — o cache:
 *   1. recebe um patch otimista imediato (UI reflete na hora);
 *   2. é reconciliado com o servidor em ≤ 600 ms (scheduleReconcile dispara
 *      `refetchQueries({ type: "active" })`);
 *   3. termina **igual** ao payload do banco — sem campos órfãos ou
 *      divergentes em `data_inicio_planejada`, `responsaveis[]` e
 *      `colaboradores[]`.
 *
 * jsdom não roda Supabase real; o mock devolve dois snapshots distintos da
 * RPC `get_projeto_tarefas_v2` (v1 antes da escrita, v2 depois). O teste
 * confirma o swap após o timer da reconciliação.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const PROJETO_ID = "00000000-0000-0000-0000-000000000001";
const TAREFA_ID = "00000000-0000-0000-0000-000000000010";
const SUB_ID = "00000000-0000-0000-0000-000000000011";
const USER_A = "00000000-0000-0000-0000-0000000000aa";
const USER_B = "00000000-0000-0000-0000-0000000000bb";
const SECAO_ID = "00000000-0000-0000-0000-000000000020";

type RpcPayload = {
  secoes: any[];
  tarefas: any[];
  team_members: any[];
  is_partial_view: boolean;
  restrict_to_own: boolean;
  total_secoes_projeto: number;
  total_tarefas_projeto: number;
  visible_tarefas_count: number;
};

function makePayload(over: Partial<{
  tarefaInicio: string | null;
  tarefaResp: string[];
  tarefaColab: string[];
  subInicio: string | null;
  subResp: string[];
}> = {}): RpcPayload {
  const tarefaResp = over.tarefaResp ?? [];
  const tarefaColab = over.tarefaColab ?? [];
  const subResp = over.subResp ?? [];
  const team = [
    { id: USER_A, nome: "Alice", avatar_url: null },
    { id: USER_B, nome: "Bob", avatar_url: null },
  ];
  return {
    secoes: [{ id: SECAO_ID, projeto_id: PROJETO_ID, nome: "Geral", ordem: 0, tem_briefing: false, created_at: "2026-01-01T00:00:00Z" }],
    tarefas: [
      {
        id: TAREFA_ID,
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: null,
        titulo: "Tarefa pai",
        descricao: null,
        responsavel_id: tarefaResp[0] ?? null,
        criador_id: USER_A,
        status: "pendente",
        prioridade: "media",
        data_prazo: null,
        data_inicio_planejada: over.tarefaInicio ?? null,
        data_conclusao: null,
        codigo: null,
        estagio: null,
        visibilidade: "publica",
        ordem: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        produto_id: null,
        responsaveis: tarefaResp.map((u) => ({ user_id: u, nome: team.find((t) => t.id === u)?.nome ?? "?", avatar_url: null, papel: "responsavel" })),
        colaboradores: tarefaColab.map((u) => ({ user_id: u, nome: team.find((t) => t.id === u)?.nome ?? "?", avatar_url: null })),
      },
      {
        id: SUB_ID,
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: TAREFA_ID,
        titulo: "Subtarefa",
        descricao: null,
        responsavel_id: subResp[0] ?? null,
        criador_id: USER_A,
        status: "pendente",
        prioridade: "media",
        data_prazo: null,
        data_inicio_planejada: over.subInicio ?? null,
        data_conclusao: null,
        codigo: null,
        estagio: null,
        visibilidade: "publica",
        ordem: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        produto_id: null,
        responsaveis: subResp.map((u) => ({ user_id: u, nome: team.find((t) => t.id === u)?.nome ?? "?", avatar_url: null, papel: "responsavel" })),
        colaboradores: [],
      },
    ],
    team_members: team,
    is_partial_view: false,
    restrict_to_own: false,
    total_secoes_projeto: 1,
    total_tarefas_projeto: 2,
    visible_tarefas_count: 2,
  };
}

// ----- supabase mock controlado por refs mutáveis -----
const mocks = vi.hoisted(() => {
  const state: {
    rpcPayload: any;
    updateTarefaArg: any;
    inserts: Array<{ table: string; row: any }>;
    deletes: Array<{ table: string; eq: Record<string, any> }>;
  } = {
    rpcPayload: null,
    updateTarefaArg: null,
    inserts: [],
    deletes: [],
  };
  return { state };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: mocks.state.rpcPayload, error: null })),
    from: vi.fn((table: string) => ({
      update: vi.fn((row: any) => ({
        eq: vi.fn(() => ({
          select: vi.fn(async () => {
            mocks.state.updateTarefaArg = row;
            return { data: [{ id: TAREFA_ID }], error: null };
          }),
        })),
      })),
      insert: vi.fn((row: any) => ({
        select: vi.fn(async () => {
          mocks.state.inserts.push({ table, row });
          return { data: [{ id: "new" }], error: null };
        }),
      })),
      upsert: vi.fn((row: any) => ({
        select: vi.fn(async () => {
          mocks.state.inserts.push({ table, row });
          return { data: [{ id: "new" }], error: null };
        }),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(async () => {
              mocks.state.deletes.push({ table, eq: {} });
              return { data: [{ id: "del" }], error: null };
            }),
          })),
          select: vi.fn(async () => {
            mocks.state.deletes.push({ table, eq: {} });
            return { data: [{ id: "del" }], error: null };
          }),
        })),
      })),
    })),
    channel: vi.fn(() => {
      const api: any = { on: vi.fn(() => api), subscribe: vi.fn(() => api) };
      return api;
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: USER_A, email: "alice@test.com" } }),
}));

vi.mock("@/lib/projetos/auditoriaTarefa", () => ({
  registrarAuditoriaTarefa: vi.fn(async () => {}),
}));

vi.mock("@/lib/projetos/confirmConclusao", () => ({
  confirmConclusaoTarefa: vi.fn(async () => true),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { useProjetoTarefas } from "@/hooks/useProjetoTarefas";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("useProjetoTarefas — reconciliação banco ↔ cache", () => {
  beforeEach(() => {
    mocks.state.rpcPayload = makePayload();
    mocks.state.updateTarefaArg = null;
    mocks.state.inserts = [];
    mocks.state.deletes = [];
  });

  async function setup() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const { result } = renderHook(() => useProjetoTarefas(PROJETO_ID), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => expect(result.current.tarefas.length).toBe(2), { timeout: 2000 });
    return { qc, result };
  }


  it("data_inicio_planejada: patch otimista + reconcile coincidem com o servidor", async () => {
    const { result } = await setup();

    // Simula: usuário escolhe 2026-06-10 no calendário do detalhe.
    const novaData = "2026-06-10";
    // Servidor já vai responder com o valor persistido na próxima fetch.
    mocks.state.rpcPayload = makePayload({ tarefaInicio: novaData });

    await act(async () => {
      result.current.updateTarefa.mutate({ id: TAREFA_ID, data_inicio_planejada: novaData } as any);
    });

    // 1. Patch otimista imediato.
    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect((t as any)?.data_inicio_planejada).toBe(novaData);
    });

    // 2. Avança o debounce (600 ms) e deixa o refetch ativo concluir.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 750));
    });
    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect((t as any)?.data_inicio_planejada).toBe(novaData);
    });
    // 3. Update SQL incluiu o campo.
    expect(mocks.state.updateTarefaArg?.data_inicio_planejada).toBe(novaData);
  });

  it("addResponsavel na tarefa-pai: lista local converge com o servidor", async () => {
    const { result } = await setup();
    mocks.state.rpcPayload = makePayload({ tarefaResp: [USER_B] });

    await act(async () => {
      result.current.addResponsavel.mutate({ tarefaId: TAREFA_ID, userId: USER_B });
    });

    // Otimista
    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect(t?.responsaveis?.some((r) => r.user_id === USER_B)).toBe(true);
    });

    // Reconcile
    await act(async () => {
      await new Promise((r) => setTimeout(r, 750));
    });
    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect(t?.responsaveis?.map((r) => r.user_id).sort()).toEqual([USER_B]);
    });

    // Insert no junction table
    expect(
      mocks.state.inserts.some(
        (i) => i.table === "projeto_tarefa_responsaveis" && i.row.tarefa_id === TAREFA_ID && i.row.user_id === USER_B,
      ),
    ).toBe(true);
  });

  it("addColaborador (seguidor) na tarefa-pai: lista local converge com o servidor", async () => {
    const { result } = await setup();
    mocks.state.rpcPayload = makePayload({ tarefaColab: [USER_B] });

    await act(async () => {
      result.current.addColaborador.mutate({ tarefaId: TAREFA_ID, userId: USER_B });
    });

    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect(t?.colaboradores?.some((c) => c.user_id === USER_B)).toBe(true);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 750));
    });
    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect(t?.colaboradores?.map((c) => c.user_id).sort()).toEqual([USER_B]);
    });

    expect(
      mocks.state.inserts.some((i) => i.table === "projeto_tarefa_colaboradores"),
    ).toBe(true);
  });

  it("subtarefa: data_inicio_planejada e responsável também espelham o banco", async () => {
    const { result } = await setup();

    // Update via updateTarefa (data + responsavel_id) na subtarefa.
    mocks.state.rpcPayload = makePayload({ subInicio: "2026-07-01", subResp: [USER_B] });

    await act(async () => {
      result.current.updateTarefa.mutate({
        id: SUB_ID,
        data_inicio_planejada: "2026-07-01",
        responsavel_id: USER_B,
      } as any);
    });

    // Otimista
    await waitFor(() => {
      const s = result.current.tarefas.find((x) => x.id === SUB_ID);
      expect((s as any)?.data_inicio_planejada).toBe("2026-07-01");
      expect(s?.responsavel_id).toBe(USER_B);
    });

    // Reconcile com banco
    await act(async () => {
      await new Promise((r) => setTimeout(r, 750));
    });
    await waitFor(() => {
      const s = result.current.tarefas.find((x) => x.id === SUB_ID);
      expect((s as any)?.data_inicio_planejada).toBe("2026-07-01");
      expect(s?.responsavel_id).toBe(USER_B);
      expect(s?.responsaveis?.map((r) => r.user_id).sort()).toEqual([USER_B]);
    });
  });

  it("scheduleReconcile é debounced — múltiplas mutações em sequência disparam UM refetch", async () => {
    const { result, qc } = await setup();
    const rpc = (await import("@/integrations/supabase/client")).supabase.rpc as any;
    const callsAntes = rpc.mock.calls.length;

    mocks.state.rpcPayload = makePayload({ tarefaResp: [USER_B], tarefaColab: [USER_B] });

    await act(async () => {
      result.current.addResponsavel.mutate({ tarefaId: TAREFA_ID, userId: USER_B });
      result.current.addColaborador.mutate({ tarefaId: TAREFA_ID, userId: USER_B });
    });

    // Antes do debounce vencer: 0 refetches novos.
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(rpc.mock.calls.length - callsAntes).toBeLessThanOrEqual(0);

    // Depois do debounce: exatamente 1 refetch (colapsa as duas mutações).
    await act(async () => { await new Promise((r) => setTimeout(r, 500)); });
    await waitFor(() => {
      expect(rpc.mock.calls.length - callsAntes).toBe(1);
    });
    qc.clear();
  });
});

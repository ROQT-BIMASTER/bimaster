/**
 * Cenários de FALHA do contrato de reconciliação banco ↔ frontend.
 *
 * Para cada mutação otimista, validamos que ao receber erro (RLS negado,
 * rede caiu, timeout) o front:
 *   1. Reverte o patch otimista para o estado anterior (rollback de
 *      `context.previous` em onError);
 *   2. Dispara reconciliação (`scheduleReconcile` em onSettled) — a próxima
 *      leitura do servidor é o que vale, não o otimismo;
 *   3. Mantém o snapshot final IGUAL ao que o banco realmente tem
 *      (sem responsáveis/colaboradores "fantasma").
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const PROJETO_ID = "00000000-0000-0000-0000-000000000001";
const TAREFA_ID = "00000000-0000-0000-0000-000000000010";
const USER_A = "00000000-0000-0000-0000-0000000000aa";
const USER_B = "00000000-0000-0000-0000-0000000000bb";
const SECAO_ID = "00000000-0000-0000-0000-000000000020";

function basePayload(over: Partial<{ resp: string[]; colab: string[] }> = {}) {
  const resp = over.resp ?? [];
  const colab = over.colab ?? [];
  const team = [
    { id: USER_A, nome: "Alice", avatar_url: null },
    { id: USER_B, nome: "Bob", avatar_url: null },
  ];
  return {
    secoes: [{ id: SECAO_ID, projeto_id: PROJETO_ID, nome: "Geral", ordem: 0, tem_briefing: false, created_at: "2026-01-01T00:00:00Z" }],
    tarefas: [{
      id: TAREFA_ID, projeto_id: PROJETO_ID, secao_id: SECAO_ID, parent_tarefa_id: null,
      titulo: "Tarefa", descricao: null, responsavel_id: resp[0] ?? null, criador_id: USER_A,
      status: "pendente", prioridade: "media", data_prazo: null,
      data_inicio_planejada: null, data_conclusao: null, codigo: null, estagio: null,
      visibilidade: "publica", ordem: 0, created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z", produto_id: null,
      responsaveis: resp.map((u) => ({ user_id: u, nome: team.find(t => t.id === u)?.nome ?? "?", avatar_url: null, papel: "responsavel" })),
      colaboradores: colab.map((u) => ({ user_id: u, nome: team.find(t => t.id === u)?.nome ?? "?", avatar_url: null })),
    }],
    team_members: team,
    is_partial_view: false, restrict_to_own: false,
    total_secoes_projeto: 1, total_tarefas_projeto: 1, visible_tarefas_count: 1,
  };
}

const mocks = vi.hoisted(() => ({
  state: {
    rpcPayload: null as any,
    failFrom: false,          // bloqueia insert/delete/update do .from() com erro de RLS
    failTimeout: false,       // simula timeout na mutationFn
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: mocks.state.rpcPayload, error: null })),
    from: vi.fn(() => {
      const maybeFail = async (okValue: any) => {
        if (mocks.state.failTimeout) {
          await new Promise((_r, rej) => setTimeout(() => rej(new Error("Request timeout")), 20));
        }
        if (mocks.state.failFrom) {
          return { data: null, error: { message: "new row violates row-level security policy", code: "42501" } };
        }
        return okValue;
      };
      const selectChain = () => ({
        select: vi.fn(async () => maybeFail({ data: [{ id: "ok" }], error: null })),
        maybeSingle: vi.fn(async () => maybeFail({ data: { id: "ok" }, error: null })),
      });
      const eqChain: any = () => ({
        eq: vi.fn(() => eqChain()),
        select: vi.fn(async () => maybeFail({ data: [{ id: "ok" }], error: null })),
        maybeSingle: vi.fn(async () => maybeFail({ data: { id: "ok" }, error: null })),
      });
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => eqChain()) })),
        update: vi.fn(() => ({ eq: vi.fn(() => eqChain()) })),
        insert: vi.fn(() => selectChain()),
        upsert: vi.fn(() => selectChain()),
        delete: vi.fn(() => ({ eq: vi.fn(() => eqChain()) })),
      };
    }),
    channel: vi.fn(() => {
      const api: any = { on: vi.fn(() => api), subscribe: vi.fn(() => api) };
      return api;
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: USER_A, email: "a@t.com" } }),
}));
vi.mock("@/lib/projetos/auditoriaTarefa", () => ({ registrarAuditoriaTarefa: vi.fn(async () => {}) }));
vi.mock("@/lib/projetos/confirmConclusao", () => ({ confirmConclusaoTarefa: vi.fn(async () => true) }));
vi.mock("@/lib/logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const toastMocks = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastMocks.error, info: vi.fn() } }));

import { useProjetoTarefas } from "@/hooks/useProjetoTarefas";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

async function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const { result } = renderHook(() => useProjetoTarefas(PROJETO_ID), { wrapper: wrapper(qc) });
  await waitFor(() => expect(result.current.tarefas.length).toBe(1), { timeout: 2000 });
  return { qc, result };
}

describe("useProjetoTarefas — cenários de falha", () => {
  beforeEach(() => {
    mocks.state.rpcPayload = basePayload();
    mocks.state.failFrom = false;
    mocks.state.failTimeout = false;
    toastMocks.error.mockReset();
  });

  it("addResponsavel rejeitado pelo banco: rollback + reconcile espelha o servidor (USER_B não persiste)", async () => {
    const { result } = await setup();
    mocks.state.failFrom = true;
    // O servidor (RPC) continua dizendo: sem responsáveis.
    mocks.state.rpcPayload = basePayload({ resp: [] });

    await act(async () => {
      result.current.addResponsavel.mutate({ tarefaId: TAREFA_ID, userId: USER_B });
    });

    // Após erro + reconcile, lista volta a ficar vazia (espelho do banco).
    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect(t?.responsaveis ?? []).toEqual([]);
      expect(t?.responsavel_id ?? null).toBeNull();
    });
    expect(toastMocks.error).toHaveBeenCalled();
  });

  it("addColaborador rejeitado: rollback remove o seguidor fantasma e o banco prevalece", async () => {
    const { result } = await setup();
    mocks.state.failFrom = true;
    mocks.state.rpcPayload = basePayload({ colab: [] });

    await act(async () => {
      result.current.addColaborador.mutate({ tarefaId: TAREFA_ID, userId: USER_B });
    });

    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect(t?.colaboradores ?? []).toEqual([]);
    });
    expect(toastMocks.error).toHaveBeenCalled();
  });

  it("removeResponsavel falha: responsável removido otimisticamente volta para a lista", async () => {
    // Estado inicial já tem USER_B como responsável.
    mocks.state.rpcPayload = basePayload({ resp: [USER_B] });
    const { result } = await setup();

    mocks.state.failFrom = true;
    // Banco continua tendo USER_B (a remoção não passou pela RLS).
    mocks.state.rpcPayload = basePayload({ resp: [USER_B] });

    await act(async () => {
      result.current.removeResponsavel.mutate({ tarefaId: TAREFA_ID, userId: USER_B });
    });

    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect(t?.responsaveis?.map((r) => r.user_id)).toEqual([USER_B]);
    });
    expect(toastMocks.error).toHaveBeenCalled();
  });

  it("timeout em addResponsavel: mutação rejeita, rollback + reconcile mantêm consistência", async () => {
    const { result } = await setup();
    mocks.state.failTimeout = true;
    mocks.state.rpcPayload = basePayload({ resp: [] });

    await act(async () => {
      result.current.addResponsavel.mutate({ tarefaId: TAREFA_ID, userId: USER_B });
    });

    // Aguarda o timeout (20ms) + debounce do reconcile (600ms).
    await act(async () => { await new Promise((r) => setTimeout(r, 900)); });
    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect(t?.responsaveis ?? []).toEqual([]);
    });
    expect(toastMocks.error).toHaveBeenCalled();
  });

  it("updateTarefa (data_inicio_planejada) falha: campo otimista é revertido e refletido do banco", async () => {
    const { result } = await setup();
    mocks.state.failFrom = true;
    // Banco mantém data nula.
    mocks.state.rpcPayload = basePayload();

    await act(async () => {
      result.current.updateTarefa.mutate({ id: TAREFA_ID, data_inicio_planejada: "2026-08-15" } as any);
    });

    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    await waitFor(() => {
      const t = result.current.tarefas.find((x) => x.id === TAREFA_ID);
      expect((t as any)?.data_inicio_planejada ?? null).toBeNull();
    });
    expect(toastMocks.error).toHaveBeenCalled();
  });
});

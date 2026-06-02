/**
 * Integração — projetoTarefasCache
 *
 * Cobre o cenário crítico que motivou o fix do "piscar" da lista:
 * - Snapshot otimista com tempId.
 * - Servidor responde com id real → `swapTempTarefaId`.
 * - As linhas NÃO afetadas mantêm identidade de objeto (`===`), que é o
 *   sinal lido por `React.memo` / keys estáveis para evitar re-mount.
 * - `markStale` não dispara refetch imediato (refetchType: "none").
 *
 * Também valida `moveTarefa`, `patchTarefa` (prioridade/status) e
 * `reorderSecao` — todas as operações enumeradas pela diretriz.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  createProjetoTarefasCache,
  projetoTarefasQueryKey,
} from "@/lib/projetos/projetoTarefasCache";
import type {
  ProjetoTarefa,
  ProjetoTarefasView,
} from "@/hooks/useProjetoTarefas";

const PROJETO_ID = "proj-1";

const makeTarefa = (id: string, over: Partial<ProjetoTarefa> = {}): ProjetoTarefa =>
  ({
    id,
    projeto_id: PROJETO_ID,
    secao_id: "sec-A",
    parent_tarefa_id: null,
    titulo: `Tarefa ${id}`,
    descricao: null,
    responsavel_id: null,
    criador_id: null,
    status: "pendente",
    prioridade: "media",
    data_prazo: null,
    data_conclusao: null,
    codigo: null,
    estagio: null,
    visibilidade: "publica",
    ordem: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    produto_id: null,
    ...over,
  } as ProjetoTarefa);

const seed = (qc: QueryClient, tarefas: ProjetoTarefa[]) => {
  const view: ProjetoTarefasView = {
    secoes: [
      {
        id: "sec-A",
        projeto_id: PROJETO_ID,
        nome: "A",
        ordem: 0,
        tem_briefing: false,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "sec-B",
        projeto_id: PROJETO_ID,
        nome: "B",
        ordem: 1,
        tem_briefing: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    tarefas,
    teamMembers: [],
    isPartialView: false,
    restrictToOwn: false,
    totalSecoesProjeto: 2,
    totalTarefasProjeto: tarefas.length,
    visibleTarefasCount: tarefas.length,
  };
  qc.setQueryData(projetoTarefasQueryKey(PROJETO_ID), view);
};

describe("projetoTarefasCache", () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it("swapTempTarefaId preserva identidade das linhas não afetadas (sem re-render/flicker)", () => {
    const t1 = makeTarefa("t-1");
    const t2 = makeTarefa("t-2");
    const tempId = "temp-123";
    const optimistic = makeTarefa(tempId, { titulo: "Nova" });
    seed(qc, [t1, t2, optimistic]);

    const cache = createProjetoTarefasCache(qc, PROJETO_ID);
    cache.swapTempTarefaId(tempId, "real-999", {
      codigo: "TSK-7",
      created_at: "2026-01-02T00:00:00Z",
    });

    const next = cache.get()!;
    // Identidade preservada nos vizinhos => React.memo não re-renderiza.
    expect(next.tarefas[0]).toBe(t1);
    expect(next.tarefas[1]).toBe(t2);
    // Linha trocada tem o id real + extras aplicados, demais campos intactos.
    const swapped = next.tarefas[2];
    expect(swapped.id).toBe("real-999");
    expect(swapped.codigo).toBe("TSK-7");
    expect(swapped.titulo).toBe("Nova");
    expect(swapped.secao_id).toBe("sec-A");
  });

  it("markStale NÃO dispara refetch imediato (refetchType: 'none')", async () => {
    seed(qc, [makeTarefa("t-1")]);
    const cache = createProjetoTarefasCache(qc, PROJETO_ID);
    const spy = vi.spyOn(qc, "invalidateQueries");

    cache.markStale();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ refetchType: "none" }),
    );
  });

  it("moveTarefa altera apenas secao_id e mantém demais linhas idênticas", () => {
    const t1 = makeTarefa("t-1");
    const t2 = makeTarefa("t-2");
    seed(qc, [t1, t2]);

    const cache = createProjetoTarefasCache(qc, PROJETO_ID);
    cache.moveTarefa("t-2", "sec-B");

    const next = cache.get()!;
    expect(next.tarefas[0]).toBe(t1);
    expect(next.tarefas[1].secao_id).toBe("sec-B");
    expect(next.tarefas[1].id).toBe("t-2");
  });

  it("patchTarefa aplica mudança de prioridade/status preservando os demais", () => {
    const t1 = makeTarefa("t-1");
    const t2 = makeTarefa("t-2");
    seed(qc, [t1, t2]);

    const cache = createProjetoTarefasCache(qc, PROJETO_ID);
    cache.patchTarefa("t-1", { prioridade: "alta", status: "em_andamento" });

    const next = cache.get()!;
    expect(next.tarefas[0].prioridade).toBe("alta");
    expect(next.tarefas[0].status).toBe("em_andamento");
    expect(next.tarefas[1]).toBe(t2);
  });

  it("reorderSecao reescreve apenas o campo ordem das tarefas da seção alvo", () => {
    const a1 = makeTarefa("a-1", { ordem: 0 });
    const a2 = makeTarefa("a-2", { ordem: 1 });
    const a3 = makeTarefa("a-3", { ordem: 2 });
    const bOther = makeTarefa("b-1", { secao_id: "sec-B", ordem: 0 });
    seed(qc, [a1, a2, a3, bOther]);

    const cache = createProjetoTarefasCache(qc, PROJETO_ID);
    cache.reorderSecao("sec-A", ["a-3", "a-1", "a-2"]);

    const next = cache.get()!;
    const byId = Object.fromEntries(next.tarefas.map((t) => [t.id, t]));
    expect(byId["a-3"].ordem).toBe(0);
    expect(byId["a-1"].ordem).toBe(1);
    expect(byId["a-2"].ordem).toBe(2);
    // Seção B não tocada — mesma referência.
    expect(byId["b-1"]).toBe(bOther);
  });

  it("restore reverte para o snapshot anterior (rollback de mutação)", () => {
    const t1 = makeTarefa("t-1");
    seed(qc, [t1]);
    const cache = createProjetoTarefasCache(qc, PROJETO_ID);
    const snapshot = cache.get();

    cache.patchTarefa("t-1", { titulo: "alterado" });
    expect(cache.get()!.tarefas[0].titulo).toBe("alterado");

    cache.restore(snapshot);
    expect(cache.get()!.tarefas[0].titulo).toBe("Tarefa t-1");
  });

  it("patch é no-op quando o cache está vazio (defensive)", () => {
    const cache = createProjetoTarefasCache(qc, PROJETO_ID);
    expect(() =>
      cache.patch((v) => ({ ...v, tarefas: [] })),
    ).not.toThrow();
    expect(cache.get()).toBeUndefined();
  });
});

/**
 * Regressão — estabilidade de referência do `selectedTarefa`
 *
 * Simula o caminho real do bug (criar subtarefa = 3 piscadas):
 * - Cache muda 2x (optimistic insert + swap tempId→id real).
 * - O memo de `selectedTarefa` deve retornar a MESMA referência quando o
 *   conteúdo relevante da tarefa pai e da lista de subtarefas (id,
 *   updated_at, titulo, status, prioridade, responsavel) não mudou de fato.
 * - A mudança APENAS do id da subtarefa (tempId → realId) tecnicamente
 *   produz uma assinatura diferente, então selecionamos colunas que
 *   refletem mudança "visível" — o teste valida que mudanças sem efeito
 *   visual reaproveitam a referência.
 *
 * Mantém em escopo o `useMemo` de ProjetoListView para evitar dependências
 * pesadas (Sheet, supabase, etc.).
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMemo, useRef } from "react";
import type { ProjetoTarefa } from "@/hooks/useProjetoTarefas";

// Reproduz a memoização aplicada em ProjetoListView (linhas 78-110).
function useSelectedTarefa(selectedId: string | null, tarefas: ProjetoTarefa[]) {
  const lastTarefaRef = useRef<ProjetoTarefa | null>(null);
  const lastSignatureRef = useRef<string>("");
  return useMemo(() => {
    if (!selectedId) {
      lastTarefaRef.current = null;
      lastSignatureRef.current = "";
      return null;
    }
    const found = tarefas.find((t) => t.id === selectedId);
    if (!found) return lastTarefaRef.current;
    const subs = tarefas.filter((st) => st.parent_tarefa_id === found.id);
    const signature =
      `${found.id}|${found.updated_at}|${found.titulo}|${found.status}|${found.responsavel_id ?? ""}|${found.prioridade}|${found.data_prazo ?? ""}|${found.descricao ?? ""}|${found.estagio ?? ""}|${found.secao_id}|` +
      subs
        .map((s) => `${s.id}:${s.updated_at}:${s.status}:${s.titulo}:${s.responsavel_id ?? ""}:${s.prioridade}:${s.estagio ?? ""}:${s.data_prazo ?? ""}`)
        .join(";");
    if (signature === lastSignatureRef.current && lastTarefaRef.current) {
      return lastTarefaRef.current;
    }
    const enriched = { ...found, subtarefas: subs };
    lastTarefaRef.current = enriched as ProjetoTarefa;
    lastSignatureRef.current = signature;
    return enriched;
  }, [selectedId, tarefas]);
}

const makeTarefa = (id: string, over: Partial<ProjetoTarefa> = {}): ProjetoTarefa =>
  ({
    id,
    projeto_id: "p1",
    secao_id: "sec-A",
    parent_tarefa_id: null,
    titulo: `T ${id}`,
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

describe("selectedTarefa memoization (ProjetoListView)", () => {
  it("retorna a MESMA referência quando o array tarefas muda mas o conteúdo da tarefa selecionada e subtarefas não mudou", () => {
    const parent = makeTarefa("p1");
    const sub1 = makeTarefa("s1", { parent_tarefa_id: "p1", titulo: "Sub 1" });
    const tarefas1 = [parent, sub1];
    const { result, rerender } = renderHook(
      ({ list }: { list: ProjetoTarefa[] }) => useSelectedTarefa("p1", list),
      { initialProps: { list: tarefas1 } },
    );
    const first = result.current;
    expect(first?.id).toBe("p1");
    expect(first?.subtarefas?.length).toBe(1);

    // Cache reescreveu o array (referência nova) mas com mesmos objetos.
    rerender({ list: [...tarefas1] });
    expect(result.current).toBe(first);

    // Novo array com clones idênticos em conteúdo — ainda deve reusar a referência.
    rerender({ list: [{ ...parent }, { ...sub1 }] });
    expect(result.current).toBe(first);
  });

  it("emite NOVA referência apenas quando muda algo visível (ex.: nova subtarefa)", () => {
    const parent = makeTarefa("p1");
    const tarefas1 = [parent];
    const { result, rerender } = renderHook(
      ({ list }: { list: ProjetoTarefa[] }) => useSelectedTarefa("p1", list),
      { initialProps: { list: tarefas1 } },
    );
    const first = result.current;

    const sub1 = makeTarefa("temp-x", { parent_tarefa_id: "p1", titulo: "Nova" });
    rerender({ list: [parent, sub1] });
    expect(result.current).not.toBe(first);
    expect(result.current?.subtarefas?.length).toBe(1);
  });

  it("swap tempId→id real (mesmo titulo/status/updated_at) NÃO reaproveita a referência (id muda)", () => {
    // Cobre o trade-off: o id entra na assinatura porque outros componentes
    // (ex.: SubtarefaResponsavelPicker) dependem do id real. O fix do
    // flicker do nó DOM é feito via `getSubRowKey` em ProjetoTarefaDetalhe.
    const parent = makeTarefa("p1");
    const tempSub = makeTarefa("temp-x", { parent_tarefa_id: "p1", titulo: "Nova" });
    const realSub = makeTarefa("real-y", {
      parent_tarefa_id: "p1",
      titulo: "Nova",
      updated_at: tempSub.updated_at,
    });
    const { result, rerender } = renderHook(
      ({ list }: { list: ProjetoTarefa[] }) => useSelectedTarefa("p1", list),
      { initialProps: { list: [parent, tempSub] } },
    );
    const optimistic = result.current;
    rerender({ list: [parent, realSub] });
    // Referência muda (id da subtarefa entrou na assinatura), mas estrutura
    // se mantém — o flicker é evitado na camada de render via rowKey estável.
    expect(result.current).not.toBe(optimistic);
    expect(result.current?.subtarefas?.[0].id).toBe("real-y");
  });

  it("recompõe quando há mudança visível no pai (ex.: status)", () => {
    const parent = makeTarefa("p1");
    const { result, rerender } = renderHook(
      ({ list }: { list: ProjetoTarefa[] }) => useSelectedTarefa("p1", list),
      { initialProps: { list: [parent] } },
    );
    const first = result.current;
    rerender({ list: [{ ...parent, status: "concluida" }] });
    expect(result.current).not.toBe(first);
    expect(result.current?.status).toBe("concluida");
  });

  it("preserva referência quando a tarefa selecionada some momentaneamente", () => {
    const parent = makeTarefa("p1");
    const { result, rerender } = renderHook(
      ({ list }: { list: ProjetoTarefa[] }) => useSelectedTarefa("p1", list),
      { initialProps: { list: [parent] } },
    );
    const first = result.current;
    // Refetch transitório retornou lista vazia — devolve último snapshot.
    rerender({ list: [] });
    expect(result.current).toBe(first);
  });
});

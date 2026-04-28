import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { applyProjetoFilters, applyProjetoSort, hasActiveFilters } from "@/lib/projetoFilterUtils";

const baseTarefa: any = {
  id: "1",
  projeto_id: "p1",
  secao_id: "s1",
  parent_tarefa_id: null,
  titulo: "T",
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
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  produto_id: null,
};

const emptyFilters = {
  status: [],
  prioridade: [],
  estagio: [],
  tipo: [],
  responsavelId: null,
  atrasadas: false,
} as any;

describe("applyProjetoFilters", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T12:00:00"));
  });
  afterAll(() => vi.useRealTimers());

  const tarefas: any[] = [
    { ...baseTarefa, id: "a", status: "pendente", prioridade: "alta", responsavel_id: "u1", data_prazo: "2026-04-20" },
    { ...baseTarefa, id: "b", status: "concluida", prioridade: "baixa", responsavel_id: "u2", data_prazo: "2026-05-30" },
    { ...baseTarefa, id: "c", status: "em_andamento", prioridade: "urgente", responsavel_id: "u1", data_prazo: null },
  ];

  it("filtra por status", () => {
    const r = applyProjetoFilters(tarefas, { ...emptyFilters, status: ["concluida"] });
    expect(r.map(t => t.id)).toEqual(["b"]);
  });

  it("filtra por prioridade", () => {
    const r = applyProjetoFilters(tarefas, { ...emptyFilters, prioridade: ["urgente", "alta"] });
    expect(r.map(t => t.id).sort()).toEqual(["a", "c"]);
  });

  it("filtra por responsavel", () => {
    const r = applyProjetoFilters(tarefas, { ...emptyFilters, responsavelId: "u1" });
    expect(r.map(t => t.id).sort()).toEqual(["a", "c"]);
  });

  it("filtra atrasadas (vencidas, não concluídas)", () => {
    const r = applyProjetoFilters(tarefas, { ...emptyFilters, atrasadas: true });
    expect(r.map(t => t.id)).toEqual(["a"]);
  });
});

describe("applyProjetoSort", () => {
  const tarefas: any[] = [
    { ...baseTarefa, id: "a", titulo: "Beta", prioridade: "media", data_prazo: "2026-05-01" },
    { ...baseTarefa, id: "b", titulo: "Alpha", prioridade: "urgente", data_prazo: "2026-04-10" },
    { ...baseTarefa, id: "c", titulo: "Gamma", prioridade: "baixa", data_prazo: null },
  ];

  it("ordena por título asc", () => {
    const r = applyProjetoSort(tarefas, { field: "titulo", direction: "asc" } as any);
    expect(r.map(t => t.id)).toEqual(["b", "a", "c"]);
  });

  it("ordena por prioridade (urgente primeiro)", () => {
    const r = applyProjetoSort(tarefas, { field: "prioridade", direction: "asc" } as any);
    expect(r[0].id).toBe("b");
  });

  it("ordena por prazo, sem prazo vai para o final", () => {
    const r = applyProjetoSort(tarefas, { field: "data_prazo", direction: "asc" } as any);
    expect(r[r.length - 1].id).toBe("c");
  });

  it("respeita direção desc", () => {
    const r = applyProjetoSort(tarefas, { field: "titulo", direction: "desc" } as any);
    expect(r.map(t => t.id)).toEqual(["c", "a", "b"]);
  });
});

describe("hasActiveFilters", () => {
  it("false quando nada está setado", () => {
    expect(hasActiveFilters(emptyFilters)).toBe(false);
  });
  it("true quando algum filtro está setado", () => {
    expect(hasActiveFilters({ ...emptyFilters, atrasadas: true })).toBe(true);
    expect(hasActiveFilters({ ...emptyFilters, status: ["pendente"] })).toBe(true);
    expect(hasActiveFilters({ ...emptyFilters, responsavelId: "u1" })).toBe(true);
  });
});

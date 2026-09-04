import { describe, it, expect } from "vitest";
import {
  getReorderStatus,
  getReorderStatusSecao,
  REORDER_MAX_TAREFAS,
} from "../reordenacaoStatus";

describe("getReorderStatus", () => {
  it("habilita quando não há filtro e ordenação é padrão", () => {
    const r = getReorderStatus({ isFiltering: false, sortField: "created_at", sortDirection: "asc" });
    expect(r.enabled).toBe(true);
    expect(r.motivo).toBeNull();
  });

  it("desabilita quando há filtro ativo", () => {
    const r = getReorderStatus({ isFiltering: true, sortField: "created_at", sortDirection: "asc" });
    expect(r.enabled).toBe(false);
    expect(r.motivo).toBe("filtro");
    expect(r.mensagem).toMatch(/filtro/i);
  });

  it("desabilita quando ordenação foi customizada", () => {
    const r = getReorderStatus({ isFiltering: false, sortField: "titulo", sortDirection: "asc" });
    expect(r.enabled).toBe(false);
    expect(r.motivo).toBe("ordenacao");
  });

  it("desabilita quando direção não é asc", () => {
    const r = getReorderStatus({ isFiltering: false, sortField: "created_at", sortDirection: "desc" });
    expect(r.enabled).toBe(false);
    expect(r.motivo).toBe("ordenacao");
  });
});

describe("getReorderStatusSecao", () => {
  const habilitado = getReorderStatus({ isFiltering: false, sortField: "created_at", sortDirection: "asc" });

  it("preserva desabilitado quando base está desabilitada", () => {
    const base = getReorderStatus({ isFiltering: true, sortField: "created_at", sortDirection: "asc" });
    const r = getReorderStatusSecao(base, 10);
    expect(r.enabled).toBe(false);
    expect(r.motivo).toBe("filtro");
  });

  it("habilita quando dentro do limite", () => {
    const r = getReorderStatusSecao(habilitado, REORDER_MAX_TAREFAS);
    expect(r.enabled).toBe(true);
  });

  it("desabilita quando seção excede o limite", () => {
    const r = getReorderStatusSecao(habilitado, REORDER_MAX_TAREFAS + 1);
    expect(r.enabled).toBe(false);
    expect(r.motivo).toBe("secao_muito_longa");
    expect(r.mensagem).toMatch(/\d+/);
  });
});

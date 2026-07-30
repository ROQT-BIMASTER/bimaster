import { describe, expect, it } from "vitest";
import { compararDocs, ordenarDocs, proximaAcao, ultimaAtualizacao } from "@/lib/china/docSort";

describe("docSort", () => {
  it("usa a data mais recente entre assinatura, oficialização e criação", () => {
    expect(
      ultimaAtualizacao({
        created_at: "2026-01-01T00:00:00Z",
        oficializado_em: "2026-03-01T00:00:00Z",
        assinado_em: null,
      }),
    ).toBe(new Date("2026-03-01T00:00:00Z").getTime());
  });

  it("próxima ação usa a previsão de envio", () => {
    expect(proximaAcao({ previsao_envio: "2026-05-10" })).toBe(
      new Date("2026-05-10").getTime(),
    );
    expect(proximaAcao({})).toBeNull();
  });

  it("ordena por última atualização (mais recente primeiro)", () => {
    const lista = [
      { id: "a", created_at: "2026-01-01T00:00:00Z" },
      { id: "b", created_at: "2026-06-01T00:00:00Z" },
      { id: "c", created_at: null },
    ];
    expect(ordenarDocs(lista, "atualizacao").map((d) => d.id)).toEqual(["b", "a", "c"]);
  });

  it("ordena por próxima ação (mais próxima primeiro) e joga vazios ao fim", () => {
    const lista = [
      { id: "a", previsao_envio: "2026-09-01" },
      { id: "b", previsao_envio: null },
      { id: "c", previsao_envio: "2026-02-01" },
    ];
    expect(ordenarDocs(lista, "proxima_acao").map((d) => d.id)).toEqual(["c", "a", "b"]);
  });

  it("ordem padrão preserva a lista original", () => {
    const lista = [{ id: "a" }, { id: "b" }];
    expect(ordenarDocs(lista, "none")).toBe(lista);
    expect(compararDocs("none", {}, {})).toBe(0);
  });
});

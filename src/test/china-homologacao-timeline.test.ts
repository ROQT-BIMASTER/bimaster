import { describe, expect, it } from "vitest";
import { construirLinhaDoTempo, intervaloLabel } from "@/lib/china/homologacaoTimeline";

const reg = (id: string, decisao: string, created_at: string, parecer: string | null = null) =>
  ({
    id,
    decisao,
    parecer,
    decidido_por_nome: "Ana",
    decidido_por_email: "ana@x.com",
    metodo_confirmacao: "senha",
    origem: "tarefa",
    created_at,
  }) as any;

describe("construirLinhaDoTempo", () => {
  const trilha = [
    reg("c", "aprovado", "2026-07-05T10:00:00Z", "ok final"),
    reg("a", "rejeitado", "2026-07-01T10:00:00Z", "faltou anexo"),
    reg("b", "reaberto", "2026-07-03T10:00:00Z", "corrigido"),
  ];

  it("ordena da etapa mais recente para a mais antiga e marca a atual", () => {
    const etapas = construirLinhaDoTempo(trilha);
    expect(etapas.map((e) => e.id)).toEqual(["c", "b", "a"]);
    expect(etapas[0].atual).toBe(true);
    expect(etapas[1].atual).toBe(false);
  });

  it("versiona na ordem cronológica", () => {
    const etapas = construirLinhaDoTempo(trilha);
    expect(etapas.map((e) => e.versao)).toEqual(["v3", "v2", "v1"]);
  });

  it("calcula a diferença de status entre etapas", () => {
    const [atual, meio, primeira] = construirLinhaDoTempo(trilha);
    expect(atual.de).toBe("reaberto");
    expect(atual.para).toBe("aprovado");
    expect(meio.de).toBe("rejeitado");
    expect(primeira.de).toBeNull();
    expect(primeira.mudou).toBe(true);
  });

  it("marca ausência de mudança quando a decisão se repete", () => {
    const etapas = construirLinhaDoTempo([
      reg("a", "aprovado", "2026-07-01T10:00:00Z"),
      reg("b", "aprovado", "2026-07-02T10:00:00Z"),
    ]);
    expect(etapas[0].mudou).toBe(false);
  });

  it("expõe autor e motivo, com fallback quando não informado", () => {
    const etapas = construirLinhaDoTempo(trilha);
    expect(etapas[0].autor).toBe("Ana");
    expect(etapas[0].motivo).toBe("ok final");
    expect(construirLinhaDoTempo([reg("x", "aprovado", "2026-07-01T10:00:00Z")])[0].motivo).toBeNull();
  });

  it("mede o intervalo desde a etapa anterior", () => {
    const etapas = construirLinhaDoTempo(trilha);
    expect(etapas[0].horasDesdeAnterior).toBe(48);
    expect(etapas[2].horasDesdeAnterior).toBeNull();
  });

  it("formata o intervalo em minutos, horas e dias", () => {
    expect(intervaloLabel(null)).toBeNull();
    expect(intervaloLabel(0.5)).toBe("30 min depois");
    expect(intervaloLabel(5)).toBe("5 h depois");
    expect(intervaloLabel(72)).toBe("3 d depois");
  });
});

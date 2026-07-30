import { describe, expect, it } from "vitest";
import {
  DECISAO_LABEL,
  filtrarOrdenarTrilha,
  ordenarTrilha,
  trilhaMatch,
} from "@/lib/china/homologacaoFilter";
import type { DocAprovacaoAudit } from "@/hooks/useDecisaoDocumentoChina";

const reg = (p: Partial<DocAprovacaoAudit>): DocAprovacaoAudit => ({
  id: p.id || "1",
  decisao: p.decisao || "aprovado",
  parecer: p.parecer ?? null,
  decidido_por_nome: p.decidido_por_nome ?? null,
  decidido_por_email: p.decidido_por_email ?? null,
  metodo_confirmacao: p.metodo_confirmacao || "senha",
  origem: p.origem ?? null,
  created_at: p.created_at || "2026-01-01T12:00:00Z",
});

describe("homologacaoFilter", () => {
  it("reconhece a decisão de reabertura", () => {
    expect(DECISAO_LABEL.reaberto).toBe("Reaberto para nova análise");
  });

  it("busca por autor ignorando acento e caixa", () => {
    const r = reg({ decidido_por_nome: "Júlia Dário" });
    expect(trilhaMatch(r, "julia")).toBe(true);
    expect(trilhaMatch(r, "DARIO")).toBe(true);
    expect(trilhaMatch(r, "milene")).toBe(false);
  });

  it("busca por decisão, origem e data formatada", () => {
    const r = reg({ decisao: "reaberto", origem: "tarefa:reabertura", created_at: "2026-03-05T10:30:00Z" });
    expect(trilhaMatch(r, "reaberto")).toBe(true);
    expect(trilhaMatch(r, "reabertura")).toBe(true);
    expect(trilhaMatch(r, "05/03/2026")).toBe(true);
  });

  it("termo vazio mantém todos os registros", () => {
    expect(trilhaMatch(reg({}), "   ")).toBe(true);
  });

  it("ordena por data crescente e decrescente", () => {
    const lista = [
      reg({ id: "a", created_at: "2026-01-01T00:00:00Z" }),
      reg({ id: "b", created_at: "2026-05-01T00:00:00Z" }),
    ];
    expect(ordenarTrilha(lista, "data_desc").map((r) => r.id)).toEqual(["b", "a"]);
    expect(ordenarTrilha(lista, "data_asc").map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("ordena por autor A–Z", () => {
    const lista = [
      reg({ id: "a", decidido_por_nome: "Paloma" }),
      reg({ id: "b", decidido_por_nome: "Ana" }),
    ];
    expect(ordenarTrilha(lista, "autor").map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("combina busca e ordenação sem mutar a lista original", () => {
    const lista = [
      reg({ id: "a", decidido_por_nome: "Ana", created_at: "2026-01-01T00:00:00Z" }),
      reg({ id: "b", decidido_por_nome: "Ana", created_at: "2026-06-01T00:00:00Z" }),
      reg({ id: "c", decidido_por_nome: "Bruno" }),
    ];
    const out = filtrarOrdenarTrilha(lista, "ana", "data_asc");
    expect(out.map((r) => r.id)).toEqual(["a", "b"]);
    expect(lista.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  consolidarDecisoes,
  docStatusLabel,
  normalizarDecisao,
} from "@/lib/china/docStatus";

describe("docStatus — consolidação administrativa de documentos China", () => {
  it("normaliza status brutos para as quatro decisões", () => {
    expect(normalizarDecisao("aprovado")).toBe("aprovado");
    expect(normalizarDecisao("contestado")).toBe("rejeitado");
    expect(normalizarDecisao("em_revisao")).toBe("em_analise");
    expect(normalizarDecisao("rascunho")).toBe("pendente");
    expect(normalizarDecisao(null)).toBe("pendente");
  });

  it("só marca a tarefa como aprovada quando todos os documentos estão aprovados", () => {
    expect(consolidarDecisoes(["aprovado", "aprovado"])).toBe("aprovado");
    expect(consolidarDecisoes(["aprovado", "enviado"])).toBe("pendente");
  });

  it("prioriza reprovação sobre análise e pendência", () => {
    expect(consolidarDecisoes(["rejeitado", "em_analise", "aprovado"])).toBe("rejeitado");
    expect(consolidarDecisoes(["em_analise", "enviado"])).toBe("em_analise");
  });

  it("retorna nulo quando a tarefa não tem documentos", () => {
    expect(consolidarDecisoes([])).toBeNull();
  });

  it("apresenta rótulos administrativos legíveis", () => {
    expect(docStatusLabel("enviado_brasil")).toBe("Pendente de aprovação");
    expect(docStatusLabel("rejeitado")).toBe("Não aprovado");
    expect(docStatusLabel("aprovado")).toBe("Aprovado");
  });
});

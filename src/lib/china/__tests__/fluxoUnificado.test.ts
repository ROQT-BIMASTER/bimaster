import { describe, it, expect } from "vitest";
import { bucketFluxo, isAprovado, isDevolvido, normalizarDecisao } from "@/lib/china/docStatus";
import { bucketForDoc } from "@/lib/china/flowTones";

/**
 * Contrato: Caixa de Entrada (pastas), Kanban (colunas) e Checklist (contadores)
 * interpretam `china_produto_documentos.status` pelo MESMO vocabulário.
 */
describe("vocabulário único do fluxo China → Brasil", () => {
  it("status gravados pelo Brasil caem no estágio correto", () => {
    expect(bucketFluxo("em_analise")).toBe("em_analise");
    expect(bucketFluxo("contestado")).toBe("em_analise");
    expect(bucketFluxo("em_revisao")).toBe("em_analise");
    expect(bucketFluxo("aprovado")).toBe("aprovado");
    expect(bucketFluxo("ciencia")).toBe("aprovado");
    expect(bucketFluxo("rejeitado")).toBe("devolvido");
    expect(bucketFluxo("devolvido_china")).toBe("devolvido");
    expect(bucketFluxo("enviado")).toBe("enviado");
    expect(bucketFluxo("rascunho")).toBe("rascunho");
    expect(bucketFluxo(null)).toBe("nao_criado");
  });

  it("ciência conta como aprovado e devolvido_china como devolução", () => {
    expect(isAprovado("ciencia")).toBe(true);
    expect(isDevolvido("devolvido_china")).toBe(true);
    expect(normalizarDecisao("contestado")).toBe("em_analise");
  });

  it("bucket visual do Kanban espelha o estágio do fluxo", () => {
    expect(bucketForDoc({ doc_status: "em_analise" })).toBe("em_analise");
    expect(bucketForDoc({ doc_status: "contestado" })).toBe("em_analise");
    expect(bucketForDoc({ doc_status: "ciencia" })).toBe("aprovado");
    expect(bucketForDoc({ doc_status: "devolvido_china" })).toBe("rejeitado");
    expect(bucketForDoc({ doc_status: "enviado" })).toBe("enviado");
    expect(bucketForDoc(null)).toBe("nao_criado");
  });

  it("status desconhecido não some da tela — vira pendente de envio", () => {
    expect(bucketFluxo("status_inexistente_xyz")).toBe("pendente_envio");
  });
});

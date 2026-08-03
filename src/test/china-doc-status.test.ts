import { describe, expect, it } from "vitest";
import {
  consolidarDecisoes,
  checklistStatusLabel,
  checklistStatusTexto,
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

  it("apresenta rótulos administrativos bilíngues (PT 中文)", () => {
    expect(docStatusLabel("enviado_brasil")).toBe("Pendente de aprovação 待审批");
    expect(docStatusLabel("rejeitado")).toBe("Não aprovado 未批准");
    expect(docStatusLabel("aprovado")).toBe("Aprovado 已批准");
  });

  it("permite obter apenas uma das línguas", () => {
    expect(docStatusLabel("em_analise", "pt")).toBe("Em análise");
    expect(docStatusLabel("em_analise", "zh")).toBe("审核中");
  });

  it("usa o vocabulário bilíngue do checklist nas telas China", () => {
    expect(checklistStatusLabel("nao_criado")).toBe("Não criado 未创建");
    expect(checklistStatusLabel("enviado_brasil")).toBe("Enviado ao Brasil 已发送至巴西");
    expect(checklistStatusLabel("ciencia", "zh")).toBe("已确认");
    expect(checklistStatusTexto("pendente")).toEqual({ pt: "Pendente análise", zh: "待审核" });
  });
});

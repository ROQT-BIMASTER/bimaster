import { describe, it, expect } from "vitest";
import { sanitizeStorageSegment } from "../sanitizeTipoKey";

describe("sanitizeStorageSegment", () => {
  it("remove acentos preservando letras", () => {
    expect(sanitizeStorageSegment("Inspeção Visual")).toBe("Inspecao_Visual");
    expect(sanitizeStorageSegment("relatório çãõ")).toBe("relatorio_cao");
  });

  it("substitui caracteres não-ASCII por underline", () => {
    expect(sanitizeStorageSegment("中文 文档")).toBe("_");
    expect(sanitizeStorageSegment("abc 中 def")).toBe("abc_def");
  });

  it("colapsa underlines repetidos e remove bordas", () => {
    expect(sanitizeStorageSegment("___foo___bar___")).toBe("foo_bar");
  });

  it("retorna '_' para input vazio ou só símbolos", () => {
    expect(sanitizeStorageSegment("")).toBe("_");
    expect(sanitizeStorageSegment("!!!@@@###")).toBe("_");
    expect(sanitizeStorageSegment("   ")).toBe("_");
  });

  it("limita a 64 caracteres", () => {
    const big = "a".repeat(200);
    expect(sanitizeStorageSegment(big).length).toBe(64);
  });

  it("preserva letras, números, ponto, hífen e underscore", () => {
    expect(sanitizeStorageSegment("file.name-v2_final")).toBe("file.name-v2_final");
  });
});

describe("sanitizeStorageFileName", () => {
  it("preserva extensão em nomes 100% chineses", () => {
    expect(sanitizeStorageFileName("报告 最终.pdf")).toBe("arquivo.pdf");
  });

  it("mantém base ASCII e normaliza acentos", () => {
    expect(sanitizeStorageFileName("Relatório Final.PDF")).toBe("Relatorio_Final.PDF");
  });

  it("funciona sem extensão", () => {
    expect(sanitizeStorageFileName("检验")).toBe("arquivo");
  });

  it("não quebra com nome vazio", () => {
    expect(sanitizeStorageFileName("")).toBe("arquivo");
  });
});

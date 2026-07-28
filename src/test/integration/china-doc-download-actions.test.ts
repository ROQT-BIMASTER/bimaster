import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const SRC = resolve(
  process.cwd(),
  "src/components/china/inbox/ChecklistFlow/FlowItemFocusDrawer.tsx",
);

describe("China · FlowItemFocusDrawer — acesso a arquivos sem preview", () => {
  const code = readFileSync(SRC, "utf-8");

  it("expõe ação de download por blob (sem window.open)", () => {
    expect(code).toContain("downloadStorageBlob");
    expect(code).toContain("triggerBlobDownload");
    expect(code).not.toMatch(/window\.open\(/);
  });

  it("usa o bucket china-documentos no download", () => {
    expect(code).toContain('"china-documentos"');
  });

  it("renderiza ações de arquivo no cartão e na preview genérica", () => {
    const occurrences = code.match(/<DocFileActions/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("classifica famílias de arquivo sem preview nativa", () => {
    expect(code).toContain("function fileFamily");
    for (const ext of ["xlsx", "docx?", "zip", "psd"]) {
      expect(code).toContain(ext);
    }
  });

  it("não deixa texto morto sem ação para tipos sem preview", () => {
    expect(code).not.toContain("Pré-visualização não disponível para este tipo de arquivo");
  });

  it("usa o dialog padrão de preview da China no modo foco", () => {
    expect(code).toContain("ChinaDocPreviewDialog");
    expect(code).not.toContain("function DocFocusDialog");
  });
});

import { describe, it, expect } from "vitest";
import {
  computeExpectedChecklist,
  computeExpectedChecklistBatch,
  DEFAULT_EXPECTED_TOTAL,
} from "../mergeChecklist";

describe("computeExpectedChecklist", () => {
  it("retorna o checklist padrão completo quando não há customização", () => {
    const exp = computeExpectedChecklist([], [], []);
    expect(exp.total).toBe(DEFAULT_EXPECTED_TOTAL);
    expect(exp.tipos.has("planilha_excel")).toBe(true);
    expect(exp.tiposChinaEnvia.has("volumetria")).toBe(true);
    expect(exp.tiposBrasilEnvia.has("ean_unitario")).toBe(true);
  });

  it("subtrai itens ocultos do total esperado", () => {
    const exp = computeExpectedChecklist(
      [],
      [],
      [{ submissao_id: "s", tipo_key: "planilha_excel" }],
    );
    expect(exp.total).toBe(DEFAULT_EXPECTED_TOTAL - 1);
    expect(exp.tipos.has("planilha_excel")).toBe(false);
  });

  it("subtrai categoria inteira quando oculta via cat:KEY", () => {
    // Categoria "rotulagem" tem 3 tipos.
    const exp = computeExpectedChecklist(
      [],
      [],
      [{ submissao_id: "s", tipo_key: "cat:rotulagem" }],
    );
    expect(exp.total).toBe(DEFAULT_EXPECTED_TOTAL - 3);
    expect(exp.tipos.has("volumetria")).toBe(false);
    expect(exp.tipos.has("formula")).toBe(false);
    expect(exp.tipos.has("doc_regulatoria")).toBe(false);
  });

  it("soma itens custom (em categoria padrão e custom)", () => {
    const exp = computeExpectedChecklist(
      [{ id: "c1", submissao_id: "s", fluxo: "china_envia" }],
      [
        { id: "i1", submissao_id: "s", tipo_key: "extra_planilha", categoria_default_key: "dados_oficiais", categoria_custom_id: null },
        { id: "i2", submissao_id: "s", tipo_key: "extra_custom", categoria_custom_id: "c1", categoria_default_key: null },
      ],
      [],
    );
    expect(exp.total).toBe(DEFAULT_EXPECTED_TOTAL + 2);
    expect(exp.tipos.has("extra_planilha")).toBe(true);
    expect(exp.tipos.has("extra_custom")).toBe(true);
    expect(exp.tiposChinaEnvia.has("extra_custom")).toBe(true);
  });
});

describe("computeExpectedChecklistBatch", () => {
  it("calcula isoladamente cada submissão", () => {
    const map = computeExpectedChecklistBatch(
      ["sub-A", "sub-B"],
      [],
      [
        { id: "i1", submissao_id: "sub-A", tipo_key: "extra_a" },
      ],
      [
        { submissao_id: "sub-B", tipo_key: "planilha_excel" },
      ],
    );
    expect(map.get("sub-A")?.total).toBe(DEFAULT_EXPECTED_TOTAL + 1);
    expect(map.get("sub-B")?.total).toBe(DEFAULT_EXPECTED_TOTAL - 1);
  });
});

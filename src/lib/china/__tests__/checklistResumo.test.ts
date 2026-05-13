import { describe, it, expect } from "vitest";
import {
  summarizeChecklistResumo,
  validateChecklistResumo,
  type ChecklistDocRow,
} from "../checklistResumo";
import {
  computeExpectedChecklist,
  DEFAULT_EXPECTED_TOTAL,
} from "../mergeChecklist";

const expectedFull = computeExpectedChecklist([], [], []);

function row(tipo: string, status: string): ChecklistDocRow {
  return { tipo_documento: tipo, status };
}

describe("summarizeChecklistResumo", () => {
  it("sem documentos, todos do checklist viram pendentes", () => {
    const r = summarizeChecklistResumo([], expectedFull);
    expect(r.total).toBe(DEFAULT_EXPECTED_TOTAL);
    expect(r.pendentes).toBe(DEFAULT_EXPECTED_TOTAL);
    expect(r.enviados).toBe(0);
    expect(r.aprovados).toBe(0);
    expect(r.rejeitados).toBe(0);
    expect(validateChecklistResumo(r)).toBeNull();
  });

  it("rascunho NÃO conta como enviado", () => {
    const r = summarizeChecklistResumo(
      [row("planilha_excel", "rascunho")],
      expectedFull,
    );
    expect(r.enviados).toBe(0);
    expect(r.pendentes).toBe(DEFAULT_EXPECTED_TOTAL);
    expect(validateChecklistResumo(r)).toBeNull();
  });

  it("status pendente (anexado) conta como enviado ao Brasil", () => {
    const r = summarizeChecklistResumo(
      [row("planilha_excel", "pendente")],
      expectedFull,
    );
    expect(r.enviados).toBe(1);
    expect(r.pendentes).toBe(DEFAULT_EXPECTED_TOTAL - 1);
    expect(validateChecklistResumo(r)).toBeNull();
  });

  it("aprovados e rejeitados também contam como enviados", () => {
    const r = summarizeChecklistResumo(
      [
        row("planilha_excel", "aprovado"),
        row("volumetria", "rejeitado"),
        row("formula", "enviado"),
      ],
      expectedFull,
    );
    expect(r.enviados).toBe(3);
    expect(r.aprovados).toBe(1);
    expect(r.rejeitados).toBe(1);
    expect(r.pendentes).toBe(DEFAULT_EXPECTED_TOTAL - 3);
    expect(validateChecklistResumo(r)).toBeNull();
  });

  it("itens ocultos do checklist não contam no total", () => {
    const expHidden = computeExpectedChecklist(
      [],
      [],
      [{ submissao_id: "s", tipo_key: "planilha_excel" }],
    );
    const r = summarizeChecklistResumo([], expHidden);
    expect(r.total).toBe(DEFAULT_EXPECTED_TOTAL - 1);
    expect(r.pendentes).toBe(DEFAULT_EXPECTED_TOTAL - 1);
    expect(validateChecklistResumo(r)).toBeNull();
  });

  it("documento de tipo OCULTO ainda conta (não perde vínculo)", () => {
    const expHidden = computeExpectedChecklist(
      [],
      [],
      [{ submissao_id: "s", tipo_key: "planilha_excel" }],
    );
    const r = summarizeChecklistResumo(
      [row("planilha_excel", "aprovado")],
      expHidden,
    );
    // Total = (DEFAULT-1 ocultos do checklist) + 1 extra anexado.
    expect(r.total).toBe(DEFAULT_EXPECTED_TOTAL);
    expect(r.enviados).toBe(1);
    expect(r.aprovados).toBe(1);
    expect(validateChecklistResumo(r)).toBeNull();
  });

  it("itens custom em categoria custom entram no total esperado", () => {
    const exp = computeExpectedChecklist(
      [{ id: "c1", submissao_id: "s", fluxo: "china_envia" }],
      [
        { id: "i1", submissao_id: "s", tipo_key: "extra_x", categoria_custom_id: "c1" },
        { id: "i2", submissao_id: "s", tipo_key: "extra_y", categoria_custom_id: "c1" },
      ],
      [],
    );
    const r = summarizeChecklistResumo(
      [row("extra_x", "enviado")],
      exp,
    );
    expect(r.total).toBe(DEFAULT_EXPECTED_TOTAL + 2);
    expect(r.enviados).toBe(1);
    expect(r.pendentes).toBe(DEFAULT_EXPECTED_TOTAL + 1);
    expect(validateChecklistResumo(r)).toBeNull();
  });

  it("último doc por tipo prevalece (rows ordenado desc por updated_at)", () => {
    const r = summarizeChecklistResumo(
      [
        row("planilha_excel", "aprovado"), // mais recente
        row("planilha_excel", "rascunho"), // antigo, ignorado
      ],
      expectedFull,
    );
    expect(r.aprovados).toBe(1);
    expect(r.enviados).toBe(1);
  });

  it("cenário do bug reportado: 4 enviados / 25 pendentes / 29 totais", () => {
    // Simula 29 itens de checklist (subset do default), com 4 anexados.
    const tiposChecklist = Array.from(expectedFull.tipos).slice(0, 29);
    const exp = {
      ...expectedFull,
      tipos: new Set(tiposChecklist),
      total: 29,
      tiposChinaEnvia: new Set(tiposChecklist),
      tiposBrasilEnvia: new Set<string>(),
    };
    const docs: ChecklistDocRow[] = [
      row(tiposChecklist[0], "pendente"),
      row(tiposChecklist[1], "enviado"),
      row(tiposChecklist[2], "aprovado"),
      row(tiposChecklist[3], "em_revisao"),
    ];
    const r = summarizeChecklistResumo(docs, exp);
    expect(r.total).toBe(29);
    expect(r.enviados).toBe(4);
    expect(r.pendentes).toBe(25);
    expect(r.aprovados).toBe(1);
    expect(validateChecklistResumo(r)).toBeNull();
  });
});

describe("validateChecklistResumo", () => {
  it("detecta soma inconsistente", () => {
    const msg = validateChecklistResumo({
      total: 10, pendentes: 5, enviados: 4, aprovados: 0, rejeitados: 0,
    });
    expect(msg).toMatch(/Inconsistência/);
  });

  it("detecta aprovados+rejeitados maior que enviados", () => {
    const msg = validateChecklistResumo({
      total: 5, pendentes: 0, enviados: 5, aprovados: 4, rejeitados: 2,
    });
    expect(msg).toMatch(/aprovados/);
  });

  it("aceita resumo zerado", () => {
    expect(validateChecklistResumo({
      total: 0, pendentes: 0, enviados: 0, aprovados: 0, rejeitados: 0,
    })).toBeNull();
  });
});

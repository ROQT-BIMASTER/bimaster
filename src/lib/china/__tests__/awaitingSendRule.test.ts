import { describe, it, expect } from "vitest";
import {
  evaluateAwaitingSend,
  DEFAULT_AWAITING_SEND_CONFIG,
  type AwaitingSendItemLike,
} from "@/lib/china/awaitingSendRule";

const base: AwaitingSendItemLike = {
  is_deleted: false,
  submissao_status: "pendente",
  doc_status: null,
  documento_id: null,
  observacoes_china: null,
};

describe("evaluateAwaitingSend", () => {
  it("checklist sem documento e sem parecer entra em pendentes de envio", () => {
    const r = evaluateAwaitingSend({ ...base });
    expect(r.matches).toBe(true);
    expect(r.reasons).toEqual(expect.arrayContaining(["sem_documento", "sem_parecer"]));
  });

  it("checklist com documento mas sem parecer ainda é pendente", () => {
    const r = evaluateAwaitingSend({ ...base, documento_id: "doc-1" });
    expect(r.matches).toBe(true);
    expect(r.reasons).toEqual(["sem_parecer"]);
  });

  it("checklist com parecer mas sem documento ainda é pendente", () => {
    const r = evaluateAwaitingSend({ ...base, observacoes_china: "Análise OK" });
    expect(r.matches).toBe(true);
    expect(r.reasons).toEqual(["sem_documento"]);
  });

  it("checklist com documento e parecer NÃO é pendente", () => {
    const r = evaluateAwaitingSend({
      ...base,
      documento_id: "doc-1",
      observacoes_china: "Análise OK",
    });
    expect(r.matches).toBe(false);
    expect(r.reasons).toEqual([]);
  });

  it("rascunho explícito entra mesmo com documento e parecer", () => {
    const r = evaluateAwaitingSend({
      ...base,
      submissao_status: "rascunho",
      documento_id: "doc-1",
      observacoes_china: "ok",
    });
    expect(r.matches).toBe(true);
    expect(r.reasons).toContain("rascunho");
  });

  it("aprovado nunca entra", () => {
    const r = evaluateAwaitingSend({ ...base, submissao_status: "aprovado" });
    expect(r.matches).toBe(false);
  });

  it("rejeitado nunca entra", () => {
    const r = evaluateAwaitingSend({ ...base, submissao_status: "rejeitado" });
    expect(r.matches).toBe(false);
  });

  it("itens deletados nunca entram", () => {
    const r = evaluateAwaitingSend({ ...base, is_deleted: true });
    expect(r.matches).toBe(false);
  });

  it("config: desligar requireParecerChina remove o motivo sem_parecer", () => {
    const r = evaluateAwaitingSend(
      { ...base, documento_id: "doc-1" },
      { ...DEFAULT_AWAITING_SEND_CONFIG, requireParecerChina: false },
    );
    expect(r.matches).toBe(false);
  });

  it("config: desligar treatRascunhoAsAwaiting ignora rascunhos completos", () => {
    const r = evaluateAwaitingSend(
      {
        ...base,
        submissao_status: "rascunho",
        documento_id: "doc-1",
        observacoes_china: "ok",
      },
      { ...DEFAULT_AWAITING_SEND_CONFIG, treatRascunhoAsAwaiting: false },
    );
    expect(r.matches).toBe(false);
  });

  it("submissão 'enviado' (legado) com item rascunho/sem doc ENTRA (item novo no checklist)", () => {
    const r = evaluateAwaitingSend({ ...base, submissao_status: "enviado" });
    expect(r.matches).toBe(true);
  });

  it("submissão 'enviado_brasil' com item pendente ENTRA (item novo no checklist)", () => {
    const r = evaluateAwaitingSend({ ...base, submissao_status: "enviado_brasil" });
    expect(r.matches).toBe(true);
  });

  it("submissão 'em_revisao' com item pendente ENTRA (item novo no checklist)", () => {
    const r = evaluateAwaitingSend({ ...base, submissao_status: "em_revisao" });
    expect(r.matches).toBe(true);
  });

  it("config: excluir status custom impede entrada", () => {
    const r = evaluateAwaitingSend(
      { ...base, submissao_status: "pendente" },
      {
        ...DEFAULT_AWAITING_SEND_CONFIG,
        excludeSubmissaoStatuses: ["aprovado", "rejeitado", "enviado", "enviado_brasil", "em_revisao", "pendente"],
      },
    );
    expect(r.matches).toBe(false);
  });

  it("strings em branco contam como sem parecer", () => {
    const r = evaluateAwaitingSend({
      ...base,
      documento_id: "doc-1",
      observacoes_china: "   ",
    });
    expect(r.reasons).toEqual(["sem_parecer"]);
  });

  // Garantia da regra: itens novos do checklist (rascunho, sem doc e sem parecer)
  // sempre aparecem em "Pendentes de envio", independentemente do status pai —
  // exceto quando a submissão atingiu status FINAL (aprovado/rejeitado).
  it.each([
    "rascunho",
    "pendente",
    "em_revisao",
    "enviado",
    "enviado_brasil",
  ])("item novo (sem doc, sem parecer) entra mesmo com submissão pai = %s", (parent) => {
    const r = evaluateAwaitingSend({
      ...base,
      submissao_status: parent,
      documento_id: null,
      observacoes_china: null,
    });
    expect(r.matches).toBe(true);
    expect(r.reasons).toEqual(expect.arrayContaining(["sem_documento", "sem_parecer"]));
  });

  it.each(["aprovado", "rejeitado"])(
    "item novo NÃO entra quando submissão pai está em status final = %s",
    (parent) => {
      const r = evaluateAwaitingSend({
        ...base,
        submissao_status: parent,
        documento_id: null,
        observacoes_china: null,
      });
      expect(r.matches).toBe(false);
      expect(r.reasons).toEqual([]);
    },
  );
});

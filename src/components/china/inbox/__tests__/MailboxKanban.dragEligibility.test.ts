import { describe, it, expect } from "vitest";
import { isDocDraggableToSent } from "../MailboxKanban";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import type { MailboxGroup } from "@/lib/china/groupMailboxItems";

const baseGroup: MailboxGroup = {
  submissao_id: "s1",
  produto_codigo: "1",
  produto_nome: "Compact Powder",
  numero_ordem: null,
  submissao_status: "em_revisao",
  is_flagged: false,
  is_deleted: false,
  latest_at: new Date().toISOString(),
  horas_pendentes: 0,
  worst_status: "rascunho",
  has_unread: false,
  docs: [],
  progress: {
    total: 0, enviados: 0, em_analise: 0, aprovados: 0,
    rejeitados: 0, pendentes: 0, anexados_rascunho: 0,
  },
};

const baseItem = (over: Partial<MailboxItem> = {}): MailboxItem => ({
  documento_id: "d1",
  tipo_documento: "cores_produto",
  doc_status: "rascunho",
  nome_arquivo: "cor.pdf",
  arquivo_path: "uid/sub/cor.pdf",
  arquivo_url: null,
  submissao_id: "s1",
  produto_codigo: "1",
  produto_nome: "Compact Powder",
  numero_ordem: null,
  submissao_status: "em_revisao",
  observacoes_china: null,
  observacoes_brasil: null,
  aprovado_em: null,
  created_at: new Date().toISOString(),
  horas_pendentes: 0,
  is_read: true,
  is_flagged: false,
  is_deleted: false,
  snooze_until: null,
  had_previous_rejection: false,
  checklist_total: 0,
  checklist_aprovados: 0,
  checklist_pendentes: 0,
  checklist_rejeitados: 0,
  approval_completeness: null,
  checklist_expected_total: 0,
  ...over,
} as MailboxItem);

describe("isDocDraggableToSent", () => {
  it("permite rascunho com arquivo na perspectiva China", () => {
    expect(isDocDraggableToSent(baseItem(), baseGroup, "china")).toBe(true);
  });

  it("permite reenvio após devolução (rejeitado) com arquivo", () => {
    expect(isDocDraggableToSent(baseItem({ doc_status: "rejeitado" }), baseGroup, "china")).toBe(true);
  });

  it("bloqueia na perspectiva Brasil", () => {
    expect(isDocDraggableToSent(baseItem(), baseGroup, "brasil")).toBe(false);
  });

  it("bloqueia itens virtuais (sem documento_id)", () => {
    expect(isDocDraggableToSent(baseItem({ documento_id: null }), baseGroup, "china")).toBe(false);
  });

  it("bloqueia itens sem arquivo anexado", () => {
    expect(
      isDocDraggableToSent(baseItem({ arquivo_path: null, arquivo_url: null }), baseGroup, "china"),
    ).toBe(false);
  });

  it("bloqueia docs já enviados/em análise/aprovados", () => {
    for (const s of ["pendente", "enviado", "contestado", "aprovado"]) {
      expect(isDocDraggableToSent(baseItem({ doc_status: s }), baseGroup, "china")).toBe(false);
    }
  });

  it("bloqueia quando a submissão pai está em status final", () => {
    expect(
      isDocDraggableToSent(baseItem(), { ...baseGroup, submissao_status: "aprovado" }, "china"),
    ).toBe(false);
    expect(
      isDocDraggableToSent(baseItem(), { ...baseGroup, submissao_status: "rejeitado" }, "china"),
    ).toBe(false);
  });
});

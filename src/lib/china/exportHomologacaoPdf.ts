/**
 * exportHomologacaoPdf — relatório de auditoria da trilha de homologação
 * de um documento (autor, método, data e hora).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DocAprovacaoAudit } from "@/hooks/useDecisaoDocumentoChina";

const DECISAO_LABEL: Record<string, string> = {
  aprovado: "Aprovado",
  rejeitado: "Não aprovado",
  em_analise: "Em análise",
  pendente: "Pendente de aprovação",
  ciencia: "Ciência registrada",
};

function dataHora(iso: string) {
  return format(new Date(iso), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

export interface HomologacaoPdfMeta {
  documentoLabel: string;
  tipoDocumento?: string | null;
  produto?: string | null;
  statusAtual?: string | null;
}

export function exportHomologacaoPdf(
  trilha: DocAprovacaoAudit[],
  meta: HomologacaoPdfMeta,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(14);
  doc.text("Relatório de homologação de documento", 40, 40);

  doc.setFontSize(9);
  const linhas = [
    `Documento: ${meta.documentoLabel}`,
    meta.tipoDocumento ? `Tipo: ${meta.tipoDocumento}` : null,
    meta.produto ? `Produto: ${meta.produto}` : null,
    meta.statusAtual ? `Situação atual: ${DECISAO_LABEL[meta.statusAtual] || meta.statusAtual}` : null,
    `Emitido em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    `Registros: ${trilha.length}`,
  ].filter(Boolean) as string[];
  linhas.forEach((l, i) => doc.text(l, 40, 60 + i * 13));

  autoTable(doc, {
    startY: 60 + linhas.length * 13 + 10,
    head: [["Data e hora", "Decisão", "Autor", "E-mail", "Método", "Origem", "Parecer"]],
    body: trilha.map((t) => [
      dataHora(t.created_at),
      DECISAO_LABEL[t.decisao] || t.decisao,
      t.decidido_por_nome || "—",
      t.decidido_por_email || "—",
      t.metodo_confirmacao === "senha" ? "Senha (verificada no servidor)" : "Sessão autenticada",
      t.origem || "—",
      t.parecer || "—",
    ]),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: { 6: { cellWidth: 220 } },
  });

  const nome = meta.documentoLabel.replace(/[^\w.-]+/g, "_").slice(0, 60);
  doc.save(`homologacao_${nome || "documento"}.pdf`);
}

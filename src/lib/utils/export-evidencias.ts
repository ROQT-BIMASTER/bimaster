import { jsPDF } from "jspdf";
import type { EvidenciaEtapa, AuditEvidencia } from "@/hooks/useProcessoTarefaEspelho";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n;]/.test(s) ? `"${s}"` : s;
}

/** Exporta evidências selecionadas + linhas de auditoria relacionadas como CSV. */
export function exportEvidenciasCsv(
  evidencias: EvidenciaEtapa[],
  audit: AuditEvidencia[],
) {
  const ids = new Set(evidencias.map((e) => e.espelho_id));
  const auditFiltrado = audit.filter((a) => ids.has(a.espelho_id));

  const lines: string[] = [];

  // Bloco 1: evidências
  lines.push("Evidências de tarefas espelhadas");
  lines.push(
    [
      "Projeto",
      "Tarefa",
      "Status",
      "Responsável",
      "Documento oficial",
      "Observação",
      "Concluída por",
      "Concluída em",
      "Ação solicitada em",
    ]
      .map(csvEscape)
      .join(","),
  );
  evidencias.forEach((e) => {
    lines.push(
      [
        e.projeto_nome ?? "",
        e.tarefa_titulo ?? "",
        e.status,
        e.responsavel_nome ?? "",
        e.evidencia_documento_label ?? "",
        e.evidencia_observacao ?? "",
        e.concluida_por_nome ?? "",
        e.concluida_em ? new Date(e.concluida_em).toLocaleString("pt-BR") : "",
        e.acao_solicitada_em
          ? new Date(e.acao_solicitada_em).toLocaleString("pt-BR")
          : "",
      ]
        .map(csvEscape)
        .join(","),
    );
  });

  // Bloco 2: auditoria (linha do tempo)
  lines.push("");
  lines.push("Linha do tempo / auditoria");
  lines.push(
    [
      "Data",
      "Projeto",
      "Tarefa",
      "Ação",
      "Documento anterior",
      "Documento novo",
      "Por",
    ]
      .map(csvEscape)
      .join(","),
  );
  auditFiltrado.forEach((a) => {
    lines.push(
      [
        new Date(a.created_at).toLocaleString("pt-BR"),
        a.projeto_nome ?? "",
        a.tarefa_titulo ?? "",
        a.acao,
        a.documento_anterior_label ?? "",
        a.documento_novo_label ?? "",
        a.alterado_por_nome ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  });

  const csv = "\uFEFF" + lines.join("\n");
  downloadBlob(
    `evidencias-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
}

/** Exporta evidências selecionadas + auditoria relacionadas como PDF. */
export function exportEvidenciasPdf(
  evidencias: EvidenciaEtapa[],
  audit: AuditEvidencia[],
  contexto?: { etapa?: string; perfil?: string },
) {
  const ids = new Set(evidencias.map((e) => e.espelho_id));
  const auditFiltrado = audit.filter((a) => ids.has(a.espelho_id));

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Evidências de tarefas espelhadas", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  if (contexto?.perfil) doc.text(`Perfil: ${contexto.perfil}`, margin, y), (y += 12);
  if (contexto?.etapa) doc.text(`Etapa: ${contexto.etapa}`, margin, y), (y += 12);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
  y += 18;
  doc.setTextColor(0);

  // Lista de evidências
  evidencias.forEach((e, idx) => {
    ensureSpace(70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const head = `${idx + 1}. ${e.projeto_nome ?? "Projeto"} › ${e.tarefa_titulo ?? "(tarefa)"}`;
    doc.text(doc.splitTextToSize(head, pageW - margin * 2), margin, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const rows: [string, string][] = [
      ["Status", e.status],
      ["Responsável", e.responsavel_nome ?? "—"],
      ["Documento oficial", e.evidencia_documento_label ?? "— (pendente)"],
      ["Observação", e.evidencia_observacao ?? "—"],
      [
        "Concluída",
        e.concluida_em
          ? `${new Date(e.concluida_em).toLocaleString("pt-BR")} por ${e.concluida_por_nome ?? "—"}`
          : "—",
      ],
      [
        "Ação solicitada",
        e.acao_solicitada_em
          ? new Date(e.acao_solicitada_em).toLocaleString("pt-BR")
          : "—",
      ],
    ];
    rows.forEach(([k, v]) => {
      ensureSpace(12);
      doc.setTextColor(120);
      doc.text(`${k}:`, margin + 6, y);
      doc.setTextColor(0);
      const lines = doc.splitTextToSize(v, pageW - margin * 2 - 90);
      doc.text(lines, margin + 96, y);
      y += 12 * lines.length;
    });
    y += 6;
  });

  // Auditoria
  if (auditFiltrado.length > 0) {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Linha do tempo de evidências", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    auditFiltrado.forEach((a) => {
      ensureSpace(34);
      const head = `${new Date(a.created_at).toLocaleString("pt-BR")} · ${a.acao} · ${a.projeto_nome ?? ""} › ${a.tarefa_titulo ?? ""}`;
      doc.text(doc.splitTextToSize(head, pageW - margin * 2), margin, y);
      y += 12;
      const det =
        a.acao === "alterado"
          ? `De: ${a.documento_anterior_label ?? "—"} → Para: ${a.documento_novo_label ?? "—"}`
          : a.acao === "vinculado"
            ? `Vinculado: ${a.documento_novo_label ?? "—"}`
            : `Removido: ${a.documento_anterior_label ?? "—"}`;
      doc.setTextColor(120);
      const detLines = doc.splitTextToSize(`${det}  (por ${a.alterado_por_nome ?? "—"})`, pageW - margin * 2 - 12);
      doc.text(detLines, margin + 12, y);
      doc.setTextColor(0);
      y += 12 * detLines.length + 4;
    });
  }

  doc.save(`evidencias-${new Date().toISOString().slice(0, 10)}.pdf`);
}

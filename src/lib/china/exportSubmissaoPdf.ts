import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { triggerBlobDownload } from "@/lib/utils/storage-download";
import type { MailboxItem } from "@/hooks/useChinaMailbox";

interface RevisaoLite {
  rodada: number;
  resultado: string;
  motivo_rejeicao: string | null;
  acao_tipo: string | null;
  acao_por_nome: string | null;
  contestacao_texto: string | null;
  created_at: string;
}

/**
 * Gera um PDF profissional com o histórico/registro de uma submissão China —
 * pronto para anexar a relatórios ou compartilhar com o time.
 */
export async function exportSubmissaoPdf(item: MailboxItem) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header
  doc.setFillColor(231, 30, 120);
  doc.rect(0, 0, pageWidth, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Registro de Submissão — China", margin, 25);
  doc.setFontSize(9);
  doc.text("提交记录", margin, 42);
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    pageWidth - margin,
    42,
    { align: "right" },
  );

  // Bloco de identificação
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  let y = 90;
  doc.setFont("helvetica", "bold");
  doc.text(`${item.produto_codigo} — ${item.produto_nome}`, margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (item.numero_ordem) {
    doc.text(`Ordem de Compra: ${item.numero_ordem}`, margin, y);
    y += 12;
  }
  doc.text(`Status atual: ${item.submissao_status}`, margin, y);
  y += 12;
  doc.text(
    `Criada em: ${format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    margin,
    y,
  );
  y += 12;
  if (item.tipo_documento) {
    doc.text(`Tipo de documento: ${item.tipo_documento}`, margin, y);
    y += 12;
  }
  if (item.nome_arquivo) {
    doc.text(`Arquivo: ${item.nome_arquivo}`, margin, y);
    y += 12;
  }

  // Observações
  const obsStartY = y + 8;
  doc.setFont("helvetica", "bold");
  doc.text("Observações / 备注", margin, obsStartY);
  y = obsStartY + 14;
  doc.setFont("helvetica", "normal");
  if (item.observacoes_china) {
    doc.setTextColor(110, 110, 110);
    doc.text("CHINA:", margin, y);
    y += 12;
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(item.observacoes_china, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 6;
  }
  if (item.observacoes_brasil) {
    doc.setTextColor(110, 110, 110);
    doc.text("BRASIL:", margin, y);
    y += 12;
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(item.observacoes_brasil, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 6;
  }
  if (!item.observacoes_china && !item.observacoes_brasil) {
    doc.setTextColor(140, 140, 140);
    doc.text("Sem observações registradas.", margin, y);
    y += 14;
    doc.setTextColor(0, 0, 0);
  }

  // Histórico de revisões
  const { data: rev } = await (supabase
    .from("china_doc_revisoes" as any) as any)
    .select("rodada, resultado, motivo_rejeicao, acao_tipo, acao_por_nome, contestacao_texto, created_at")
    .eq("submissao_id", item.submissao_id)
    .order("created_at", { ascending: true });

  const revisoes = ((rev || []) as any[]) as RevisaoLite[];

  autoTable(doc, {
    startY: y + 10,
    head: [["#", "Quando", "Ação", "Resultado", "Por", "Detalhe"]],
    body: revisoes.length
      ? revisoes.map((r) => [
          String(r.rodada ?? ""),
          format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR }),
          r.acao_tipo || "—",
          r.resultado,
          r.acao_por_nome || "—",
          r.motivo_rejeicao || r.contestacao_texto || "",
        ])
      : [["—", "—", "—", "—", "—", "Nenhuma revisão registrada."]],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 70 },
      2: { cellWidth: 60 },
      3: { cellWidth: 60 },
      4: { cellWidth: 80 },
      5: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Página ${i} de ${pageCount} · Documento confidencial`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 18,
      { align: "center" },
    );
  }

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const safeCodigo = (item.produto_codigo || "submissao").replace(/[^a-zA-Z0-9-_]/g, "_");
  triggerBlobDownload(url, `submissao_${safeCodigo}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}

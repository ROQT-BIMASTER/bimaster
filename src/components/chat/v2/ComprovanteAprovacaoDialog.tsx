/**
 * ComprovanteAprovacaoDialog — comprovante de aprovação eletrônica (assinatura
 * simples / trilha de auditoria, Lei 14.063/2020).
 *
 * Mostra preview na tela e gera PDF real via jsPDF (não depende de window.print,
 * que renderiza em branco quando disparado de dentro de um Radix Dialog).
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, ShieldCheck, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAprovacaoDocumentos } from "@/hooks/chat/useAprovacaoDocumentos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";

interface Props {
  aprovacaoId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface AprovacaoFull {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  solicitante_id: string;
  decidido_por: string | null;
  decidido_em: string | null;
  decidido_ip: string | null;
  decidido_user_agent: string | null;
  created_at: string;
}

export function ComprovanteAprovacaoDialog({ aprovacaoId, open, onOpenChange }: Props) {
  const { data: ap } = useQuery({
    queryKey: ["comprovante-aprovacao", aprovacaoId],
    enabled: open && !!aprovacaoId,
    queryFn: async (): Promise<AprovacaoFull | null> => {
      const { data, error } = await supabase
        .from("chat_aprovacoes" as any)
        .select("id, titulo, descricao, status, solicitante_id, decidido_por, decidido_em, decidido_ip, decidido_user_agent, created_at")
        .eq("id", aprovacaoId)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as AprovacaoFull) ?? null;
    },
  });

  const { data: documentos = [] } = useAprovacaoDocumentos(open ? aprovacaoId : null);

  const { data: nomes = {} } = useQuery({
    queryKey: ["comprovante-nomes", ap?.solicitante_id, ap?.decidido_por],
    enabled: open && !!ap,
    queryFn: async (): Promise<Record<string, string>> => {
      const ids = [ap?.solicitante_id, ap?.decidido_por].filter(Boolean) as string[];
      if (ids.length === 0) return {};
      const { data, error } = await (supabase.rpc as any)("get_chat_directory", { _ids: ids });
      if (error) throw error;
      const map: Record<string, string> = {};
      (data as any[] | null)?.forEach((p) => { map[p.id] = p.nome ?? "—"; });
      return map;
    },
  });

  const fmt = (d: string | null) => (d ? format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—");

  const gerarPdf = () => {
    if (!ap) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const addLabelValue = (label: string, value: string, colW = contentW) => {
      ensureSpace(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(label.toUpperCase(), margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(20);
      const lines = doc.splitTextToSize(value || "—", colW);
      ensureSpace(lines.length * 5);
      doc.text(lines, margin, y);
      y += lines.length * 5 + 2;
    };

    // Cabeçalho
    doc.setFillColor(34, 197, 94);
    doc.rect(margin, y, 1.5, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text("Comprovante de Aprovação Eletrônica", margin + 4, y + 7);
    y += 14;
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
    doc.text(`ID: ${ap.id}`, pageW - margin, y, { align: "right" });
    y += 7;

    // Assunto
    addLabelValue("Assunto", ap.titulo);
    if (ap.descricao) addLabelValue("Descrição", ap.descricao);

    // Duas colunas
    const colW = (contentW - 6) / 2;
    const renderPair = (l1: string, v1: string, l2: string, v2: string) => {
      ensureSpace(14);
      const yStart = y;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(110);
      doc.text(l1.toUpperCase(), margin, y);
      doc.text(l2.toUpperCase(), margin + colW + 6, y);
      y += 4;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20);
      const lines1 = doc.splitTextToSize(v1 || "—", colW);
      const lines2 = doc.splitTextToSize(v2 || "—", colW);
      doc.text(lines1, margin, y);
      doc.text(lines2, margin + colW + 6, y);
      y = yStart + 4 + Math.max(lines1.length, lines2.length) * 5 + 3;
    };

    renderPair(
      "Solicitante", nomes[ap.solicitante_id] ?? "—",
      "Aprovador", ap.decidido_por ? (nomes[ap.decidido_por] ?? "—") : "—",
    );
    renderPair(
      "Decisão", `${ap.status.charAt(0).toUpperCase()}${ap.status.slice(1)} em ${fmt(ap.decidido_em)}`,
      "IP de origem", ap.decidido_ip ?? "—",
    );

    if (ap.decidido_user_agent) {
      addLabelValue("Dispositivo", ap.decidido_user_agent);
    }

    // Documentos
    ensureSpace(10);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(110);
    doc.text(`DOCUMENTOS (${documentos.length})`, margin, y);
    y += 5;

    if (documentos.length === 0) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(140);
      doc.text("Nenhum documento.", margin, y);
      y += 6;
    } else {
      documentos.forEach((d, i) => {
        const tituloLines = doc.splitTextToSize(d.titulo || "—", contentW - 4);
        const hashLines = doc.splitTextToSize(`SHA-256: ${d.hash_arquivo ?? "—"}`, contentW - 4);
        const blockH = tituloLines.length * 5 + hashLines.length * 4 + 5;
        ensureSpace(blockH);
        doc.setDrawColor(230);
        doc.rect(margin, y, contentW, blockH);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(30);
        doc.text(tituloLines, margin + 2, y + 5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120);
        doc.text(hashLines, margin + 2, y + 5 + tituloLines.length * 5);
        y += blockH + 1;
      });
    }

    // Rodapé legal
    ensureSpace(20);
    y = Math.max(y, pageH - margin - 18);
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(110);
    const legal = "Assinatura eletrônica simples (Lei 14.063/2020): registro do ato de aprovação com trilha de auditoria. A integridade de cada documento pode ser verificada pelo hash SHA-256 acima.";
    doc.text(doc.splitTextToSize(legal, contentW), margin, y);

    // Paginação
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`${p} / ${total}`, pageW - margin, pageH - 6, { align: "right" });
    }

    const safeTitle = (ap.titulo || "comprovante").replace(/[^\w\-]+/g, "_").slice(0, 60);
    doc.save(`comprovante-aprovacao-${safeTitle}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-success" />
            Comprovante de Aprovação Eletrônica
          </DialogTitle>
        </DialogHeader>

        {!ap ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Assunto</p>
              <p className="font-medium">{ap.titulo}</p>
              {ap.descricao && <p className="text-muted-foreground whitespace-pre-wrap mt-0.5">{ap.descricao}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Solicitante</p>
                <p>{nomes[ap.solicitante_id] ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Aprovador</p>
                <p>{ap.decidido_por ? (nomes[ap.decidido_por] ?? "—") : "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Decisão</p>
                <p className="capitalize">{ap.status} em {fmt(ap.decidido_em)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">IP de origem</p>
                <p>{ap.decidido_ip ?? "—"}</p>
              </div>
            </div>

            {ap.decidido_user_agent && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Dispositivo</p>
                <p className="text-xs break-words text-muted-foreground">{ap.decidido_user_agent}</p>
              </div>
            )}

            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                Documentos ({documentos.length})
              </p>
              <div className="rounded-md border divide-y">
                {documentos.map((d) => (
                  <div key={d.id} className="p-2">
                    <p className="font-medium truncate">{d.titulo}</p>
                    <p className="text-[10px] text-muted-foreground break-all">
                      SHA-256: {d.hash_arquivo ?? "—"}
                    </p>
                  </div>
                ))}
                {documentos.length === 0 && (
                  <p className="p-2 text-xs text-muted-foreground">Nenhum documento.</p>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground border-t pt-3">
              Assinatura eletrônica simples (Lei 14.063/2020): registro do ato de
              aprovação com trilha de auditoria. A integridade de cada documento pode
              ser verificada pelo hash SHA-256 acima.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={gerarPdf} disabled={!ap} className="gap-1.5">
            <FileDown className="h-4 w-4" /> Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

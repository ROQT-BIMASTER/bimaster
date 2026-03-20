import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportType, data, fileName } = await req.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum dado para exportar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract columns from the first data row
    const columns = Object.keys(data[0]);

    const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const usableWidth = pageWidth - margin * 2;

    // Title
    const title = fileName || `Relatório ${reportType || ''}`;
    doc.setFontSize(16);
    doc.text(title, margin, 20);

    // Date
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, margin, 27);
    doc.setTextColor(0, 0, 0);

    // Table
    const colWidth = usableWidth / columns.length;
    const rowHeight = 8;
    let y = 35;

    // Truncate column header text
    const truncate = (text: string, maxLen: number) => {
      const str = String(text ?? '');
      return str.length > maxLen ? str.substring(0, maxLen - 2) + '..' : str;
    };
    const maxChars = Math.max(8, Math.floor(colWidth / 2));

    // Header row
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(41, 65, 122);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y - 5, usableWidth, rowHeight, 'F');
    columns.forEach((col, i) => {
      doc.text(truncate(col, maxChars), margin + i * colWidth + 2, y);
    });

    y += rowHeight;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    // Data rows
    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      if (y + rowHeight > pageHeight - 15) {
        doc.addPage();
        y = 20;
        // Re-draw header on new page
        doc.setFont("helvetica", "bold");
        doc.setFillColor(41, 65, 122);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, y - 5, usableWidth, rowHeight, 'F');
        columns.forEach((col, i) => {
          doc.text(truncate(col, maxChars), margin + i * colWidth + 2, y);
        });
        y += rowHeight;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
      }

      // Zebra striping
      if (rowIdx % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y - 5, usableWidth, rowHeight, 'F');
      }

      const row = data[rowIdx];
      columns.forEach((col, i) => {
        const val = row[col] != null ? String(row[col]) : '';
        doc.setFontSize(7);
        doc.text(truncate(val, maxChars), margin + i * colWidth + 2, y);
      });

      y += rowHeight;
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin - 30, pageHeight - 8);
      doc.text(`Total de registros: ${data.length}`, margin, pageHeight - 8);
    }

    // Output as base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];

    return new Response(
      JSON.stringify({ pdf: pdfBase64, fileName: `${title}.pdf` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao gerar PDF' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

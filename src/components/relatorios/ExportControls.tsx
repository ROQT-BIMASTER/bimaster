import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportToExcel } from "@/utils/excelExport";

interface ExportControlsProps {
  reportType: string;
  data: any[];
}

export const ExportControls = ({ reportType, data }: ExportControlsProps) => {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExportExcel = async () => {
    try {
      await exportToExcel(data, {
        filename: `relatorio_${reportType}`,
        sheetName: "Relatório",
        includeTimestamp: true,
      });

      toast({
        title: "Exportação concluída",
        description: "Relatório exportado com sucesso em formato Excel",
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar o relatório",
        variant: "destructive"
      });
    }
  };

  const handleExportPDF = async () => {
    if (!data || data.length === 0) {
      toast({
        title: "Sem dados",
        description: "Não há dados para exportar",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const fileName = `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}`;

      const { data: result, error } = await supabase.functions.invoke('export-pdf', {
        body: { reportType, data, fileName },
      });

      if (error) throw error;
      if (!result?.pdf) throw new Error('PDF não retornado pela função');

      // Decode base64 and trigger download
      const byteCharacters = atob(result.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF exportado",
        description: "O relatório foi baixado com sucesso",
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleExportExcel}
      >
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        Excel
      </Button>
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleExportPDF}
        disabled={exporting}
      >
        <FileDown className="h-4 w-4 mr-2" />
        {exporting ? "Exportando..." : "PDF"}
      </Button>
    </div>
  );
};

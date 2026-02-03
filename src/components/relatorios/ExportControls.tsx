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
    setExporting(true);
    try {
      const { data: pdfData, error } = await supabase.functions.invoke('export-pdf', {
        body: {
          reportType,
          data,
          fileName: `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}`
        }
      });

      if (error) throw error;

      toast({
        title: "Exportação em PDF",
        description: "A funcionalidade de exportação em PDF será implementada em breve",
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Exportação em desenvolvimento",
        description: "A exportação em PDF estará disponível em breve",
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

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Download, FileImage, FileText, Calendar, Loader2 } from "lucide-react";

interface Props {
  htmlCode: string | null;
  designId: string;
  onSchedulePost?: () => void;
}

export const ExportOptions = ({ htmlCode, designId, onSchedulePost }: Props) => {
  const [exporting, setExporting] = useState(false);

  const handleExportHTML = () => {
    if (!htmlCode) return;
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet"></head><body>${htmlCode}</body></html>`], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `design-${designId.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("HTML exportado!");
  };

  const handleExportPNG = async () => {
    if (!htmlCode) return;
    setExporting(true);
    try {
      // Use canvas-based approach with iframe screenshot
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;width:1080px;height:1080px;border:none;";
      iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet"><style>body{margin:0;}</style></head><body>${htmlCode}</body></html>`;
      document.body.appendChild(iframe);

      await new Promise((r) => setTimeout(r, 2000));

      // Use html2canvas-like approach via SVG foreignObject
      const svgData = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">${htmlCode}</div>
          </foreignObject>
        </svg>`;
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `design-${designId.slice(0, 8)}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(iframe);
      toast.success("Design exportado como SVG!");
    } catch {
      toast.error("Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={!htmlCode || exporting}>
          {exporting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleExportHTML}>
          <FileText className="h-4 w-4 mr-2" /> HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPNG}>
          <FileImage className="h-4 w-4 mr-2" /> SVG/Imagem
        </DropdownMenuItem>
        {onSchedulePost && (
          <DropdownMenuItem onClick={onSchedulePost}>
            <Calendar className="h-4 w-4 mr-2" /> Agendar como Post
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

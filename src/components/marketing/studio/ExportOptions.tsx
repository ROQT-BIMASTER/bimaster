import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Download, FileImage, FileText, Calendar, Loader2, Figma, Copy, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  const handleExportSVG = async () => {
    if (!htmlCode) return;
    setExporting(true);
    try {
      const svgData = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet"/>
      ${htmlCode}
    </div>
  </foreignObject>
</svg>`;
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `design-${designId.slice(0, 8)}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("SVG exportado! Importe no Figma via File > Place Image");
    } catch {
      toast.error("Erro ao exportar SVG");
    } finally {
      setExporting(false);
    }
  };

  const handleCopyForFigma = () => {
    if (!htmlCode) return;
    const cleanHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
</head>
<body>
${htmlCode}
</body>
</html>`;
    navigator.clipboard.writeText(cleanHtml);
    toast.success(
      "HTML copiado! Cole no plugin 'HTML to Figma' no Figma.",
      { duration: 5000, description: "Figma > Plugins > HTML to Figma > Cole o código" }
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-7" disabled={!htmlCode || exporting}>
          {exporting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Download className="h-3 w-3 mr-1" />}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleExportHTML}>
          <FileText className="h-4 w-4 mr-2" /> Download HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportSVG}>
          <FileImage className="h-4 w-4 mr-2" /> Download SVG
        </DropdownMenuItem>
        {onSchedulePost && (
          <DropdownMenuItem onClick={onSchedulePost}>
            <Calendar className="h-4 w-4 mr-2" /> Agendar como Post
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportSVG}>
          <Figma className="h-4 w-4 mr-2" /> Exportar SVG p/ Figma
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyForFigma}>
          <Copy className="h-4 w-4 mr-2" /> Copiar HTML p/ Figma
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-start gap-1.5">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Para importar no Figma: arraste o SVG ou use o plugin gratuito "HTML to Figma".</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

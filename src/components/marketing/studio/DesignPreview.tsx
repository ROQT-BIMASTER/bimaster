import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Code, Eye, X } from "lucide-react";

interface Props {
  htmlCode: string | null;
  onClose: () => void;
}

export const DesignPreview = ({ htmlCode, onClose }: Props) => {
  const [code, setCode] = useState(htmlCode || "");
  const [showEditor, setShowEditor] = useState(false);

  const iframeSrc = `data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet">
    <style>body{margin:0;padding:0;}</style></head>
    <body>${code}</body></html>
  `)}`;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4" /> Preview Live
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant={showEditor ? "default" : "outline"} onClick={() => setShowEditor(!showEditor)}>
            <Code className="h-3 w-3 mr-1" /> {showEditor ? "Ocultar Código" : "Editar Código"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className={`grid ${showEditor ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
          <div className="border-t">
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet"><style>body{margin:0;padding:0;}</style></head><body>${code}</body></html>`}
              className="w-full h-[500px] border-0"
              sandbox="allow-scripts"
              title="Design Preview"
            />
          </div>
          {showEditor && (
            <div className="border-t lg:border-l">
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-[500px] rounded-none border-0 font-mono text-xs resize-none focus-visible:ring-0"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

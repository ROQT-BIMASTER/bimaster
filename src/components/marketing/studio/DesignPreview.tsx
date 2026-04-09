import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Code, Eye, X, Loader2 } from "lucide-react";

interface Props {
  htmlCode: string | null;
  previewUrl?: string | null;
  onClose: () => void;
}

export const DesignPreview = ({ htmlCode, previewUrl, onClose }: Props) => {
  const [code, setCode] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If htmlCode is a URL, fetch it; otherwise use it directly
    if (htmlCode && htmlCode.startsWith("http")) {
      setLoading(true);
      fetch(htmlCode)
        .then((r) => r.ok ? r.text() : Promise.reject("Fetch failed"))
        .then((text) => setCode(text))
        .catch(() => setCode(`<p style="padding:20px;color:red;">Não foi possível carregar o HTML do design.</p>`))
        .finally(() => setLoading(false));
    } else {
      setCode(htmlCode || "");
    }
  }, [htmlCode]);

  // If we have a preview URL (screenshot) and no HTML, show the image
  const hasHtml = !!code.trim();

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4" /> Preview Live
        </CardTitle>
        <div className="flex gap-2">
          {hasHtml && (
            <Button size="sm" variant={showEditor ? "default" : "outline"} onClick={() => setShowEditor(!showEditor)}>
              <Code className="h-3 w-3 mr-1" /> {showEditor ? "Ocultar Código" : "Editar Código"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando preview...</span>
          </div>
        ) : hasHtml ? (
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
        ) : previewUrl ? (
          <div className="border-t">
            <img src={previewUrl} alt="Design Preview" className="w-full max-h-[600px] object-contain" />
          </div>
        ) : (
          <div className="flex items-center justify-center py-20 text-muted-foreground border-t">
            <p>Nenhum conteúdo disponível para preview.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

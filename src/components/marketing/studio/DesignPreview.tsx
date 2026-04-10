import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Code, Eye, X, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { ExportOptions } from "./ExportOptions";

interface Props {
  htmlCode: string | null;
  previewUrl?: string | null;
  onClose: () => void;
  onRegenerate?: () => void;
}

export const DesignPreview = ({ htmlCode, previewUrl, onClose, onRegenerate }: Props) => {
  const [code, setCode] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setFetchError(false);
    if (htmlCode && htmlCode.startsWith("http")) {
      setLoading(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      fetch(htmlCode, { signal: controller.signal })
        .then((r) => r.ok ? r.text() : Promise.reject("Fetch failed"))
        .then((text) => {
          if (text.trim().startsWith("<") || text.includes("<!DOCTYPE")) {
            setCode(text);
          } else {
            setFetchError(true);
            setCode("");
          }
        })
        .catch(() => {
          setFetchError(true);
          setCode("");
        })
        .finally(() => {
          clearTimeout(timeout);
          setLoading(false);
        });
    } else {
      setCode(htmlCode || "");
    }
  }, [htmlCode]);

  const hasHtml = !!code.trim();
  const showFallbackImage = (!hasHtml && previewUrl) || (fetchError && previewUrl);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4" /> Preview Live
        </CardTitle>
        <div className="flex gap-2">
          {hasHtml && <ExportOptions htmlCode={code} />}
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
        ) : showFallbackImage ? (
          <div className="border-t">
            {fetchError && (
              <div className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground text-xs">
                <AlertTriangle className="h-3 w-3" />
                O código HTML não pôde ser carregado. Exibindo screenshot do design.
              </div>
            )}
            <img src={previewUrl!} alt="Design Preview" className="w-full max-h-[600px] object-contain" />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-t gap-4">
            <AlertTriangle className="h-8 w-8 opacity-50" />
            <p className="text-sm">Nenhum conteúdo disponível para preview.</p>
            <p className="text-xs max-w-md text-center">
              O design pode estar sendo processado ou o HTML não foi gerado corretamente. 
              Tente regenerar o design.
            </p>
            {onRegenerate && (
              <Button size="sm" variant="outline" onClick={onRegenerate}>
                <RefreshCw className="h-3 w-3 mr-1" /> Regenerar Design
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

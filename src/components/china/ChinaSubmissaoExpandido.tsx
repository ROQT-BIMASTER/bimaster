import { useMemo } from "react";
import { Eye, FileText, Camera, Package, Loader2, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDocumentosDaSubmissao } from "@/hooks/useChinaDocumentoVinculos";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES } from "@/lib/china-document-types";

interface ChinaSubmissaoExpandidoProps {
  submissao: any;
  onPreviewDoc: (doc: any) => void;
}

function getDocTypeLabel(tipo: string) {
  const dt = CHINA_DOCUMENT_TYPES.find((d) => d.tipo === tipo);
  return dt ? dt.labelPt : tipo;
}

function isImageType(tipo: string) {
  return tipo.startsWith("foto_") || tipo === "amostra_foto";
}

export function ChinaSubmissaoExpandido({ submissao, onPreviewDoc }: ChinaSubmissaoExpandidoProps) {
  const { data: documentos = [], isLoading } = useDocumentosDaSubmissao(submissao.id);

  const docsByCategory = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const cat of DOCUMENT_CATEGORIES) {
      const catDocs = documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento));
      if (catDocs.length > 0) grouped[cat.key] = catDocs;
    }
    const allTipos = DOCUMENT_CATEGORIES.flatMap((c) => c.tipos);
    const ungrouped = documentos.filter((d: any) => !allTipos.includes(d.tipo_documento));
    if (ungrouped.length > 0) grouped["_outros"] = ungrouped;
    return grouped;
  }, [documentos]);

  const getCategoryLabel = (key: string) => {
    if (key === "_outros") return "Outros";
    const cat = DOCUMENT_CATEGORIES.find((c) => c.key === key);
    return cat ? cat.labelPt : key;
  };

  const getCategoryIcon = (key: string) => {
    if (key === "fotos_planilha" || key === "imagens_gerais") return <Camera className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  return (
    <div className="px-4 pb-3 space-y-3 bg-muted/20 border-t border-border/50">
      {/* Product details compact */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 text-[11px]">
        {submissao.formula_codigo && (
          <div>
            <span className="text-muted-foreground">Fórmula:</span>{" "}
            <span className="font-mono">{submissao.formula_codigo}</span>
          </div>
        )}
        {submissao.qty_total && (
          <div>
            <span className="text-muted-foreground">Qtd:</span>{" "}
            <span className="font-semibold">{submissao.qty_total.toLocaleString()}</span>
          </div>
        )}
        {submissao.ean_unidade && (
          <div>
            <span className="text-muted-foreground">EAN:</span>{" "}
            <span className="font-mono">{submissao.ean_unidade}</span>
          </div>
        )}
        {submissao.peso_liquido_g && (
          <div>
            <span className="text-muted-foreground">Peso:</span>{" "}
            <span>{submissao.peso_liquido_g}g / {submissao.peso_bruto_g || "—"}g</span>
          </div>
        )}
        {submissao.numero_ordem && (
          <div>
            <span className="text-muted-foreground">OC:</span>{" "}
            <span>{submissao.numero_ordem}</span>
          </div>
        )}
        {submissao.numero_item && (
          <div>
            <span className="text-muted-foreground">Item:</span>{" "}
            <span>{submissao.numero_item}</span>
          </div>
        )}
      </div>

      {/* Observations */}
      {(submissao.observacoes_brasil || submissao.observacoes_china) && (
        <div className="space-y-0.5 text-[11px] rounded-md bg-accent/30 px-2.5 py-1.5">
          {submissao.observacoes_brasil && (
            <p className="text-muted-foreground">
              <span className="font-medium">🇧🇷</span> {submissao.observacoes_brasil}
            </p>
          )}
          {submissao.observacoes_china && (
            <p className="text-muted-foreground">
              <span className="font-medium">🇨🇳</span> {submissao.observacoes_china}
            </p>
          )}
        </div>
      )}

      {/* Documents */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : documentos.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic py-2">Nenhum documento enviado</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(docsByCategory).map(([catKey, catDocs]) => {
            const photoDocs = catDocs.filter((d: any) => isImageType(d.tipo_documento));
            const fileDocs = catDocs.filter((d: any) => !isImageType(d.tipo_documento));

            return (
              <div key={catKey}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                  {getCategoryIcon(catKey)}
                  {getCategoryLabel(catKey)}
                  <Badge variant="secondary" className="text-[9px] ml-1 h-4 px-1">
                    {catDocs.length}
                  </Badge>
                </p>

                {/* File documents as compact list */}
                {fileDocs.length > 0 && (
                  <div className="space-y-0.5">
                    {fileDocs.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-accent/50 transition-colors group"
                      >
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-foreground">
                          {doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}
                        </span>
                        <Badge
                          variant={doc.status === "aprovado" ? "success" : "secondary"}
                          className="text-[9px] h-4 px-1 shrink-0"
                        >
                          {doc.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); onPreviewDoc(doc); }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Photo documents as thumbnail row */}
                {photoDocs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {photoDocs.map((doc: any) => (
                      <button
                        key={doc.id}
                        onClick={(e) => { e.stopPropagation(); onPreviewDoc(doc); }}
                        className="h-10 w-10 rounded border border-border bg-muted/50 flex items-center justify-center hover:ring-1 hover:ring-primary/50 transition-all overflow-hidden"
                        title={doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}
                      >
                        {doc.arquivo_url ? (
                          <img
                            src={doc.arquivo_url}
                            alt={doc.nome_arquivo || "foto"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              (e.target as HTMLImageElement).parentElement?.classList.add("flex", "items-center", "justify-center");
                            }}
                          />
                        ) : (
                          <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

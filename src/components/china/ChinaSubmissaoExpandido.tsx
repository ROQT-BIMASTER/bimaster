import { useState, useMemo } from "react";
import { Eye, FileText, Camera, Link2, Loader2, Send, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useDocumentosDaSubmissao } from "@/hooks/useChinaDocumentoVinculos";
import { useDespachosPorSubmissao } from "@/hooks/useDespachoDocumentos";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES } from "@/lib/china-document-types";
import { ChinaDocVincularDialog } from "./ChinaDocVincularDialog";
import { DespachoDocumentoDialog } from "@/components/processo/DespachoDocumentoDialog";

interface ChinaSubmissaoExpandidoProps {
  submissao: any;
  onPreviewDoc: (doc: any) => void;
  processoId?: string;
}

function getDocTypeLabel(tipo: string) {
  const dt = CHINA_DOCUMENT_TYPES.find((d) => d.tipo === tipo);
  return dt ? dt.labelPt : tipo;
}

function isImageType(tipo: string) {
  return tipo.startsWith("foto_") || tipo === "amostra_foto";
}

function getCategoryKeyForTipo(tipo: string): string {
  for (const cat of DOCUMENT_CATEGORIES) {
    if (cat.tipos.includes(tipo)) return cat.key;
  }
  return "_outros";
}

const DESPACHO_STATUS_COLORS: Record<string, string> = {
  pendente: "border-l-yellow-400",
  em_analise: "border-l-blue-400",
  aprovado: "border-l-green-500",
  rejeitado: "border-l-red-500",
  devolvido_china: "border-l-emerald-600",
};

export function ChinaSubmissaoExpandido({ submissao, onPreviewDoc, processoId }: ChinaSubmissaoExpandidoProps) {
  const { data: documentos = [], isLoading } = useDocumentosDaSubmissao(submissao.id);
  const { data: despachos = [] } = useDespachosPorSubmissao(submissao.id);
  const [vincularDoc, setVincularDoc] = useState<any>(null);
  const [vincularCatKey, setVincularCatKey] = useState("");
  const [despachoDoc, setDespachoDoc] = useState<any>(null);
  const [despachoCatKey, setDespachoCatKey] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [batchDespachoOpen, setBatchDespachoOpen] = useState(false);

  // Build anexo numbering map: documento_id → numero_anexo
  const anexoMap = useMemo(() => {
    const map: Record<string, number> = {};
    despachos.forEach((d: any) => { map[d.documento_id] = d.numero_anexo; });
    return map;
  }, [despachos]);

  // Build status map: documento_id → status
  const statusMap = useMemo(() => {
    const map: Record<string, string> = {};
    despachos.forEach((d: any) => { map[d.documento_id] = d.status; });
    return map;
  }, [despachos]);

  // Auto-number all docs sequentially for display
  const docNumberMap = useMemo(() => {
    const map: Record<string, number> = {};
    let counter = 1;
    for (const cat of DOCUMENT_CATEGORIES) {
      const catDocs = documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento));
      catDocs.forEach((d: any) => {
        map[d.id] = anexoMap[d.id] || counter;
        counter++;
      });
    }
    const allTipos = DOCUMENT_CATEGORIES.flatMap((c) => c.tipos);
    documentos.filter((d: any) => !allTipos.includes(d.tipo_documento)).forEach((d: any) => {
      map[d.id] = anexoMap[d.id] || counter;
      counter++;
    });
    return map;
  }, [documentos, anexoMap]);

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

  // Docs not yet dispatched
  const undispatchedDocs = useMemo(() => 
    documentos.filter((d: any) => !statusMap[d.id]),
  [documentos, statusMap]);

  const toggleDocSelect = (docId: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId); else next.add(docId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocs.size === undispatchedDocs.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(undispatchedDocs.map((d: any) => d.id)));
    }
  };

  const selectedDocsData = useMemo(() =>
    documentos.filter((d: any) => selectedDocs.has(d.id)),
  [documentos, selectedDocs]);

  const getCategoryLabel = (key: string) => {
    if (key === "_outros") return "Outros";
    const cat = DOCUMENT_CATEGORIES.find((c) => c.key === key);
    return cat ? cat.labelPt : key;
  };

  const getCategoryIcon = (key: string) => {
    if (key === "fotos_planilha" || key === "imagens_gerais") return <Camera className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  const handleOpenVincular = (doc: any) => {
    setVincularCatKey(getCategoryKeyForTipo(doc.tipo_documento));
    setVincularDoc(doc);
  };

  const handleOpenDespacho = (doc: any, catKey: string) => {
    setDespachoCatKey(catKey);
    setDespachoDoc(doc);
  };

  const getStatusBadge = (docId: string) => {
    const status = statusMap[docId];
    if (!status) return null;
    const labels: Record<string, string> = {
      pendente: "Pendente",
      em_analise: "Análise",
      aprovado: "Aprovado",
      rejeitado: "Rejeitado",
      devolvido_china: "✓ China",
    };
    const variants: Record<string, "warning" | "default" | "success" | "destructive" | "outline"> = {
      pendente: "warning",
      em_analise: "default",
      aprovado: "success",
      rejeitado: "destructive",
      devolvido_china: "outline",
    };
    return (
      <Badge variant={variants[status] || "secondary"} className="text-[8px] h-3.5 px-1 shrink-0">
        {labels[status] || status}
      </Badge>
    );
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
                    {fileDocs.map((doc: any) => {
                      const despachoStatus = statusMap[doc.id];
                      const borderClass = despachoStatus ? DESPACHO_STATUS_COLORS[despachoStatus] || "" : "";
                      return (
                        <div
                          key={doc.id}
                          className={`flex items-center gap-2 px-2 py-1 rounded text-[11px] hover:bg-accent/50 transition-colors group ${borderClass ? `border-l-2 ${borderClass}` : ""}`}
                        >
                          <span className="text-[9px] font-mono text-muted-foreground shrink-0 w-8">
                            {String(docNumberMap[doc.id] || 0).padStart(2, "0")}
                          </span>
                          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="flex-1 min-w-0 truncate text-foreground">
                            {doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}
                          </span>
                          {getStatusBadge(doc.id)}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                            onClick={(e) => { e.stopPropagation(); handleOpenVincular(doc); }}
                            title="Vincular a tarefa"
                          >
                            <Link2 className="h-3 w-3" />
                          </Button>
                          {!statusMap[doc.id] && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-5 px-1.5 text-[9px] gap-0.5 shrink-0 text-orange-600 border-orange-300 hover:bg-orange-50"
                              onClick={(e) => { e.stopPropagation(); handleOpenDespacho(doc, catKey); }}
                              title="Despachar documento"
                            >
                              <Send className="h-2.5 w-2.5" />
                              Despachar
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Photo documents as thumbnail row */}
                {photoDocs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {photoDocs.map((doc: any) => (
                      <div key={doc.id} className="relative group">
                        <button
                          onClick={(e) => { e.stopPropagation(); onPreviewDoc(doc); }}
                          className="h-10 w-10 rounded border border-border bg-muted/50 flex items-center justify-center hover:ring-1 hover:ring-primary/50 transition-all overflow-hidden"
                          title={`Ax ${String(docNumberMap[doc.id] || 0).padStart(2, "0")} — ${doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}`}
                        >
                          {doc.arquivo_url ? (
                            <img
                              src={doc.arquivo_url}
                              alt={doc.nome_arquivo || "foto"}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                        <span className="absolute -bottom-1 left-0 text-[7px] font-mono bg-background/80 px-0.5 rounded">
                          {String(docNumberMap[doc.id] || 0).padStart(2, "0")}
                        </span>
                        <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenVincular(doc); }}
                            className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                            title="Vincular"
                          >
                            <Link2 className="h-2.5 w-2.5" />
                          </button>
                          {!statusMap[doc.id] && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenDespacho(doc, catKey); }}
                              className="h-4 w-4 rounded-full bg-orange-500 text-white flex items-center justify-center"
                              title="Despachar"
                            >
                              <Send className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Vincular Dialog */}
      <ChinaDocVincularDialog
        open={!!vincularDoc}
        onOpenChange={(open) => { if (!open) setVincularDoc(null); }}
        documento={vincularDoc}
        categoriaKey={vincularCatKey}
      />

      {/* Despacho Dialog */}
      <DespachoDocumentoDialog
        open={!!despachoDoc}
        onOpenChange={(open) => { if (!open) setDespachoDoc(null); }}
        documento={despachoDoc}
        submissaoId={submissao.id}
        processoId={processoId}
        categoriaChecklist={despachoCatKey}
      />
    </div>
  );
}

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye, FileText, Camera, Link2, Loader2, Send, CheckSquare,
  ChevronDown, ChevronRight, FileSpreadsheet, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDocumentosDaSubmissao } from "@/hooks/useChinaDocumentoVinculos";
import { useDespachosPorSubmissao } from "@/hooks/useDespachoDocumentos";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES } from "@/lib/china-document-types";
import { ChinaDocVincularDialog } from "./ChinaDocVincularDialog";
import { DespachoDocumentoDialog } from "@/components/processo/DespachoDocumentoDialog";
import { ChinaInboxDecisoes } from "./ChinaInboxDecisoes";
import { cn } from "@/lib/utils";

interface ChinaSubmissaoExpandidoProps {
  submissao: any;
  onPreviewDoc: (doc: any) => void;
  processoId?: string;
  /** "inline" = embed dentro de outra lista (estilo atual);
   *  "focus" = uso em modal de tela cheia, com seções colapsáveis estilo Projetos. */
  variant?: "inline" | "focus";
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

// Border-left colors aligned with the Projetos status palette (STATUS_COLORS_LIST equivalents)
const DESPACHO_STATUS_COLORS: Record<string, string> = {
  pendente: "border-l-amber-500",
  em_analise: "border-l-blue-500",
  aprovado: "border-l-emerald-500",
  rejeitado: "border-l-red-500",
  devolvido_china: "border-l-emerald-600",
};

export function ChinaSubmissaoExpandido({
  submissao,
  onPreviewDoc,
  processoId,
  variant = "inline",
}: ChinaSubmissaoExpandidoProps) {
  const navigate = useNavigate();
  const { data: documentos = [], isLoading } = useDocumentosDaSubmissao(submissao.id);
  const { data: despachos = [] } = useDespachosPorSubmissao(submissao.id);
  const [vincularDoc, setVincularDoc] = useState<any>(null);
  const [vincularCatKey, setVincularCatKey] = useState("");
  const [despachoDoc, setDespachoDoc] = useState<any>(null);
  const [despachoCatKey, setDespachoCatKey] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [batchDespachoOpen, setBatchDespachoOpen] = useState(false);
  const [docsCollapsed, setDocsCollapsed] = useState(false);
  const [decisoesCollapsed, setDecisoesCollapsed] = useState(false);

  const isFocus = variant === "focus";

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

  // Create a virtual "ficha" document entry representing the submission itself
  const fichaVirtualDoc = useMemo(() => ({
    id: `ficha_${submissao.id}`,
    tipo_documento: "ficha_produto",
    nome_arquivo: `Ficha do Produto — ${submissao.produto_codigo} ${submissao.produto_nome}`,
    status: submissao.status === "aprovado" ? "aprovado" : submissao.status === "rejeitado" ? "rejeitado" : "pendente",
    submissao_id: submissao.id,
    is_ficha_virtual: true,
  }), [submissao]);

  const docsByCategory = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const cat of DOCUMENT_CATEGORIES) {
      const catDocs = documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento));
      if (cat.key === "dados_oficiais") {
        grouped[cat.key] = [fichaVirtualDoc, ...catDocs];
      } else if (catDocs.length > 0) {
        grouped[cat.key] = catDocs;
      }
    }
    if (!grouped["dados_oficiais"]) {
      grouped["dados_oficiais"] = [fichaVirtualDoc];
    }
    const allTipos = DOCUMENT_CATEGORIES.flatMap((c) => c.tipos);
    const ungrouped = documentos.filter((d: any) => !allTipos.includes(d.tipo_documento));
    if (ungrouped.length > 0) grouped["_outros"] = ungrouped;
    return grouped;
  }, [documentos, fichaVirtualDoc]);

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
      devolvido_china: "Devolvido",
    };
    const variants: Record<string, "warning" | "default" | "success" | "destructive" | "outline"> = {
      pendente: "warning",
      em_analise: "default",
      aprovado: "success",
      rejeitado: "destructive",
      devolvido_china: "outline",
    };
    return (
      <Badge variant={variants[status] || "secondary"} className="text-[10px] h-4 px-1.5 shrink-0">
        {labels[status] || status}
      </Badge>
    );
  };

  // ─── Documents body (shared between inline and focus) ────────────────────────
  const documentsBody = isLoading ? (
    <div className="flex items-center justify-center py-4">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  ) : documentos.length === 0 ? (
    <p className="text-[11px] text-muted-foreground italic py-2 px-2">Nenhum documento enviado</p>
  ) : (
    <div className="space-y-3">
      {Object.entries(docsByCategory).map(([catKey, catDocs]) => {
        const photoDocs = catDocs.filter((d: any) => isImageType(d.tipo_documento));
        const fileDocs = catDocs.filter((d: any) => !isImageType(d.tipo_documento));

        return (
          <div key={catKey}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1 px-2">
              {getCategoryIcon(catKey)}
              {getCategoryLabel(catKey)}
              <Badge variant="secondary" className="text-[9px] ml-1 h-4 px-1">
                {catDocs.length}
              </Badge>
            </p>

            {/* File documents — planilha rows */}
            {fileDocs.length > 0 && (
              <div className="space-y-0.5">
                {fileDocs.map((doc: any) => {
                  const isVirtual = doc.is_ficha_virtual;
                  const despachoStatus = isVirtual ? null : statusMap[doc.id];
                  const borderClass = despachoStatus ? DESPACHO_STATUS_COLORS[despachoStatus] || "" : "";
                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        "grid items-center gap-2 px-2 py-1.5 rounded text-[12px] hover:bg-accent/50 transition-colors group",
                        // grid: checkbox(16) | num(28) | icon(16) | name(1fr) | status badge | actions
                        "grid-cols-[16px_28px_16px_minmax(0,1fr)_auto_auto]",
                        borderClass && `border-l-2 ${borderClass}`,
                        isVirtual && "border-l-2 border-l-primary bg-primary/5",
                      )}
                    >
                      <div className="flex items-center justify-center">
                        {!despachoStatus && !isVirtual ? (
                          <Checkbox
                            checked={selectedDocs.has(doc.id)}
                            onCheckedChange={() => toggleDocSelect(doc.id)}
                            className="h-3.5 w-3.5"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : null}
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {isVirtual ? "—" : String(docNumberMap[doc.id] || 0).padStart(2, "0")}
                      </span>
                      {isVirtual ? (
                        <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={cn(
                        "min-w-0 truncate",
                        isVirtual ? "font-semibold text-primary" : "text-foreground",
                      )}>
                        {doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isVirtual && getStatusBadge(doc.id)}
                        <Badge
                          variant={doc.status === "aprovado" ? "success" : isVirtual ? "outline" : "secondary"}
                          className="text-[10px] h-4 px-1.5"
                        >
                          {isVirtual ? "Ficha Oficial" : doc.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant={isVirtual ? "outline" : "ghost"}
                          size="sm"
                          className={cn(
                            "h-6 px-1.5 text-[10px] gap-1",
                            isVirtual ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isVirtual) {
                              navigate(`/dashboard/fabrica-china/produto/${submissao.id}`);
                            } else {
                              onPreviewDoc(doc);
                            }
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          {isVirtual ? "Abrir Ficha" : ""}
                        </Button>
                        {!isVirtual && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                              onClick={(e) => { e.stopPropagation(); handleOpenVincular(doc); }}
                              title="Vincular a tarefa"
                            >
                              <Link2 className="h-3 w-3" />
                            </Button>
                            {!statusMap[doc.id] && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-1.5 text-[10px] gap-1 text-warning border-warning/40 hover:bg-warning/10"
                                onClick={(e) => { e.stopPropagation(); handleOpenDespacho(doc, catKey); }}
                                title="Despachar documento"
                              >
                                <Send className="h-2.5 w-2.5" />
                                Despachar
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Photo documents as thumbnail row */}
            {photoDocs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 px-2">
                {photoDocs.map((doc: any) => (
                  <div key={doc.id} className="relative group">
                    <button
                      onClick={(e) => { e.stopPropagation(); onPreviewDoc(doc); }}
                      className="h-12 w-12 rounded border border-border bg-muted/50 flex items-center justify-center hover:ring-1 hover:ring-primary/50 transition-all overflow-hidden"
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
                        <Camera className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <span className="absolute -bottom-1 left-0 text-[8px] font-mono bg-background/80 px-0.5 rounded">
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
                          className="h-4 w-4 rounded-full bg-warning text-warning-foreground flex items-center justify-center"
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
  );

  // ─── Header chips (used in focus mode) ───────────────────────────────────────
  const headerChips = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
      {submissao.formula_codigo && (
        <div>
          <span className="text-muted-foreground">Fórmula:</span>{" "}
          <span className="font-mono font-medium">{submissao.formula_codigo}</span>
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
          <span className="font-medium">{submissao.peso_liquido_g}g / {submissao.peso_bruto_g || "—"}g</span>
        </div>
      )}
      {submissao.numero_item && (
        <div>
          <span className="text-muted-foreground">Item:</span>{" "}
          <span className="font-medium">{submissao.numero_item}</span>
        </div>
      )}
    </div>
  );

  // ─── Inline variant: keeps the original embedded layout (used in lists) ──────
  if (!isFocus) {
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
                <span className="font-medium">BR</span> {submissao.observacoes_brasil}
              </p>
            )}
            {submissao.observacoes_china && (
              <p className="text-muted-foreground">
                <span className="font-medium">CN</span> {submissao.observacoes_china}
              </p>
            )}
          </div>
        )}

        {/* Batch action bar (inline) */}
        {selectedDocs.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary">{selectedDocs.size} selecionado(s)</span>
            <Button
              variant="default"
              size="sm"
              className="h-6 text-xs gap-1 ml-auto"
              onClick={() => setBatchDespachoOpen(true)}
            >
              <Send className="h-3 w-3" />
              Despachar {selectedDocs.size} doc(s)
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedDocs(new Set())}>
              Limpar
            </Button>
          </div>
        )}

        {/* Select-all toggle (inline) */}
        {undispatchedDocs.length > 1 && (
          <div className="flex items-center gap-2 px-2">
            <Checkbox
              checked={selectedDocs.size === undispatchedDocs.length && undispatchedDocs.length > 0}
              onCheckedChange={toggleSelectAll}
              className="h-3.5 w-3.5"
            />
            <span className="text-[10px] text-muted-foreground">
              Selecionar todos ({undispatchedDocs.length} pendentes)
            </span>
          </div>
        )}

        {documentsBody}

        {/* Inbox de Decisões do Brasil */}
        <ChinaInboxDecisoes submissaoId={submissao.id} processId={processoId} />

        {/* Dialogs */}
        <ChinaDocVincularDialog
          open={!!vincularDoc}
          onOpenChange={(open) => { if (!open) setVincularDoc(null); }}
          documento={vincularDoc}
          categoriaKey={vincularCatKey}
        />
        <DespachoDocumentoDialog
          open={!!despachoDoc}
          onOpenChange={(open) => { if (!open) setDespachoDoc(null); }}
          documentos={despachoDoc ? [despachoDoc] : []}
          submissaoId={submissao.id}
          processoId={processoId}
          categoriaChecklist={despachoCatKey}
        />
        <DespachoDocumentoDialog
          open={batchDespachoOpen}
          onOpenChange={(open) => { if (!open) { setBatchDespachoOpen(false); setSelectedDocs(new Set()); } }}
          documentos={selectedDocsData}
          submissaoId={submissao.id}
          processoId={processoId}
        />
      </div>
    );
  }

  // ─── Focus variant: project-style sections ───────────────────────────────────
  return (
    <div className="space-y-4 pb-24">
      {/* Header chips strip */}
      <div className="rounded-md border border-border/60 bg-card px-4 py-2.5">
        {headerChips}
      </div>

      {/* Observations */}
      {(submissao.observacoes_brasil || submissao.observacoes_china) && (
        <div className="space-y-1 text-[12px] rounded-md border border-border/60 bg-accent/20 px-3 py-2">
          {submissao.observacoes_brasil && (
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">BR</span> — {submissao.observacoes_brasil}
            </p>
          )}
          {submissao.observacoes_china && (
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">CN</span> — {submissao.observacoes_china}
            </p>
          )}
        </div>
      )}

      {/* Section A — Documentos */}
      <Collapsible open={!docsCollapsed} onOpenChange={(o) => setDocsCollapsed(!o)}>
        <div className="rounded-md border border-border/60 border-l-4 border-l-blue-500 bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity">
                {docsCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-semibold">Documentos</span>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  {documentos.length + 1}
                </Badge>
              </button>
            </CollapsibleTrigger>

            {undispatchedDocs.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <Checkbox
                  checked={selectedDocs.size === undispatchedDocs.length && undispatchedDocs.length > 0}
                  onCheckedChange={toggleSelectAll}
                  className="h-3.5 w-3.5"
                />
                <span className="text-[11px] text-muted-foreground">
                  Selecionar todos ({undispatchedDocs.length} pendentes)
                </span>
              </div>
            )}
          </div>
          <CollapsibleContent>
            <div className="p-3">{documentsBody}</div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Section B — Decisões do Brasil */}
      <Collapsible open={!decisoesCollapsed} onOpenChange={(o) => setDecisoesCollapsed(!o)}>
        <div className="rounded-md border border-border/60 border-l-4 border-l-emerald-500 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity">
                {decisoesCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <CheckSquare className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold">Decisões do Brasil</span>
              </button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="p-3">
              <ChinaInboxDecisoes submissaoId={submissao.id} processId={processoId} />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Sticky batch action bar (focus mode) */}
      {selectedDocs.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-3xl w-[calc(100%-2rem)]">
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedDocs(new Set())}
                aria-label="Limpar seleção"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="text-sm">
                <span className="font-bold">{selectedDocs.size}</span>
                <span className="text-muted-foreground">
                  {" "}{selectedDocs.size === 1 ? "documento selecionado" : "documentos selecionados"}
                </span>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setBatchDespachoOpen(true)}
            >
              <Send className="h-3.5 w-3.5" />
              Despachar
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ChinaDocVincularDialog
        open={!!vincularDoc}
        onOpenChange={(open) => { if (!open) setVincularDoc(null); }}
        documento={vincularDoc}
        categoriaKey={vincularCatKey}
      />
      <DespachoDocumentoDialog
        open={!!despachoDoc}
        onOpenChange={(open) => { if (!open) setDespachoDoc(null); }}
        documentos={despachoDoc ? [despachoDoc] : []}
        submissaoId={submissao.id}
        processoId={processoId}
        categoriaChecklist={despachoCatKey}
      />
      <DespachoDocumentoDialog
        open={batchDespachoOpen}
        onOpenChange={(open) => { if (!open) { setBatchDespachoOpen(false); setSelectedDocs(new Set()); } }}
        documentos={selectedDocsData}
        submissaoId={submissao.id}
        processoId={processoId}
      />
    </div>
  );
}

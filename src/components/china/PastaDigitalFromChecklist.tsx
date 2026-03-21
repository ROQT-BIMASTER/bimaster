import { useState, useMemo } from "react";
import { FolderOpen, FileText, Eye, ChevronRight, ChevronDown, Camera, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Loader2, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { useDocumentosDaSubmissao } from "@/hooks/useChinaDocumentoVinculos";
import { DOCUMENT_CATEGORIES, CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { cn } from "@/lib/utils";

interface PastaDigitalFromChecklistProps {
  submissaoId: string;
}

const STATUS_ICONS: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  aprovado: { icon: CheckCircle2, color: "text-success", label: "Aprovado" },
  rejeitado: { icon: XCircle, color: "text-destructive", label: "Rejeitado" },
  pendente: { icon: Clock, color: "text-warning", label: "Pendente" },
  enviado: { icon: Clock, color: "text-primary", label: "Enviado" },
  em_revisao: { icon: AlertCircle, color: "text-warning", label: "Em Revisão" },
  rascunho: { icon: FileText, color: "text-muted-foreground", label: "Rascunho" },
};

function getDocTypeLabel(tipo: string) {
  const dt = CHINA_DOCUMENT_TYPES.find((d) => d.tipo === tipo);
  return dt ? dt.labelPt : tipo;
}

function isImage(name: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
}

function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}

export function PastaDigitalFromChecklist({ submissaoId }: PastaDigitalFromChecklistProps) {
  const { data: documentos = [], isLoading, refetch } = useDocumentosDaSubmissao(submissaoId);
  const [expandedFases, setExpandedFases] = useState<Set<string>>(new Set(["dados_oficiais"]));
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  // Group documents by DOCUMENT_CATEGORIES (phases)
  const fases = useMemo(() => {
    const result: { key: string; labelPt: string; labelCn: string; docs: any[]; fluxo: string }[] = [];
    let pageCounter = 1;

    for (const cat of DOCUMENT_CATEGORIES) {
      const catDocs = documentos
        .filter((d: any) => cat.tipos.includes(d.tipo_documento))
        .map((d: any) => ({ ...d, _page: pageCounter++ }));
      if (catDocs.length > 0) {
        result.push({ key: cat.key, labelPt: cat.labelPt, labelCn: cat.labelCn, docs: catDocs, fluxo: cat.fluxo });
      }
    }

    // Ungrouped
    const allTipos = DOCUMENT_CATEGORIES.flatMap((c) => c.tipos);
    const ungrouped = documentos
      .filter((d: any) => !allTipos.includes(d.tipo_documento))
      .map((d: any) => ({ ...d, _page: pageCounter++ }));
    if (ungrouped.length > 0) {
      result.push({ key: "_outros", labelPt: "Outros", labelCn: "其他", docs: ungrouped, fluxo: "china_envia" });
    }

    return result;
  }, [documentos]);

  const totalDocs = documentos.length;
  const aprovados = documentos.filter((d: any) => d.status === "aprovado").length;
  const pendentes = documentos.filter((d: any) => ["pendente", "enviado"].includes(d.status)).length;

  const toggleFase = (key: string) => {
    setExpandedFases((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectDoc = async (doc: any) => {
    setSelectedDoc(doc);
    setResolvedUrl(null);
    setLoadingUrl(true);
    try {
      if (doc.arquivo_path) {
        const { signedUrl } = await getSignedUrl("china-documentos", doc.arquivo_path);
        setResolvedUrl(signedUrl || null);
      } else if (doc.arquivo_url) {
        setResolvedUrl(doc.arquivo_url);
      }
    } finally {
      setLoadingUrl(false);
    }
  };

  const fileName = selectedDoc?.nome_arquivo || selectedDoc?.arquivo_path?.split("/").pop() || "";
  const showImage = fileName && isImage(fileName);
  const showPdf = fileName && isPdf(fileName);

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (totalDocs === 0) return null;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <BilingualLabel pt="Pasta Digital" cn="数字档案" size="md" />
              <p className="text-[10px] text-muted-foreground mt-0.5">Padrão TJSP — originado do checklist</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{totalDocs} peças</Badge>
            {aprovados > 0 && (
              <Badge className="text-[10px] bg-success/10 text-success border-success/20 border">
                <CheckCircle2 className="h-3 w-3 mr-1" />{aprovados} aprovados
              </Badge>
            )}
            {pendentes > 0 && (
              <Badge className="text-[10px] bg-warning/10 text-warning border-warning/20 border">
                <Clock className="h-3 w-3 mr-1" />{pendentes} pendentes
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => refetch()} title="Atualizar">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Split pane: tree left + viewer right */}
      <div className="flex" style={{ height: "480px" }}>
        {/* Left: Tree */}
        <ScrollArea className="w-[340px] border-r shrink-0">
          <div className="p-2 space-y-0.5">
            {fases.map((fase) => {
              const isOpen = expandedFases.has(fase.key);
              const faseAprovados = fase.docs.filter((d) => d.status === "aprovado").length;
              const allAprovados = faseAprovados === fase.docs.length;

              return (
                <Collapsible key={fase.key} open={isOpen} onOpenChange={() => toggleFase(fase.key)}>
                  <CollapsibleTrigger asChild>
                    <button className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors text-xs",
                      isOpen ? "bg-primary/5 text-primary" : "hover:bg-accent/50"
                    )}>
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      <FolderOpen className={cn("h-3.5 w-3.5 shrink-0", allAprovados ? "text-success" : "text-muted-foreground")} />
                      <span className="flex-1 font-medium truncate">{fase.labelPt}</span>
                      <span className="text-[9px] text-muted-foreground">{fase.labelCn}</span>
                      <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-1">
                        {fase.docs.length}
                      </Badge>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-5 pl-3 border-l border-border/50 space-y-0.5 py-1">
                      {fase.docs.map((doc) => {
                        const statusInfo = STATUS_ICONS[doc.status] || STATUS_ICONS.pendente;
                        const StatusIcon = statusInfo.icon;
                        const isSelected = selectedDoc?.id === doc.id;
                        const isPhoto = doc.tipo_documento?.startsWith("foto_") || doc.tipo_documento === "amostra_foto";

                        return (
                          <button
                            key={doc.id}
                            onClick={() => handleSelectDoc(doc)}
                            className={cn(
                              "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors text-[11px] group",
                              isSelected
                                ? "bg-primary/10 border border-primary/20"
                                : "hover:bg-accent/40"
                            )}
                          >
                            <span className="text-[9px] font-mono text-muted-foreground w-6 shrink-0 text-right">
                              {String(doc._page).padStart(2, "0")}
                            </span>
                            {isPhoto ? (
                              <Camera className="h-3 w-3 text-accent shrink-0" />
                            ) : (
                              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                            <span className="flex-1 min-w-0 truncate text-foreground">
                              {doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}
                            </span>
                            <StatusIcon className={cn("h-3 w-3 shrink-0", statusInfo.color)} />
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>

        {/* Right: Viewer */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedDoc ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <FolderOpen className="h-10 w-10 opacity-30" />
              <p className="text-sm">Selecione um documento na árvore</p>
              <p className="text-xs opacity-60">选择左侧文件查看</p>
            </div>
          ) : (
            <>
              {/* Viewer header */}
              <div className="px-4 py-3 border-b bg-muted/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-medium truncate">{selectedDoc.nome_arquivo || getDocTypeLabel(selectedDoc.tipo_documento)}</span>
                  <Badge
                    variant={selectedDoc.status === "aprovado" ? "success" : selectedDoc.status === "rejeitado" ? "destructive" : "secondary"}
                    className="text-[9px] shrink-0"
                  >
                    {(STATUS_ICONS[selectedDoc.status] || STATUS_ICONS.pendente).label}
                  </Badge>
                </div>
                {resolvedUrl && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" asChild>
                      <a href={resolvedUrl} download={fileName}>
                        <Download className="h-3 w-3 mr-1" /> Download
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" asChild>
                      <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              {/* Viewer content */}
              <div className="flex-1 min-h-0 overflow-auto p-4">
                {loadingUrl ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !resolvedUrl ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                    <FileText className="h-10 w-10 opacity-30" />
                    <p className="text-sm">Não foi possível carregar o arquivo</p>
                  </div>
                ) : showImage ? (
                  <img
                    src={resolvedUrl}
                    alt={fileName}
                    className="max-w-full max-h-full object-contain mx-auto rounded-md"
                  />
                ) : showPdf ? (
                  <iframe
                    src={resolvedUrl}
                    className="w-full h-full rounded-md border"
                    title={fileName}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                    <FileText className="h-12 w-12 opacity-30" />
                    <p className="text-sm">Preview não disponível</p>
                    <Button variant="outline" size="sm" asChild>
                      <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir externamente
                      </a>
                    </Button>
                  </div>
                )}
              </div>

              {/* Doc info footer */}
              {selectedDoc.observacao && (
                <div className="px-4 py-2 border-t bg-warning/5 text-[11px] text-warning">
                  <strong>Observação:</strong> {selectedDoc.observacao}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Package, FileText, Camera, AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useDocumentosDaSubmissao, useCoresDaSubmissao } from "@/hooks/useChinaDocumentoVinculos";
import { useDespachosPorSubmissao } from "@/hooks/useDespachoDocumentos";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES } from "@/lib/china-document-types";
import { cn } from "@/lib/utils";
import type { SubmissaoRow } from "./VincularChinaTable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissao: SubmissaoRow | null;
  onPreviewDoc: (doc: any) => void;
}

function getDocTypeLabel(tipo: string) {
  const dt = CHINA_DOCUMENT_TYPES.find(d => d.tipo === tipo);
  return dt ? dt.labelPt : tipo;
}

function getStatusConfig(status: string) {
  const map: Record<string, { label: string; variant: "secondary" | "default" | "warning" | "success" | "destructive" | "outline" }> = {
    rascunho: { label: "Rascunho", variant: "secondary" },
    enviado: { label: "Enviado", variant: "default" },
    em_revisao: { label: "Em Revisão", variant: "warning" },
    aprovado: { label: "Aprovado", variant: "success" },
    arte_enviada: { label: "Docs Enviados", variant: "outline" },
    rejeitado: { label: "Rejeitado", variant: "destructive" },
  };
  return map[status] || { label: status, variant: "secondary" as const };
}

export function VincularChinaDrawer({ open, onOpenChange, submissao, onPreviewDoc }: Props) {
  const navigate = useNavigate();
  const { data: documentos = [], isLoading: loadingDocs } = useDocumentosDaSubmissao(submissao?.id || null);
  const { data: despachos = [] } = useDespachosPorSubmissao(submissao?.id || "");

  const statusMap = useMemo(() => {
    const map: Record<string, string> = {};
    despachos.forEach((d: any) => { map[d.documento_id] = d.status; });
    return map;
  }, [despachos]);

  const docsByCategory = useMemo(() => {
    const grouped: Record<string, { label: string; icon: React.ReactNode; docs: any[]; pendentes: number }> = {};
    for (const cat of DOCUMENT_CATEGORIES) {
      const catDocs = documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento));
      if (catDocs.length > 0) {
        const pendentes = catDocs.filter((d: any) => !statusMap[d.id] || statusMap[d.id] === "pendente").length;
        grouped[cat.key] = {
          label: cat.labelPt,
          icon: cat.key.includes("foto") || cat.key.includes("imag") ? <Camera className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />,
          docs: catDocs,
          pendentes,
        };
      }
    }
    const allTipos = DOCUMENT_CATEGORIES.flatMap(c => c.tipos);
    const ungrouped = documentos.filter((d: any) => !allTipos.includes(d.tipo_documento));
    if (ungrouped.length > 0) {
      const pendentes = ungrouped.filter((d: any) => !statusMap[d.id]).length;
      grouped["_outros"] = { label: "Outros", icon: <FileText className="h-3.5 w-3.5" />, docs: ungrouped, pendentes };
    }
    return grouped;
  }, [documentos, statusMap]);

  const totalPendentes = Object.values(docsByCategory).reduce((acc, c) => acc + c.pendentes, 0);

  if (!submissao) return null;

  const sc = getStatusConfig(submissao.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-sm font-mono text-primary">{submissao.produto_codigo}</SheetTitle>
                <Badge variant={sc.variant} className="text-[10px]">{sc.label}</Badge>
              </div>
              <p className="text-sm font-semibold truncate">{submissao.produto_nome}</p>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-5">
            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {submissao.formula_codigo && (
                <div><span className="text-muted-foreground">Fórmula:</span> <span className="font-mono">{submissao.formula_codigo}</span></div>
              )}
              {submissao.numero_ordem && (
                <div><span className="text-muted-foreground">OC:</span> <span className="font-semibold">{submissao.numero_ordem}</span></div>
              )}
              {submissao.qty_total && (
                <div><span className="text-muted-foreground">Qtd Total:</span> <span className="font-semibold">{submissao.qty_total.toLocaleString()}</span></div>
              )}
              {submissao.ean_unidade && (
                <div><span className="text-muted-foreground">EAN:</span> <span className="font-mono">{submissao.ean_unidade}</span></div>
              )}
              {submissao.peso_liquido_g && (
                <div><span className="text-muted-foreground">Peso:</span> <span>{submissao.peso_liquido_g}g / {submissao.peso_bruto_g || "—"}g</span></div>
              )}
              {submissao.projetoNome && (
                <div className="col-span-2 flex items-center gap-1.5">
                  <span className="text-muted-foreground">Projeto:</span>
                  {submissao.projetoCor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: submissao.projetoCor }} />}
                  <span className="font-semibold">{submissao.projetoNome}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Status summary */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Documentos</span>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-[10px]">{documentos.length} total</Badge>
                {totalPendentes > 0 && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" />{totalPendentes} pendente(s)
                  </Badge>
                )}
                {totalPendentes === 0 && documentos.length > 0 && (
                  <Badge className="text-[10px] bg-success/10 text-success border-success/20 border gap-1">
                    <CheckCircle2 className="h-3 w-3" />Completo
                  </Badge>
                )}
              </div>
            </div>

            {/* Docs by category */}
            {loadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : documentos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento enviado</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(docsByCategory).map(([key, cat]) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-2">
                      {cat.icon}
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat.label}</span>
                      <Badge variant="secondary" className="text-[9px] h-4">{cat.docs.length}</Badge>
                      {cat.pendentes > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 text-warning border-warning/30">{cat.pendentes} pend.</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {cat.docs.map((doc: any) => {
                        const dStatus = statusMap[doc.id];
                        const statusLabels: Record<string, string> = { pendente: "Pendente", em_analise: "Análise", aprovado: "Aprovado", rejeitado: "Rejeitado" };
                        const statusVariants: Record<string, "warning" | "default" | "success" | "destructive"> = { pendente: "warning", em_analise: "default", aprovado: "success", rejeitado: "destructive" };
                        return (
                          <div
                            key={doc.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-md border text-xs hover:bg-accent/30 cursor-pointer transition-colors",
                              dStatus === "aprovado" && "border-success/20 bg-success/5",
                              dStatus === "rejeitado" && "border-destructive/20 bg-destructive/5",
                            )}
                            onClick={() => onPreviewDoc(doc)}
                          >
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}</span>
                            {dStatus && (
                              <Badge variant={statusVariants[dStatus] || "secondary"} className="text-[9px]">
                                {statusLabels[dStatus] || dStatus}
                              </Badge>
                            )}
                            <Badge variant={doc.status === "aprovado" ? "success" : "secondary"} className="text-[9px]">{doc.status}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Quick actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => navigate(`/dashboard/fabrica-china/ficha/${submissao.id}`)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir Ficha
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package, FileText, Camera, AlertTriangle, CheckCircle2,
  ExternalLink, Loader2, Link2, Gavel, MessageSquare, X
} from "lucide-react";
import { useDocumentosDaSubmissao, useCoresDaSubmissao } from "@/hooks/useChinaDocumentoVinculos";
import { useDespachosPorSubmissao } from "@/hooks/useDespachoDocumentos";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES } from "@/lib/china-document-types";
import { ProcessOrchestrationPanel } from "@/components/processo/ProcessOrchestrationPanel";
import { DespachosPanel } from "@/components/processo/DespachosPanel";
import { cn } from "@/lib/utils";
import type { SubmissaoRow } from "./VincularChinaTable";
import { VincularChinaVincularTab } from "./VincularChinaVincularTab";

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

interface Props {
  submissao: SubmissaoRow;
  isLinkedToProject: boolean;
  selectedProjetoId: string | null;
  onClose: () => void;
  onPreviewDoc: (doc: any) => void;
  onDecisionClick: (submissaoId: string) => void;
  // vincular tab props
  secoes: any[];
  tarefas: any[];
  vinculos: any[];
  docVinculos: any[];
  checkedTarefas: Set<string>;
  onToggleTarefa: (id: string) => void;
  onVincular: () => void;
  onToggleDocVinculo: (docId: string, tarefaId: string) => void;
  vinculosPending: boolean;
  auditResult: any;
  auditLoading: boolean;
}

export function VincularChinaSidePanel({
  submissao, isLinkedToProject, selectedProjetoId, onClose, onPreviewDoc, onDecisionClick,
  secoes, tarefas, vinculos, docVinculos, checkedTarefas,
  onToggleTarefa, onVincular, onToggleDocVinculo, vinculosPending, auditResult, auditLoading,
}: Props) {
  const navigate = useNavigate();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { data: documentos = [], isLoading: loadingDocs } = useDocumentosDaSubmissao(submissao.id);
  const { data: despachos = [] } = useDespachosPorSubmissao(submissao.id);

  // Show brief loading state when switching submissions
  useEffect(() => {
    setIsTransitioning(true);
    const t = setTimeout(() => setIsTransitioning(false), 150);
    return () => clearTimeout(t);
  }, [submissao.id]);

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
  const sc = getStatusConfig(submissao.status);

  return (
    <div className="flex flex-col h-full border-l bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-primary">{submissao.produto_codigo}</span>
              <Badge variant={sc.variant} className="text-[10px]">{sc.label}</Badge>
            </div>
            <p className="text-sm font-semibold truncate">{submissao.produto_nome}</p>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="detalhes" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2 h-9 shrink-0">
          <TabsTrigger value="detalhes" className="text-xs h-7">Detalhes</TabsTrigger>
          {selectedProjetoId && (
            <TabsTrigger value="vincular" className="text-xs h-7 gap-1">
              <Link2 className="h-3 w-3" />Vincular
            </TabsTrigger>
          )}
          <TabsTrigger value="documentos" className="text-xs h-7 gap-1">
            <FileText className="h-3 w-3" />Docs
            {totalPendentes > 0 && <Badge variant="destructive" className="text-[8px] h-3.5 px-1 ml-0.5">{totalPendentes}</Badge>}
          </TabsTrigger>
          {isLinkedToProject && (
            <TabsTrigger value="processo" className="text-xs h-7 gap-1">
              <Gavel className="h-3 w-3" />Processo
            </TabsTrigger>
          )}
        </TabsList>

        <ScrollArea className="flex-1">
          {/* Detalhes Tab */}
          <TabsContent value="detalhes" className="m-0 p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {submissao.formula_codigo && (
                <div><span className="text-muted-foreground">Fórmula:</span> <span className="font-mono">{submissao.formula_codigo}</span></div>
              )}
              {submissao.numero_ordem && (
                <div><span className="text-muted-foreground">OC:</span> <span className="font-semibold">{submissao.numero_ordem}</span></div>
              )}
              {submissao.qty_total && (
                <div><span className="text-muted-foreground">Qtd:</span> <span className="font-semibold">{submissao.qty_total.toLocaleString()}</span></div>
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
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => navigate(`/dashboard/fabrica-china/ficha/${submissao.id}`)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir Ficha Completa
            </Button>
          </TabsContent>

          {/* Vincular Tab */}
          {selectedProjetoId && (
            <TabsContent value="vincular" className="m-0 p-4">
              <VincularChinaVincularTab
                submissaoId={submissao.id}
                secoes={secoes}
                tarefas={tarefas}
                vinculos={vinculos}
                docVinculos={docVinculos}
                documentos={documentos}
                checkedTarefas={checkedTarefas}
                onToggleTarefa={onToggleTarefa}
                onVincular={onVincular}
                onToggleDocVinculo={onToggleDocVinculo}
                vinculosPending={vinculosPending}
                auditResult={auditResult}
                auditLoading={auditLoading}
                onPreviewDoc={onPreviewDoc}
              />
            </TabsContent>
          )}

          {/* Documentos Tab */}
          <TabsContent value="documentos" className="m-0 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Documentos</span>
              <div className="flex gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{documentos.length} total</Badge>
                {totalPendentes > 0 && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-3 w-3" />{totalPendentes}
                  </Badge>
                )}
                {totalPendentes === 0 && documentos.length > 0 && (
                  <Badge className="text-[10px] bg-success/10 text-success border-success/20 border gap-1">
                    <CheckCircle2 className="h-3 w-3" />OK
                  </Badge>
                )}
              </div>
            </div>

            {loadingDocs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : documentos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(docsByCategory).map(([key, cat]) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {cat.icon}
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cat.label}</span>
                      <Badge variant="secondary" className="text-[9px] h-4">{cat.docs.length}</Badge>
                      {cat.pendentes > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 text-warning border-warning/30">{cat.pendentes}</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {cat.docs.map((doc: any) => {
                        const dStatus = statusMap[doc.id];
                        const statusVariants: Record<string, "warning" | "default" | "success" | "destructive"> = {
                          pendente: "warning", em_analise: "default", aprovado: "success", rejeitado: "destructive"
                        };
                        return (
                          <div
                            key={doc.id}
                            className={cn(
                              "flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs hover:bg-accent/30 cursor-pointer transition-colors",
                              dStatus === "aprovado" && "border-success/20 bg-success/5",
                              dStatus === "rejeitado" && "border-destructive/20 bg-destructive/5",
                            )}
                            onClick={() => onPreviewDoc(doc)}
                          >
                            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{doc.nome_arquivo || getDocTypeLabel(doc.tipo_documento)}</span>
                            {dStatus && <Badge variant={statusVariants[dStatus] || "secondary"} className="text-[9px]">{dStatus}</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Processo Tab */}
          {isLinkedToProject && (
            <TabsContent value="processo" className="m-0 p-4 space-y-4">
              <ProcessOrchestrationPanel
                submissaoId={submissao.id}
                submissaoNome={submissao.produto_nome}
                submissaoCodigo={submissao.produto_codigo}
              />
              <DespachosPanel submissaoId={submissao.id} documentos={documentos} />
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => onDecisionClick(submissao.id)}
              >
                <Gavel className="h-4 w-4" />
                Decisão Formal do Brasil
              </Button>
            </TabsContent>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  );
}

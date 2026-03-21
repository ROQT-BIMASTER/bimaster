import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Video,
  Shield,
  Pen,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  AlertCircle,
  Gavel,
  BarChart3,
} from "lucide-react";
import {
  DOCUMENT_CATEGORIES,
  CHINA_DOCUMENT_TYPES,
  CATEGORIES_CHINA_ENVIA,
  CATEGORIES_BRASIL_ENVIA,
  STATUS_LABELS,
} from "@/lib/china-document-types";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Revisao } from "@/hooks/useChinaRevisoes";

interface Props {
  submissaoId: string;
  produtoNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RESULTADO_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string; badgeVariant: string }> = {
  aprovado: { label: "Aprovado", icon: CheckCircle2, color: "text-success", badgeVariant: "success" },
  rejeitado: { label: "Rejeitado", icon: XCircle, color: "text-destructive", badgeVariant: "destructive" },
  contestado: { label: "Contestado", icon: AlertCircle, color: "text-warning", badgeVariant: "warning" },
  ciencia: { label: "Ciência", icon: CheckCircle2, color: "text-primary", badgeVariant: "default" },
};

export function CofreSubmissaoDialog({ submissaoId, produtoNome, open, onOpenChange }: Props) {
  const [tab, setTab] = useState("documentos");

  const { data: documentos = [] } = useQuery({
    queryKey: ["cofre-submissao-docs", submissaoId],
    enabled: !!submissaoId && open,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_produto_documentos" as any)
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("created_at", { ascending: true }) as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: revisoes = [] } = useQuery({
    queryKey: ["cofre-revisoes", submissaoId],
    enabled: !!submissaoId && open,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_doc_revisoes" as any)
        .select("*")
        .eq("submissao_id", submissaoId)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as unknown as Revisao[];
    },
  });

  // Group revisões by category (via documento_id → tipo_documento → category)
  const docMap = useMemo(() => {
    const map = new Map<string, any>();
    documentos.forEach((d: any) => map.set(d.id, d));
    return map;
  }, [documentos]);

  const revisoesByCategory = useMemo(() => {
    const grouped: Record<string, { category: typeof DOCUMENT_CATEGORIES[0]; revisoes: (Revisao & { doc?: any })[] }> = {};

    for (const rev of revisoes) {
      const doc = docMap.get(rev.documento_id);
      const tipo = doc?.tipo_documento || "";
      let catKey = "_outros";
      for (const cat of DOCUMENT_CATEGORIES) {
        if (cat.tipos.includes(tipo)) { catKey = cat.key; break; }
      }
      if (!grouped[catKey]) {
        const cat = DOCUMENT_CATEGORIES.find(c => c.key === catKey) || { key: "_outros", labelPt: "Outros", labelCn: "其他", tipos: [], fluxo: "china_envia" as const };
        grouped[catKey] = { category: cat, revisoes: [] };
      }
      grouped[catKey].revisoes.push({ ...rev, doc });
    }
    return grouped;
  }, [revisoes, docMap]);

  // Process finalization stats
  const stats = useMemo(() => {
    const total = documentos.length;
    const aprovados = documentos.filter((d: any) => d.status === "aprovado").length;
    const rejeitados = documentos.filter((d: any) => d.status === "rejeitado").length;
    const pendentes = documentos.filter((d: any) => ["pendente", "enviado", "em_revisao"].includes(d.status)).length;
    const contestados = documentos.filter((d: any) => d.status === "contestado").length;
    const ciencia = documentos.filter((d: any) => d.status === "ciencia").length;
    const pct = total > 0 ? Math.round(((aprovados + ciencia) / total) * 100) : 0;
    return { total, aprovados, rejeitados, pendentes, contestados, ciencia, pct };
  }, [documentos]);

  const handleViewDoc = async (path: string) => {
    if (!path) { toast.error("Arquivo não disponível"); return; }
    const { signedUrl } = await getSignedUrl("china-documentos", path);
    if (signedUrl) window.open(signedUrl, "_blank");
    else toast.error("Erro ao abrir arquivo");
  };

  const getFileIcon = (tipo: string) => {
    if (tipo.startsWith("foto_") || tipo.includes("amostra_foto") || tipo.includes("imagem")) return <ImageIcon className="h-4 w-4 text-primary" />;
    if (tipo.includes("video")) return <Video className="h-4 w-4 text-warning" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const flows = [
    { categories: CATEGORIES_CHINA_ENVIA, label: "China → Brasil", icon: <ArrowUpRight className="h-4 w-4" />, color: "text-primary" },
    { categories: CATEGORIES_BRASIL_ENVIA, label: "Brasil → China", icon: <ArrowDownLeft className="h-4 w-4" />, color: "text-success" },
  ];

  const totalDocs = documentos.length;
  const aprovados = documentos.filter((d: any) => d.status === "aprovado").length;
  const assinados = documentos.filter((d: any) => d.assinado_por).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Cofre de Documentos 文件保险箱 — {produtoNome}
          </DialogTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <span>{totalDocs} documentos</span>
            <span>•</span>
            <span className="text-success">{aprovados} aprovados</span>
            {assinados > 0 && (
              <>
                <span>•</span>
                <span className="text-primary">{assinados} assinados</span>
              </>
            )}
            <span>•</span>
            <span>{revisoes.length} pareceres registrados</span>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="documentos" className="flex-1 gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Documentos
            </TabsTrigger>
            <TabsTrigger value="aprovacoes" className="flex-1 gap-1.5">
              <Gavel className="h-3.5 w-3.5" />
              Aprovações Brasil
              {revisoes.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-1">{revisoes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="finalizacao" className="flex-1 gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Finalização
            </TabsTrigger>
          </TabsList>

          {/* Tab: Documentos (original) */}
          <TabsContent value="documentos">
            <ScrollArea className="max-h-[55vh] pr-2">
              <div className="space-y-6">
                {flows.map(({ categories, label, icon, color }) => {
                  const grouped = categories
                    .map((cat) => ({
                      ...cat,
                      docs: documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento)),
                    }))
                    .filter((g) => g.docs.length > 0);

                  if (grouped.length === 0) return null;

                  return (
                    <div key={label}>
                      <div className={`flex items-center gap-2 mb-3 ${color} font-semibold text-sm`}>
                        {icon}
                        <span>{label}</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">
                          {grouped.reduce((s, g) => s + g.docs.length, 0)} docs
                        </Badge>
                      </div>
                      <div className="space-y-4">
                        {grouped.map((cat) => (
                          <div key={cat.key}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">
                              {cat.labelPt}
                            </p>
                            <div className="space-y-1">
                              {cat.docs.map((doc: any) => {
                                const tipoConfig = CHINA_DOCUMENT_TYPES.find((t) => t.tipo === doc.tipo_documento);
                                const statusInfo = STATUS_LABELS[doc.status] || { pt: doc.status, variant: "secondary" };
                                return (
                                  <div key={doc.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                                    {getFileIcon(doc.tipo_documento)}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{tipoConfig?.labelPt || doc.tipo_documento}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">
                                        {doc.nome_arquivo || "—"}
                                        {doc.created_at && <span className="ml-2">{format(new Date(doc.created_at), "dd/MM/yy")}</span>}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Badge variant={statusInfo.variant as any} className="text-[10px] px-1.5">{statusInfo.pt}</Badge>
                                      {doc.oficializado && (
                                        <Badge variant="default" className="text-[10px] gap-0.5 px-1.5"><Shield className="h-2.5 w-2.5" /> Oficial</Badge>
                                      )}
                                      {doc.assinado_por && (
                                        <Badge variant="success" className="text-[10px] gap-0.5 px-1.5"><Pen className="h-2.5 w-2.5" /> {doc.assinatura_nome || "Assinado"}</Badge>
                                      )}
                                    </div>
                                    {doc.arquivo_path && (
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewDoc(doc.arquivo_path)}>
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {totalDocs === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhum documento encontrado nesta submissão.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tab: Aprovações Brasil */}
          <TabsContent value="aprovacoes">
            <ScrollArea className="max-h-[55vh] pr-2">
              {revisoes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Gavel className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhum parecer registrado pelo Brasil.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(revisoesByCategory).map(([catKey, { category, revisoes: catRevisoes }]) => (
                    <div key={catKey}>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {category.labelPt}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{category.labelCn}</span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-auto">{catRevisoes.length}</Badge>
                      </div>

                      <div className="space-y-1.5 ml-1">
                        {catRevisoes.map((rev) => {
                          const config = RESULTADO_CONFIG[rev.resultado] || RESULTADO_CONFIG.aprovado;
                          const Icon = config.icon;
                          const tipoConfig = CHINA_DOCUMENT_TYPES.find((t) => t.tipo === rev.doc?.tipo_documento);

                          return (
                            <div
                              key={rev.id}
                              className={cn(
                                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                                rev.resultado === "aprovado" && "bg-success/5 border-success/20",
                                rev.resultado === "rejeitado" && "bg-destructive/5 border-destructive/20",
                                rev.resultado === "contestado" && "bg-warning/5 border-warning/20",
                                rev.resultado === "ciencia" && "bg-primary/5 border-primary/20",
                              )}
                            >
                              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.color)} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground truncate">
                                    {tipoConfig?.labelPt || rev.doc?.tipo_documento || "Documento"}
                                  </span>
                                  <Badge variant={config.badgeVariant as any} className="text-[9px] shrink-0">
                                    {config.label}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    Rodada {rev.rodada}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {rev.acao_por_nome && <span className="font-medium">{rev.acao_por_nome}</span>}
                                  {rev.created_at && <span className="ml-2">{format(new Date(rev.created_at), "dd/MM/yy HH:mm")}</span>}
                                </p>
                                {rev.motivo_rejeicao && (
                                  <p className="text-xs text-destructive mt-1 bg-destructive/5 px-2 py-1 rounded">
                                    {rev.motivo_rejeicao}
                                  </p>
                                )}
                                {rev.contestacao_texto && (
                                  <p className="text-xs text-warning mt-1 bg-warning/5 px-2 py-1 rounded">
                                    Contestação: {rev.contestacao_texto}
                                  </p>
                                )}
                                {rev.anotacoes && (rev.anotacoes as any[]).length > 0 && (
                                  <div className="mt-1.5 space-y-0.5">
                                    {(rev.anotacoes as any[]).map((a: any, i: number) => (
                                      <p key={i} className="text-[10px] text-muted-foreground">
                                        <span className="font-medium">{a.tipo}:</span> {a.descricao}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Tab: Finalização Processual */}
          <TabsContent value="finalizacao">
            <ScrollArea className="max-h-[55vh] pr-2">
              <div className="space-y-6">
                {/* Progress overview */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl border bg-success/5 text-center">
                    <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
                    <p className="text-2xl font-bold text-success">{stats.aprovados}</p>
                    <p className="text-[10px] text-muted-foreground">Aprovados</p>
                  </div>
                  <div className="p-4 rounded-xl border bg-destructive/5 text-center">
                    <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
                    <p className="text-2xl font-bold text-destructive">{stats.rejeitados}</p>
                    <p className="text-[10px] text-muted-foreground">Rejeitados</p>
                  </div>
                  <div className="p-4 rounded-xl border bg-warning/5 text-center">
                    <Clock className="h-5 w-5 text-warning mx-auto mb-1" />
                    <p className="text-2xl font-bold text-warning">{stats.pendentes}</p>
                    <p className="text-[10px] text-muted-foreground">Pendentes</p>
                  </div>
                </div>

                {/* Overall progress bar */}
                <div className="p-4 rounded-xl border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progresso Geral</span>
                    <span className="text-sm font-bold text-primary">{stats.pct}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-success to-success/80 rounded-full transition-all duration-500"
                      style={{ width: `${stats.pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {stats.aprovados + stats.ciencia} de {stats.total} documentos finalizados
                  </p>
                </div>

                {/* Per-category status */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Status por Categoria do Checklist
                  </h4>
                  <div className="space-y-2">
                    {DOCUMENT_CATEGORIES.map((cat) => {
                      const catDocs = documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento));
                      if (catDocs.length === 0) return null;
                      const catAprovados = catDocs.filter((d: any) => ["aprovado", "ciencia"].includes(d.status)).length;
                      const catRejeitados = catDocs.filter((d: any) => d.status === "rejeitado").length;
                      const catPct = Math.round((catAprovados / catDocs.length) * 100);
                      const isComplete = catAprovados === catDocs.length;

                      return (
                        <div key={cat.key} className={cn(
                          "p-3 rounded-lg border transition-colors",
                          isComplete ? "bg-success/5 border-success/20" : "bg-card"
                        )}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              {isComplete ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className="text-xs font-medium">{cat.labelPt}</span>
                              <span className="text-[10px] text-muted-foreground">{cat.labelCn}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-foreground">{catAprovados}/{catDocs.length}</span>
                              {catRejeitados > 0 && (
                                <Badge variant="destructive" className="text-[8px] h-3.5 px-1">{catRejeitados} rej.</Badge>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isComplete ? "bg-success" : "bg-primary"
                              )}
                              style={{ width: `${catPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Contestações summary */}
                {stats.contestados > 0 && (
                  <div className="p-4 rounded-xl border border-warning/30 bg-warning/5">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-warning" />
                      <span className="text-sm font-medium text-warning">{stats.contestados} Contestação(ões) Ativa(s)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Documentos contestados pela China aguardando reanálise do Brasil.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

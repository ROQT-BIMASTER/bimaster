import { useState } from "react";
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
import {
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Video,
  Download,
  Shield,
  Pen,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
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

interface Props {
  submissaoId: string;
  produtoNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CofreSubmissaoDialog({ submissaoId, produtoNome, open, onOpenChange }: Props) {
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

  const handleViewDoc = async (path: string) => {
    if (!path) {
      toast.error("Arquivo não disponível");
      return;
    }
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
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Cofre de Documentos — {produtoNome}
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
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-2">
          <div className="space-y-6">
            {flows.map(({ categories, label, icon, color }) => {
              const flowDocs = categories.flatMap((cat) => {
                const catDocs = documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento));
                return catDocs.map((d: any) => ({ ...d, categoryLabel: cat.labelPt }));
              });

              if (flowDocs.length === 0) return null;

              // Group by category
              const grouped = categories
                .map((cat) => ({
                  ...cat,
                  docs: documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento)),
                }))
                .filter((g) => g.docs.length > 0);

              return (
                <div key={label}>
                  <div className={`flex items-center gap-2 mb-3 ${color} font-semibold text-sm`}>
                    {icon}
                    <span>{label}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {flowDocs.length} docs
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
                            const tipoConfig = CHINA_DOCUMENT_TYPES.find(
                              (t) => t.tipo === doc.tipo_documento
                            );
                            const statusInfo = STATUS_LABELS[doc.status] || { pt: doc.status, variant: "secondary" };

                            return (
                              <div
                                key={doc.id}
                                className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                              >
                                {getFileIcon(doc.tipo_documento)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {tipoConfig?.labelPt || doc.tipo_documento}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {doc.nome_arquivo || "—"}
                                    {doc.created_at && (
                                      <span className="ml-2">
                                        {format(new Date(doc.created_at), "dd/MM/yy")}
                                      </span>
                                    )}
                                  </p>
                                </div>

                                {/* Badges */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <Badge variant={statusInfo.variant as any} className="text-[10px] px-1.5">
                                    {statusInfo.pt}
                                  </Badge>
                                  {doc.oficializado && (
                                    <Badge variant="default" className="text-[10px] gap-0.5 px-1.5">
                                      <Shield className="h-2.5 w-2.5" /> Oficial
                                    </Badge>
                                  )}
                                  {doc.assinado_por && (
                                    <Badge variant="success" className="text-[10px] gap-0.5 px-1.5">
                                      <Pen className="h-2.5 w-2.5" /> {doc.assinatura_nome || "Assinado"}
                                    </Badge>
                                  )}
                                </div>

                                {/* View button */}
                                {doc.arquivo_path && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleViewDoc(doc.arquivo_path)}
                                  >
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
      </DialogContent>
    </Dialog>
  );
}

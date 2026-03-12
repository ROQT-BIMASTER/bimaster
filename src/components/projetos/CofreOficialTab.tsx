import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logDocAudit } from "@/lib/productDocAudit";
import { useAuth } from "@/contexts/AuthContext";
import { useProjetoMembros } from "@/hooks/useProjetoMembros";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ShieldCheck, Download, FileText, Image, File, Lock, XCircle } from "lucide-react";
import { toast } from "sonner";

function getFileIcon(tipo: string | null) {
  if (!tipo) return <File className="h-4 w-4" />;
  if (tipo.startsWith("image/")) return <Image className="h-4 w-4 text-blue-400" />;
  if (tipo.includes("pdf")) return <FileText className="h-4 w-4 text-red-400" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

interface CofreOficialTabProps {
  produtoId: string;
  projetoId?: string;
  isReadOnly?: boolean;
}

export function CofreOficialTab({ produtoId, projetoId, isReadOnly }: CofreOficialTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { currentUserPapel } = useProjetoMembros(projetoId);
  const isAdminCofre = currentUserPapel === "admin_cofre" || currentUserPapel === "coordenador";
  const [revokeDoc, setRevokeDoc] = useState<any>(null);

  const { data: cofreDocs = [] } = useQuery({
    queryKey: ["cofre-oficial", produtoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fabrica_revisao_documentos" as any)
        .select("*")
        .eq("produto_id", produtoId)
        .eq("visivel_fabrica", true)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!produtoId,
  });

  const { data: oficialVersions = [] } = useQuery({
    queryKey: ["cofre-oficial-versions", produtoId],
    queryFn: async () => {
      const docIds = cofreDocs.map((d: any) => d.id);
      if (docIds.length === 0) return [];
      const { data } = await supabase
        .from("produto_documento_versoes" as any)
        .select("documento_id")
        .in("documento_id", docIds)
        .eq("versao_oficial", true);
      return (data || []).map((v: any) => v.documento_id) as string[];
    },
    enabled: cofreDocs.length > 0,
  });

  const revokeFromCofre = useMutation({
    mutationFn: async (docId: string) => {
      await supabase
        .from("fabrica_revisao_documentos" as any)
        .update({ visivel_fabrica: false } as any)
        .eq("id", docId);
      await logDocAudit({
        documentoId: docId,
        produtoId,
        projetoId,
        acao: "rejeicao",
        detalhes: { action: "revoke_from_cofre", revoked_by: user?.id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cofre-oficial", produtoId] });
      toast.success("Documento revogado do Cofre.");
      setRevokeDoc(null);
    },
    onError: () => toast.error("Erro ao revogar documento."),
  });

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage
      .from("projeto-anexos")
      .createSignedUrl(doc.arquivo_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
      await logDocAudit({
        documentoId: doc.id,
        produtoId,
        projetoId,
        acao: "download",
        detalhes: { nome_arquivo: doc.nome_arquivo },
      });
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
        <Lock className="h-4 w-4 text-primary" />
        <div>
          <p className="text-xs font-medium">Cofre de Documentos Oficiais</p>
          <p className="text-[10px] text-muted-foreground">
            Apenas documentos aprovados e publicados aparecem aqui.
          </p>
        </div>
      </div>

      {cofreDocs.length === 0 ? (
        <div className="text-center py-8">
          <ShieldCheck className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">Nenhum documento oficial publicado.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-2">
            {cofreDocs.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-2 p-2.5 rounded-md bg-muted/30 border border-border/30">
                {getFileIcon(doc.tipo_arquivo)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.nome_arquivo}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {doc.categoria && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{doc.categoria}</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(doc.created_at), "dd/MM/yy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                {oficialVersions.includes(doc.id) ? (
                  <Badge variant="default" className="text-[9px] gap-1 bg-emerald-600">
                    <ShieldCheck className="h-2.5 w-2.5" /> OFICIAL
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px] gap-1">
                    <ShieldCheck className="h-2.5 w-2.5" /> VISÍVEL
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {/* Revoke from Cofre - admin_cofre only */}
                {isAdminCofre && !isReadOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setRevokeDoc(doc)}
                    title="Revogar do Cofre"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Revoke Confirmation */}
      <AlertDialog open={!!revokeDoc} onOpenChange={() => setRevokeDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar documento do Cofre?</AlertDialogTitle>
            <AlertDialogDescription>
              O documento "{revokeDoc?.nome_arquivo}" deixará de ser visível para a Fábrica.
              Esta ação será registrada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => revokeDoc && revokeFromCofre.mutate(revokeDoc.id)}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

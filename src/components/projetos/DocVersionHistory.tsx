import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logDocAudit } from "@/lib/productDocAudit";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Check, Star, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DocVersionHistoryProps {
  documentoId: string;
  canMarkOfficial?: boolean;
}

export function DocVersionHistory({ documentoId, canMarkOfficial }: DocVersionHistoryProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{ type: "approve" | "official"; versaoId: string; versao: number } | null>(null);

  const { data: versoes = [] } = useQuery({
    queryKey: ["doc_versoes", documentoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("produto_documento_versoes" as any)
        .select("*")
        .eq("documento_id", documentoId)
        .order("versao", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!documentoId,
  });

  const approveVersion = useMutation({
    mutationFn: async (versaoId: string) => {
      await supabase
        .from("produto_documento_versoes" as any)
        .update({ status: "aprovado", aprovado_por: user!.id, aprovado_em: new Date().toISOString() } as any)
        .eq("id", versaoId);

      await logDocAudit({
        documentoId,
        versaoId,
        acao: "aprovacao",
        detalhes: { approved_by: user!.id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc_versoes", documentoId] });
      toast.success("Versão aprovada!");
      setConfirmAction(null);
    },
  });

  const markOfficial = useMutation({
    mutationFn: async (versaoId: string) => {
      await supabase
        .from("produto_documento_versoes" as any)
        .update({ versao_oficial: false } as any)
        .eq("documento_id", documentoId);
      await supabase
        .from("produto_documento_versoes" as any)
        .update({ versao_oficial: true, aprovado_por: user!.id, aprovado_em: new Date().toISOString(), status: "aprovado" } as any)
        .eq("id", versaoId);

      await logDocAudit({
        documentoId,
        versaoId,
        acao: "versao_oficial",
        detalhes: { marked_by: user!.id },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc_versoes", documentoId] });
      toast.success("Versão oficial marcada!");
      setConfirmAction(null);
    },
  });

  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "approve") approveVersion.mutate(confirmAction.versaoId);
    else markOfficial.mutate(confirmAction.versaoId);
  };

  if (versoes.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">Nenhuma versão registrada.</p>;
  }

  return (
    <>
      <ScrollArea className="max-h-48">
        <div className="space-y-1.5">
          {versoes.map((v: any) => (
            <div
              key={v.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md text-xs border",
                v.versao_oficial ? "border-primary/30 bg-primary/5" : "border-border/30 bg-muted/20"
              )}
            >
              <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">v{v.versao}</span>
                {v.versao_oficial && (
                  <Badge variant="default" className="ml-1.5 text-[9px] px-1.5 py-0">
                    <Star className="h-2.5 w-2.5 mr-0.5" /> OFICIAL
                  </Badge>
                )}
                <p className="text-muted-foreground truncate">
                  {format(new Date(v.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </p>
              </div>
              <Badge variant={v.status === "aprovado" ? "success" : v.status === "rejeitado" ? "destructive" : "secondary"} className="text-[9px]">
                {v.status}
              </Badge>
              {/* CRITICAL FIX: Approve version button for drafts */}
              {canMarkOfficial && v.status === "rascunho" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] gap-1 px-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                  onClick={() => setConfirmAction({ type: "approve", versaoId: v.id, versao: v.versao })}
                >
                  <ThumbsUp className="h-3 w-3" /> Aprovar
                </Button>
              )}
              {canMarkOfficial && !v.versao_oficial && v.status === "aprovado" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setConfirmAction({ type: "official", versaoId: v.id, versao: v.versao })}
                >
                  <Star className="h-3 w-3" /> Oficial
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "approve" ? "Aprovar versão?" : "Marcar como oficial?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "approve"
                ? `Confirma a aprovação da versão v${confirmAction?.versao}? Após aprovada, ela poderá ser marcada como oficial.`
                : `Confirma que a versão v${confirmAction?.versao} será a versão oficial deste documento? As demais versões perderão o status de oficial.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              {confirmAction?.type === "approve" ? "Aprovar" : "Marcar Oficial"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

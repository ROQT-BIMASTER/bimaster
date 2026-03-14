import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, FileText, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";

const MANDATORY_DOCS = ["foto_amostra", "video_amostra"];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "success" | "destructive" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  pendente: { label: "Pendente", variant: "warning" },
  em_revisao: { label: "Em Revisão", variant: "default" },
  aprovado: { label: "Aprovado", variant: "success" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
  arte_enviada: { label: "Docs Enviados", variant: "default" },
};

interface Props {
  produto: ProdutoBrasil;
}

export function AprovacaoSubmissaoChina({ produto }: Props) {
  const [motivo, setMotivo] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const queryClient = useQueryClient();

  const submissaoId = produto.submissao_china_id;

  // Fetch submissão
  const { data: submissao } = useQuery({
    queryKey: ["china-submissao-aprovacao", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_submissoes")
        .select("*")
        .eq("id", submissaoId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch documentos
  const { data: documentos = [] } = useQuery({
    queryKey: ["china-docs-aprovacao", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_documentos")
        .select("*")
        .eq("submissao_id", submissaoId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Mutation para atualizar status da submissão
  const updateStatus = useMutation({
    mutationFn: async ({ status, obs }: { status: string; obs?: string }) => {
      const updates: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (obs) updates.observacoes_brasil = obs;

      const { error } = await supabase
        .from("china_produto_submissoes")
        .update(updates)
        .eq("id", submissaoId!);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["china-submissao-aprovacao", submissaoId] });
      queryClient.invalidateQueries({ queryKey: ["produto-brasil", produto.id] });
      if (vars.status === "aprovado") {
        toast.success("Submissão aprovada com sucesso!");
      } else {
        toast.success("Submissão rejeitada. A China será notificada.");
      }
      setShowRejectForm(false);
      setMotivo("");
    },
    onError: () => {
      toast.error("Erro ao atualizar status da submissão.");
    },
  });

  if (!submissaoId || !submissao) return null;

  const statusInfo = STATUS_MAP[submissao.status] || { label: submissao.status, variant: "secondary" as const };
  const canApprove = ["pendente", "em_revisao"].includes(submissao.status);

  // Document progress
  const totalDocs = documentos.length;
  const docsAprovados = documentos.filter((d: any) => d.status === "aprovado").length;
  const docsPendentes = documentos.filter((d: any) => d.status === "pendente").length;
  const docsProgress = totalDocs > 0 ? Math.round((docsAprovados / totalDocs) * 100) : 0;

  // Mandatory docs check
  const hasMandatoryDocs = MANDATORY_DOCS.every(tipo =>
    documentos.some((d: any) => d.tipo_documento === tipo)
  );

  const handleApprove = () => {
    if (!hasMandatoryDocs) {
      toast.error("Documentos obrigatórios ausentes: foto e vídeo da amostra.");
      return;
    }
    updateStatus.mutate({ status: "aprovado" });
  };

  const handleReject = () => {
    if (!motivo.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }
    updateStatus.mutate({ status: "rejeitado", obs: motivo.trim() });
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Aprovação da Submissão China
          </CardTitle>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Produto:</span>{" "}
            <span className="font-medium">{submissao.produto_nome}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Código:</span>{" "}
            <span className="font-medium">{submissao.produto_codigo}</span>
          </div>
        </div>

        {/* Document progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Documentos
            </span>
            <span className="font-medium">
              {docsAprovados}/{totalDocs} aprovados
              {docsPendentes > 0 && (
                <span className="text-warning ml-1">({docsPendentes} pendentes)</span>
              )}
            </span>
          </div>
          <Progress value={docsProgress} className="h-2" />
        </div>

        {/* Mandatory docs warning */}
        {!hasMandatoryDocs && canApprove && (
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <span className="text-warning-foreground">
              Foto e vídeo da amostra são obrigatórios para aprovação.
            </span>
          </div>
        )}

        {/* Previous rejection reason */}
        {submissao.status === "rejeitado" && submissao.observacoes_brasil && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
            <p className="font-medium text-destructive mb-1">Motivo da rejeição:</p>
            <p className="text-muted-foreground">{submissao.observacoes_brasil}</p>
          </div>
        )}

        {/* Approval actions */}
        {canApprove && (
          <div className="space-y-3 pt-2">
            {showRejectForm ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Descreva o motivo da rejeição para a equipe China..."
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={updateStatus.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Confirmar Rejeição
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setShowRejectForm(false); setMotivo(""); }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="success"
                  onClick={handleApprove}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar Submissão
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowRejectForm(true)}
                  disabled={updateStatus.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Approved state */}
        {submissao.status === "aprovado" && (
          <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            Submissão aprovada pelo Brasil.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

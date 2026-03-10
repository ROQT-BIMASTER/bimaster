import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Eye, CheckCircle2, XCircle, Clock, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { ChinaExcelPreview } from "@/components/china/ChinaExcelPreview";
import { CHINA_DOCUMENT_TYPES, STATUS_LABELS } from "@/lib/china-document-types";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ChinaRecebimentos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [obsDialog, setObsDialog] = useState<{ docId: string; obs: string } | null>(null);

  const { data: submissoes = [], isLoading } = useQuery({
    queryKey: ["china-submissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_submissoes" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ["china-docs", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_documentos" as any)
        .select("*")
        .eq("submissao_id", selectedId);
      return (data || []) as any[];
    },
  });

  const { data: cores = [] } = useQuery({
    queryKey: ["china-cores", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_cores" as any)
        .select("*")
        .eq("submissao_id", selectedId);
      return (data || []) as any[];
    },
  });

  const updateDocStatus = useMutation({
    mutationFn: async ({ docId, status, observacao }: { docId: string; status: string; observacao?: string }) => {
      await supabase
        .from("china_produto_documentos" as any)
        .update({ status, observacao: observacao || null } as any)
        .eq("id", docId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["china-docs", selectedId] });
      toast.success("Status atualizado! 状态已更新！");
    },
  });

  const updateSubStatus = useMutation({
    mutationFn: async ({ id, status, obs }: { id: string; status: string; obs?: string }) => {
      await supabase
        .from("china_produto_submissoes" as any)
        .update({
          status,
          observacoes_brasil: obs || null,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        } as any)
        .eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["china-submissoes"] });
      toast.success("Submissão atualizada! 提交已更新！");
    },
  });

  const selected = submissoes.find((s: any) => s.id === selectedId);

  const handleViewDoc = async (doc: any) => {
    if (doc.arquivo_path) {
      const { signedUrl } = await getSignedUrl("china-documentos", doc.arquivo_path);
      if (signedUrl) window.open(signedUrl, "_blank");
    } else if (doc.arquivo_url) {
      window.open(doc.arquivo_url, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica-china")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BilingualLabel pt="Recebimentos / Submissões" cn="接收 / 提交" size="lg" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-1 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : submissoes.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <BilingualLabel pt="Nenhuma submissão" cn="没有提交" size="md" className="items-center" />
              </Card>
            ) : (
              submissoes.map((sub: any) => {
                const statusInfo = STATUS_LABELS[sub.status] || STATUS_LABELS.rascunho;
                return (
                  <Card
                    key={sub.id}
                    className={`p-4 cursor-pointer transition-all ${selectedId === sub.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                    onClick={() => setSelectedId(sub.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-foreground truncate">{sub.produto_codigo}</p>
                        <p className="text-sm text-muted-foreground truncate">{sub.produto_nome}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(sub.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Badge variant={statusInfo.variant} className="shrink-0 text-[10px]">
                        {statusInfo.pt} {statusInfo.cn}
                      </Badge>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <Card className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{selected.produto_codigo}</h2>
                    <p className="text-muted-foreground">{selected.produto_nome}</p>
                  </div>
                  <div className="flex gap-2">
                    {selected.status !== "aprovado" && (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => updateSubStatus.mutate({ id: selected.id, status: "aprovado" })}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar 批准
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateSubStatus.mutate({ id: selected.id, status: "rejeitado" })}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Rejeitar 拒绝
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Excel Data */}
                {selected.dados_excel && (
                  <ChinaExcelPreview
                    data={{
                      ...selected.dados_excel,
                      cores: cores.map((c: any) => ({ grupo: c.grupo, cor_nome: c.cor_nome, quantidade: c.quantidade })),
                    }}
                  />
                )}

                {/* Weights */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-secondary/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Bruto 毛重</p>
                    <p className="text-lg font-bold">{selected.peso_bruto_g ? `${selected.peso_bruto_g}g` : "—"}</p>
                  </div>
                  <div className="p-3 bg-secondary/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Líquido 净重</p>
                    <p className="text-lg font-bold">{selected.peso_liquido_g ? `${selected.peso_liquido_g}g` : "—"}</p>
                  </div>
                  <div className="p-3 bg-secondary/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">Tester 试用</p>
                    <p className="text-lg font-bold">{selected.peso_tester_g ? `${selected.peso_tester_g}g` : "—"}</p>
                  </div>
                </div>

                {/* Documents Grid */}
                <div>
                  <BilingualLabel pt="Documentos" cn="文件" size="md" className="mb-3" />
                  <div className="space-y-2">
                    {CHINA_DOCUMENT_TYPES.map((config) => {
                      const doc = documentos.find((d: any) => d.tipo_documento === config.tipo);
                      return (
                        <div key={config.tipo} className="flex items-center gap-3 p-3 bg-card border rounded-lg">
                          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <BilingualLabel pt={config.labelPt} cn={config.labelCn} size="sm" />
                            {doc?.nome_arquivo && (
                              <p className="text-xs text-muted-foreground truncate">{doc.nome_arquivo}</p>
                            )}
                          </div>
                          {doc ? (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleViewDoc(doc)}>
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => updateDocStatus.mutate({ docId: doc.id, status: "aprovado" })}
                                className="text-success"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setObsDialog({ docId: doc.id, obs: "" })}
                                className="text-destructive"
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                              <Badge variant={doc.status === "aprovado" ? "success" : doc.status === "rejeitado" ? "destructive" : "warning"} className="text-[10px]">
                                {doc.status === "aprovado" ? "✓" : doc.status === "rejeitado" ? "✗" : "●"}
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              <Clock className="h-3 w-3 mr-1" /> Aguardando 待上传
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Observations */}
                {selected.observacoes_china && (
                  <div className="p-3 bg-warning/10 rounded-lg">
                    <p className="text-xs font-medium text-warning">Observações China 中国备注:</p>
                    <p className="text-sm">{selected.observacoes_china}</p>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-12 flex flex-col items-center justify-center text-center">
                <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <BilingualLabel pt="Selecione uma submissão" cn="选择一个提交" size="lg" className="items-center" />
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!obsDialog} onOpenChange={() => setObsDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da Rejeição 拒绝原因</DialogTitle>
          </DialogHeader>
          <Textarea
            value={obsDialog?.obs || ""}
            onChange={(e) => setObsDialog(prev => prev ? { ...prev, obs: e.target.value } : null)}
            placeholder="Descreva o motivo... 描述原因..."
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setObsDialog(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (obsDialog) {
                  updateDocStatus.mutate({
                    docId: obsDialog.docId,
                    status: "rejeitado",
                    observacao: obsDialog.obs,
                  });
                  setObsDialog(null);
                }
              }}
            >
              Rejeitar 拒绝
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

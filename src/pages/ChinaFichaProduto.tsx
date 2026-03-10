import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Package, Eye, CheckCircle2, XCircle, Clock, Loader2,
  ShoppingCart, Upload, Barcode, Send, Download, FileText, TrendingUp,
  FolderOpen, Briefcase, ExternalLink
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { ChinaGradeView } from "@/components/china/ChinaGradeView";
import { ChinaDocumentSlot } from "@/components/china/ChinaDocumentSlot";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES, MANDATORY_DOCS, STATUS_LABELS } from "@/lib/china-document-types";
import { EmitirOCDialog } from "@/components/china/EmitirOCDialog";
import { useChinaProjetosVinculados, useCriarProjetoChina } from "@/hooks/useChinaProjeto";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSignedUrl, uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ChinaFichaProduto() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [obsDialog, setObsDialog] = useState<{ docId: string; obs: string } | null>(null);
  const [ocDialogOpen, setOcDialogOpen] = useState(false);
  const [eanCaixaMaster, setEanCaixaMaster] = useState("");
  const [arteFile, setArteFile] = useState<File | null>(null);
  const [sendingArte, setSendingArte] = useState(false);

  // Fetch submission
  const { data: submissao, isLoading } = useQuery({
    queryKey: ["china-ficha", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_submissoes" as any)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  // Fetch documents
  const { data: documentos = [] } = useQuery({
    queryKey: ["china-ficha-docs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_documentos" as any)
        .select("*")
        .eq("submissao_id", id);
      return (data || []) as any[];
    },
  });

  // Fetch colors/grade
  const { data: cores = [] } = useQuery({
    queryKey: ["china-ficha-cores", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_cores" as any)
        .select("*")
        .eq("submissao_id", id)
        .order("ordem", { ascending: true });
      return (data || []) as any[];
    },
  });

  // Fetch OCs
  const { data: ordens = [] } = useQuery({
    queryKey: ["china-ficha-ocs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_ordens_compra" as any)
        .select("*")
        .eq("submissao_id", id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  // Fetch apontamentos for OCs
  const { data: apontamentos = [] } = useQuery({
    queryKey: ["china-ficha-apontamentos", ordens.map((o: any) => o.id)],
    enabled: ordens.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_producao_apontamentos" as any)
        .select("*")
        .in("ordem_compra_id", ordens.map((o: any) => o.id));
      return (data || []) as any[];
    },
  });

  // Mutations
  const updateDocStatus = useMutation({
    mutationFn: async ({ docId, status, observacao }: { docId: string; status: string; observacao?: string }) => {
      await supabase
        .from("china_produto_documentos" as any)
        .update({ status, observacao: observacao || null } as any)
        .eq("id", docId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", id] });
      toast.success("Status atualizado! 状态已更新！");
    },
  });

  const updateSubStatus = useMutation({
    mutationFn: async ({ status, obs }: { status: string; obs?: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["china-ficha", id] });
      toast.success("Submissão atualizada! 提交已更新！");
    },
  });

  const handleViewDoc = async (doc: any) => {
    if (doc.arquivo_path) {
      const { signedUrl } = await getSignedUrl("china-documentos", doc.arquivo_path);
      if (signedUrl) window.open(signedUrl, "_blank");
    } else if (doc.arquivo_url) {
      window.open(doc.arquivo_url, "_blank");
    }
  };

  const handleDocUpload = async (tipo: string, file: File) => {
    if (!id) return;
    const path = `${id}/${tipo}/${file.name}`;
    const { signedUrl, error } = await uploadAndGetSignedUrl("china-documentos", path, file);
    if (error) {
      toast.error("Erro no upload 上传错误");
      return;
    }
    // Upsert: remove old doc of same type then insert
    await supabase.from("china_produto_documentos" as any).delete().eq("submissao_id", id).eq("tipo_documento", tipo);
    await supabase.from("china_produto_documentos" as any).insert({
      submissao_id: id,
      tipo_documento: tipo,
      arquivo_url: signedUrl,
      arquivo_path: path,
      nome_arquivo: file.name,
      status: "pendente",
    } as any);
    queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", id] });
    toast.success("Arquivo enviado! 文件已上传！");
  };

  const handleSendArte = async () => {
    if (!arteFile || !submissao) {
      toast.error("Selecione o arquivo da arte final 请选择终稿文件");
      return;
    }
    setSendingArte(true);
    try {
      const path = `${id}/arte_final/${arteFile.name}`;
      const { signedUrl, error } = await uploadAndGetSignedUrl("china-documentos", path, arteFile);
      if (error) throw error;
      await supabase
        .from("china_produto_submissoes" as any)
        .update({
          arte_final_url: signedUrl,
          arte_final_path: path,
          arte_final_enviada_em: new Date().toISOString(),
          ean_caixa_master: eanCaixaMaster || null,
          status: "arte_enviada",
        } as any)
        .eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["china-ficha", id] });
      toast.success("Arte final enviada! 终稿已发送！");
      setArteFile(null);
      setEanCaixaMaster("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar arte");
    } finally {
      setSendingArte(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!submissao) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Card className="max-w-lg mx-auto p-12 text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <BilingualLabel pt="Submissão não encontrada" cn="未找到提交" size="lg" className="items-center" />
        </Card>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[submissao.status] || STATUS_LABELS.rascunho;
  const canApprove = !["aprovado", "arte_enviada"].includes(submissao.status);
  const showArteSection = submissao.status === "aprovado";
  const showArteDownload = submissao.status === "arte_enviada" && submissao.arte_final_url;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica-china/recebimentos")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BilingualLabel pt="Ficha do Produto" cn="产品档案" size="lg" />
        </div>

        {/* Product Header Card */}
        <Card className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: Product info */}
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{submissao.produto_codigo}</h1>
                  <p className="text-lg text-muted-foreground">{submissao.produto_nome}</p>
                  {submissao.formula_codigo && (
                    <p className="text-sm text-muted-foreground mt-1">Fórmula 配方: {submissao.formula_codigo}</p>
                  )}
                </div>
                <Badge variant={statusInfo.variant} className="text-sm px-3 py-1 shrink-0">
                  {statusInfo.pt} {statusInfo.cn}
                </Badge>
              </div>

              {/* Weights row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Bruto 毛重</p>
                  <p className="text-lg font-bold text-foreground">{submissao.peso_bruto_g ? `${submissao.peso_bruto_g}g` : "—"}</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Líquido 净重</p>
                  <p className="text-lg font-bold text-foreground">{submissao.peso_liquido_g ? `${submissao.peso_liquido_g}g` : "—"}</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Tester 试用</p>
                  <p className="text-lg font-bold text-foreground">{submissao.peso_tester_g ? `${submissao.peso_tester_g}g` : "—"}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                {submissao.status === "arte_enviada" && (
                  <Button size="sm" onClick={() => setOcDialogOpen(true)}>
                    <ShoppingCart className="h-4 w-4 mr-1" /> Emitir OC 下采购单
                  </Button>
                )}
                {canApprove && (
                  <>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => {
                        const missingMandatory = MANDATORY_DOCS.some(tipo => !documentos.find((d: any) => d.tipo_documento === tipo));
                        if (missingMandatory) {
                          toast.error("Foto e vídeo da amostra são obrigatórios! 照片和视频样品是必需的！");
                          return;
                        }
                        updateSubStatus.mutate({ status: "aprovado" });
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar 批准
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateSubStatus.mutate({ status: "rejeitado" })}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Rejeitar 拒绝
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Right: Grade compact + Cofre link */}
            <div className="md:w-80 space-y-4">
              {cores.length > 0 && (
                <div className="p-4 border rounded-xl bg-card">
                  <BilingualLabel pt="Grade" cn="颜色网格" size="sm" className="mb-2" />
                  <ChinaGradeView
                    compact
                    items={cores.map((c: any) => ({
                      cor_nome: c.cor_nome,
                      cor_hex: c.cor_hex,
                      cor_numero: c.cor_numero,
                      codigo_produto: c.codigo_produto,
                      codigo_barras_ean: c.codigo_barras_ean,
                      quantidade: c.quantidade,
                      grupo: c.grupo,
                    }))}
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-right">
                    Total: {cores.reduce((s: number, c: any) => s + (c.quantidade || 0), 0).toLocaleString()} un
                  </p>
                </div>
              )}
              <Button variant="outline" className="w-full gap-2 text-sm" onClick={() => navigate(`/dashboard/fabrica/cofre`)}>
                <FolderOpen className="h-4 w-4" /> Cofre de Documentos 文件保险箱
              </Button>
            </div>
          </div>
        </Card>

        {/* Full Grade Table */}
        {cores.length > 0 && (
          <Card className="p-6">
            <ChinaGradeView
              items={cores.map((c: any) => ({
                cor_nome: c.cor_nome,
                cor_hex: c.cor_hex,
                cor_numero: c.cor_numero,
                codigo_produto: c.codigo_produto,
                codigo_barras_ean: c.codigo_barras_ean,
                quantidade: c.quantidade,
                grupo: c.grupo,
              }))}
            />
          </Card>
        )}

        {/* Documents by Category */}
        {DOCUMENT_CATEGORIES.map((cat) => {
          const catDocTypes = CHINA_DOCUMENT_TYPES.filter(d => cat.tipos.includes(d.tipo));
          return (
            <Card key={cat.key} className="p-6 space-y-4">
              <BilingualLabel pt={cat.labelPt} cn={cat.labelCn} size="md" className="border-b border-border pb-2" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {catDocTypes.map((config) => {
                  const doc = documentos.find((d: any) => d.tipo_documento === config.tipo);
                  return (
                    <div key={config.tipo} className="space-y-1">
                      <ChinaDocumentSlot
                        config={config}
                        status={doc ? (doc.status as any) : "none"}
                        fileName={doc?.nome_arquivo}
                        observacao={doc?.observacao}
                        onUpload={(file) => handleDocUpload(config.tipo, file)}
                        onRemove={doc && doc.status !== "aprovado" ? async () => {
                          await supabase.from("china_produto_documentos" as any).delete().eq("id", doc.id);
                          queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", id] });
                          toast.success("Documento removido 文件已删除");
                        } : undefined}
                      />
                      {/* Inline approve/reject for Brasil */}
                      {doc && doc.status === "pendente" && (
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-success"
                            onClick={() => updateDocStatus.mutate({ docId: doc.id, status: "aprovado" })}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> ✓
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-destructive"
                            onClick={() => setObsDialog({ docId: doc.id, obs: "" })}
                          >
                            <XCircle className="h-3 w-3 mr-1" /> ✗
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() => handleViewDoc(doc)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {doc && doc.status !== "pendente" && (
                        <div className="flex justify-center">
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => handleViewDoc(doc)}>
                            <Eye className="h-3 w-3 mr-1" /> Ver 查看
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mandatory warning */}
              {cat.key === "embalagem" && MANDATORY_DOCS.some(tipo => !documentos.find((d: any) => d.tipo_documento === tipo)) && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
                  ⚠️ Foto e vídeo da amostra são obrigatórios para aprovação. 照片和视频样品是审批所必需的。
                </div>
              )}
            </Card>
          );
        })}

        {/* Arte Final + EAN Section */}
        {showArteSection && (
          <Card className="p-6 border-primary/30 bg-primary/5 space-y-4">
            <BilingualLabel pt="Resposta Brasil — Arte Final + EAN" cn="巴西回复 — 终稿 + EAN" size="md" />
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">Arte Final 终稿</label>
                <div className="mt-1">
                  <input
                    type="file"
                    onChange={(e) => setArteFile(e.target.files?.[0] || null)}
                    className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:font-medium file:cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Barcode className="h-4 w-4" /> EAN Caixa Master 主箱EAN
                </label>
                <Input
                  value={eanCaixaMaster}
                  onChange={(e) => setEanCaixaMaster(e.target.value)}
                  placeholder="Ex: 7898000000000"
                  className="mt-1 font-mono"
                />
              </div>
              <Button onClick={handleSendArte} disabled={sendingArte} className="gap-2">
                {sendingArte ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Arte + EAN 发送终稿和EAN
              </Button>
            </div>
          </Card>
        )}

        {showArteDownload && (
          <Card className="p-6 border-success/30 bg-success/5 space-y-3">
            <BilingualLabel pt="Arte Final Enviada" cn="终稿已发送" size="md" />
            <div className="flex items-center gap-4 flex-wrap">
              <Button variant="outline" className="gap-2" onClick={() => window.open(submissao.arte_final_url, "_blank")}>
                <Download className="h-4 w-4" /> Download Arte 下载终稿
              </Button>
              {submissao.ean_caixa_master && (
                <div className="px-4 py-2 bg-card border rounded-lg font-mono text-lg font-bold flex items-center gap-2">
                  <Barcode className="h-5 w-5 text-muted-foreground" />
                  {submissao.ean_caixa_master}
                </div>
              )}
            </div>
            {submissao.arte_final_enviada_em && (
              <p className="text-xs text-muted-foreground">
                Enviada em 发送于: {new Date(submissao.arte_final_enviada_em).toLocaleDateString("pt-BR")}
              </p>
            )}
          </Card>
        )}

        {/* Ordens de Compra + Produção */}
        {ordens.length > 0 && (
          <Card className="p-6 space-y-4">
            <BilingualLabel pt="Ordens de Compra & Produção" cn="采购订单和生产" size="md" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ordens.map((oc: any) => {
                const ocAponts = apontamentos.filter((a: any) => a.ordem_compra_id === oc.id);
                const totalProduzido = ocAponts.reduce((s: number, a: any) => s + (a.quantidade || 0), 0);
                const pct = oc.qty_total > 0 ? Math.round((totalProduzido / oc.qty_total) * 100) : 0;
                return (
                  <div
                    key={oc.id}
                    className="p-4 border rounded-xl bg-card cursor-pointer hover:shadow-md transition-all"
                    onClick={() => navigate(`/dashboard/fabrica-china/ordens/${oc.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-foreground">{oc.numero_oc}</span>
                      <Badge variant={oc.status === "concluida" ? "success" : "warning"} className="text-[10px]">
                        {oc.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                      <span>Qtd Total 总量: {oc.qty_total?.toLocaleString()}</span>
                      <span className="font-bold text-primary">{pct}%</span>
                    </div>
                    <Progress value={pct} gradient className="h-2.5 mb-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Produzido 已生产: {totalProduzido.toLocaleString()}</span>
                      <span>Pendente 待生产: {Math.max(0, oc.qty_total - totalProduzido).toLocaleString()}</span>
                    </div>
                    {oc.ean_caixa_master && (
                      <p className="text-xs font-mono text-muted-foreground mt-2 flex items-center gap-1">
                        <Barcode className="h-3 w-3" /> {oc.ean_caixa_master}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Observations */}
        {(submissao.observacoes_china || submissao.observacoes_brasil) && (
          <Card className="p-6 space-y-3">
            <BilingualLabel pt="Observações" cn="备注" size="md" />
            {submissao.observacoes_china && (
              <div className="p-3 bg-warning/10 rounded-lg">
                <p className="text-xs font-medium text-warning mb-1">China 中国:</p>
                <p className="text-sm text-foreground">{submissao.observacoes_china}</p>
              </div>
            )}
            {submissao.observacoes_brasil && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-xs font-medium text-primary mb-1">Brasil 巴西:</p>
                <p className="text-sm text-foreground">{submissao.observacoes_brasil}</p>
              </div>
            )}
          </Card>
        )}
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
            <Button variant="outline" onClick={() => setObsDialog(null)}>Cancelar 取消</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (obsDialog) {
                  updateDocStatus.mutate({ docId: obsDialog.docId, status: "rejeitado", observacao: obsDialog.obs });
                  setObsDialog(null);
                }
              }}
            >
              Rejeitar 拒绝
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Emitir OC Dialog */}
      <EmitirOCDialog
        open={ocDialogOpen}
        onOpenChange={setOcDialogOpen}
        submissao={submissao}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["china-ficha-ocs", id] });
          queryClient.invalidateQueries({ queryKey: ["china-ficha", id] });
        }}
      />
    </div>
  );
}

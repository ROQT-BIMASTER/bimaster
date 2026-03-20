import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Package, Eye, CheckCircle2, XCircle, Clock, Loader2,
  ShoppingCart, Upload, Barcode, Download, FileText, TrendingUp,
  FolderOpen, Briefcase, ExternalLink, PenLine, Lock, Trash2, ShieldAlert, PackageCheck,
  Send, Users, Link2, UserPlus, X
} from "lucide-react";
import { useAuditChinaVinculo } from "@/hooks/useAuditChinaVinculo";
import { AuditChinaVinculoBadge } from "@/components/china/AuditChinaVinculoBadge";
import { TAREFAS_POR_SECAO } from "@/hooks/useChinaProjeto";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { ChinaGradeView } from "@/components/china/ChinaGradeView";
import { ChinaDocumentSlot } from "@/components/china/ChinaDocumentSlot";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES, CATEGORIES_CHINA_ENVIA, CATEGORIES_BRASIL_ENVIA, MANDATORY_DOCS, STATUS_LABELS } from "@/lib/china-document-types";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { EmitirOCDialog } from "@/components/china/EmitirOCDialog";
import { useChinaProjetosVinculados, useCriarProjetoChina } from "@/hooks/useChinaProjeto";
import { ChinaProjetoChecklist } from "@/components/china/ChinaProjetoChecklist";
import { ChinaTimeline } from "@/components/china/ChinaTimeline";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSignedUrl, uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";
import { ChinaChecklistFocusMode } from "@/components/china/ChinaChecklistFocusMode";
import { ChinaPainelAprovacao } from "@/components/china/ChinaPainelAprovacao";
import { CofreSubmissaoDialog } from "@/components/china/CofreSubmissaoDialog";
import { ChinaChatPanel } from "@/components/china/ChinaChatPanel";
import { ChinaPastaDigitalPanel } from "@/components/china/ChinaPastaDigitalPanel";
import { ProcessoTimeline } from "@/components/processo/ProcessoTimeline";
import { ProcessoResumo } from "@/components/processo/ProcessoResumo";
import { VinculoProjetoBadges } from "@/components/shared/VinculoProjetoBadges";
import { VincularProjetoDialog } from "@/components/shared/VincularProjetoDialog";
import { DespachoFichaDialog } from "@/components/china/DespachoFichaDialog";
import { useFichaVisibilidade, useAddFichaVisibilidade, useRemoveFichaVisibilidade } from "@/hooks/useChinaFichaVisibilidade";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";
import { useUIPermissions } from "@/hooks/useUIPermissions";

export default function ChinaFichaProduto() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isBrasilUser, isChinaUser } = useChinaUserContext();
  const [obsDialog, setObsDialog] = useState<{ docId: string; obs: string } | null>(null);
  const [ocDialogOpen, setOcDialogOpen] = useState(false);
  const [eanCaixaMaster, setEanCaixaMaster] = useState("");
  const [arteFile, setArteFile] = useState<File | null>(null); // kept for backward compat
  const [sendingArte, setSendingArte] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [painelAprovacaoOpen, setPainelAprovacaoOpen] = useState(false);
  const [cofreOpen, setCofreOpen] = useState(false);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [despachoOpen, setDespachoOpen] = useState(false);

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
    const path = `${id}/${tipo}/${Date.now()}_${file.name}`;
    const { signedUrl, error } = await uploadAndGetSignedUrl("china-documentos", path, file);
    if (error) {
      toast.error("Erro no upload 上传错误");
      return;
    }
    // Insert without deleting — supports multiple files per type
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
  const showArteSection = false; // Legacy — replaced by TransferenciasOficiaisSection
  const showArteDownload = false;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica-china/recebimentos")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BilingualLabel pt="Ficha do Produto" cn="产品档案" size="lg" className="flex-1" />
          {isBrasilUser && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setDespachoOpen(true)}>
              <Send className="h-4 w-4" /> Despachar
            </Button>
          )}
          <ManualFabricaDrawer screen="china-ficha-produto" />
        </div>

        {/* Draft Banner + Edit Button */}
        {submissao.status === "rascunho" && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <PenLine className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-primary text-sm">
                    Rascunho — ainda pode ser editado 草稿 — 仍可编辑
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ajuste os dados antes de enviar ao Brasil. 在发送到巴西之前调整数据。
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => navigate(`/dashboard/fabrica-china/nova/${id}`)}
                  className="gap-2 shrink-0"
                >
                  <PenLine className="h-4 w-4" />
                  Editar / Ajustar 编辑/调整
                </Button>
                <Button
                  variant="destructive"
                  size="default"
                  className="gap-2 shrink-0"
                  onClick={() => { setDeleteConfirmed(false); setDeleteDialogOpen(true); }}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir 删除
                </Button>
              </div>
            </div>
          </Card>
        )}

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
                {isBrasilUser && submissao.status === "arte_enviada" && (
                  <Button size="sm" onClick={() => setOcDialogOpen(true)}>
                    <ShoppingCart className="h-4 w-4 mr-1" /> Emitir OC 下采购单
                  </Button>
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
              <Button variant="outline" className="w-full gap-2 text-sm" onClick={() => setCofreOpen(true)}>
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

        {/* Approval Panel Button */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <BilingualLabel pt="Painel de Aprovação e Acompanhamento" cn="审批与跟踪面板" size="md" />
            <Button onClick={() => setPainelAprovacaoOpen(true)} className="gap-2">
              <Eye className="h-4 w-4" /> Abrir Painel 打开面板
            </Button>
          </div>
        </Card>

        {painelAprovacaoOpen && (
          <ChinaPainelAprovacao
            submissaoId={id!}
            produtoNome={`${submissao.produto_codigo} — ${submissao.produto_nome}`}
            documentos={documentos}
            isBrasilUser={isBrasilUser}
            isChinaUser={isChinaUser}
            onViewDoc={handleViewDoc}
            onReupload={handleDocUpload}
            onClose={() => setPainelAprovacaoOpen(false)}
          />
        )}

        {/* Cofre Dialog */}
        <CofreSubmissaoDialog
          submissaoId={id!}
          produtoNome={`${submissao.produto_codigo} — ${submissao.produto_nome}`}
          open={cofreOpen}
          onOpenChange={setCofreOpen}
        />

        {/* Documents Summary + Focus Mode */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <BilingualLabel pt="Documentos" cn="文件" size="md" />
            <ChinaChecklistFocusMode
              submissaoId={id!}
              documentos={documentos as any}
              onUpload={handleDocUpload}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", id] })}
              onRemoveFile={async (fileId) => {
                await supabase.from("china_produto_documentos" as any).delete().eq("id", fileId);
                queryClient.invalidateQueries({ queryKey: ["china-ficha-docs", id] });
                toast.success("Documento removido 文件已删除");
              }}
              onViewDoc={handleViewDoc}
            />
          </div>

          {/* Compact summary table — split by flow */}
          {[
            { categories: CATEGORIES_CHINA_ENVIA, headerPt: "China Envia ao Brasil", headerCn: "中国发送至巴西", icon: <ArrowUpRight className="h-4 w-4" />, color: "bg-primary/10 text-primary border-primary/30" },
            { categories: CATEGORIES_BRASIL_ENVIA, headerPt: "Brasil Envia à China", headerCn: "巴西发送至中国", icon: <ArrowDownLeft className="h-4 w-4" />, color: "bg-success/10 text-success border-success/30" },
          ].map(({ categories, headerPt, headerCn, icon, color }) => (
            <div key={headerPt} className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th colSpan={5} className={`text-left px-4 py-3 font-bold text-sm border ${color} rounded-t-lg`}>
                      <div className="flex items-center gap-2">
                        {icon}
                        <span>{headerPt}</span>
                        <span className="font-normal text-xs opacity-75">{headerCn}</span>
                      </div>
                    </th>
                  </tr>
                  <tr className="bg-muted/30 text-muted-foreground text-xs">
                    <th className="text-left px-4 py-2.5 font-medium">Categoria 类别</th>
                    <th className="text-center px-4 py-2.5 font-medium">Arquivos 文件</th>
                    <th className="text-center px-4 py-2.5 font-medium">Status 状态</th>
                    <th className="text-center px-4 py-2.5 font-medium">Rascunhos 草稿</th>
                    <th className="text-center px-4 py-2.5 font-medium">Pendentes 待处理</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categories.map((cat) => {
                    const catTotalTypes = CHINA_DOCUMENT_TYPES.filter(d => cat.tipos.includes(d.tipo)).length;
                    const catDocs = documentos.filter((d: any) => cat.tipos.includes(d.tipo_documento));
                    const catFilled = new Set(catDocs.map((d: any) => d.tipo_documento)).size;
                    const hasRejected = catDocs.some((d: any) => d.status === "rejeitado");
                    const hasDrafts = catDocs.filter((d: any) => d.status === "rascunho").length;
                    const hasPending = catDocs.filter((d: any) => d.status === "pendente").length;
                    const allApproved = catFilled === catTotalTypes && catDocs.length > 0 && catDocs.every((d: any) => d.status === "aprovado");

                    const statusBadge = allApproved
                      ? <Badge variant="success" className="text-xs">✓ Completo 完成</Badge>
                      : hasRejected
                      ? <Badge variant="destructive" className="text-xs">✗ Rejeitado 被拒</Badge>
                      : catFilled === 0
                      ? <Badge variant="secondary" className="text-xs">— Vazio 空</Badge>
                      : <Badge variant="warning" className="text-xs">⏳ Parcial 部分</Badge>;

                    return (
                      <tr key={cat.key} className="hover:bg-accent/10 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground text-sm">{cat.labelPt}</p>
                            <p className="text-[10px] text-muted-foreground">{cat.labelCn}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-foreground">{catFilled}</span>
                          <span className="text-muted-foreground">/{catTotalTypes}</span>
                        </td>
                        <td className="px-4 py-3 text-center">{statusBadge}</td>
                        <td className="px-4 py-3 text-center">
                          {hasDrafts > 0 ? (
                            <Badge variant="secondary" className="text-xs">{hasDrafts}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {hasPending > 0 ? (
                            <Badge variant="warning" className="text-xs">{hasPending}</Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {/* Mandatory warning */}
          {MANDATORY_DOCS.some(tipo => !documentos.find((d: any) => d.tipo_documento === tipo)) && (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
              ⚠️ Foto e vídeo da amostra são obrigatórios para aprovação. 照片和视频样品是审批所必需的。
            </div>
          )}
        </Card>

        {/* Transferências Oficiais ao Brasil */}
        <TransferenciasOficiaisSection submissaoId={id!} documentos={documentos} isBrasilUser={isBrasilUser} eanCaixaMaster={submissao.ean_caixa_master} />

        {/* Chat China ↔ Brasil */}
        <ChinaChatPanel
          submissaoId={id!}
          produtoNome={`${submissao.produto_codigo} — ${submissao.produto_nome}`}
          tipoRemetente={isChinaUser ? "china" : "brasil"}
          referenciasDisponiveis={[
            { tipo: "produto", id: id!, label: `${submissao.produto_codigo} — ${submissao.produto_nome}` },
            ...DOCUMENT_CATEGORIES.flatMap(cat =>
              cat.tipos
                .filter(tipo => documentos.some((d: any) => d.tipo_documento === tipo))
                .map(tipo => {
                  const dt = CHINA_DOCUMENT_TYPES.find(t => t.tipo === tipo);
                  return {
                    tipo: "documento" as const,
                    id: tipo,
                    label: dt ? `${dt.labelPt}` : tipo,
                  };
                })
            ),
            ...DOCUMENT_CATEGORIES.map(cat => ({
              tipo: "checklist" as const,
              id: cat.key,
              label: `${cat.labelPt} ${cat.labelCn}`,
            })),
          ]}
        />

        {/* Pasta Digital China — TJSP */}
        {isBrasilUser && (
          <Card className="p-6">
            <ChinaPastaDigitalPanel submissaoId={id!} />
          </Card>
        )}

        {/* Projetos Vinculados + Visibilidade */}
        {isBrasilUser && (
          <>
            <ChinaProjetosVinculadosSection submissao={submissao} onVincular={() => setVincularOpen(true)} />
            <FichaVisibilidadeSection submissaoId={id!} />
          </>
        )}

        {/* Dialogs */}
        {id && (
          <>
            <VincularProjetoDialog modulo="ficha_china" registroId={id} open={vincularOpen} onOpenChange={setVincularOpen} />
            <DespachoFichaDialog
              submissaoId={id}
              produtoNome={`${submissao.produto_codigo} — ${submissao.produto_nome}`}
              open={despachoOpen}
              onOpenChange={setDespachoOpen}
            />
          </>
        )}

        {/* Checklist Pré-Lançamento do Projeto Brasil */}
        {isBrasilUser && <ChinaProjetoChecklist submissaoId={submissao.id} />}

        {/* Processo Unificado do Produto */}
        {isBrasilUser && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <ProcessoResumo produtoTipo="china" produtoRefId={submissao.id} />
            </div>
            <div className="lg:col-span-2">
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Timeline do Processo
                </h3>
                <ProcessoTimeline produtoTipo="china" produtoRefId={submissao.id} />
              </Card>
            </div>
          </div>
        )}

        {/* Timeline Legada */}
        <ChinaTimeline submissaoId={submissao.id} />

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

      {/* Delete Draft Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Excluir Submissão 删除提交
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-foreground space-y-2">
              <p className="font-semibold">Termo de Exclusão 删除条款</p>
              <p className="text-muted-foreground text-xs">
                Ao excluir esta submissão, ela será movida para a <strong>Lixeira</strong> por 30 dias. 
                Após esse período, será permanentemente removida do sistema junto com todos os documentos e dados associados.
              </p>
              <p className="text-muted-foreground text-xs">
                删除此提交后，它将被移至<strong>回收站</strong>30天。之后，将与所有相关文档和数据一起从系统中永久删除。
              </p>
              <div className="mt-2 p-2 bg-muted rounded text-xs">
                <strong>Produto 产品:</strong> {submissao?.produto_codigo} — {submissao?.produto_nome}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="delete-confirm"
                checked={deleteConfirmed}
                onCheckedChange={(checked) => setDeleteConfirmed(!!checked)}
              />
              <label htmlFor="delete-confirm" className="text-sm cursor-pointer leading-tight">
                Confirmo que revisei os dados e desejo excluir esta submissão.
                <br />
                <span className="text-xs text-muted-foreground">
                  我确认已审查数据并希望删除此提交。
                </span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar 取消
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteConfirmed || deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  await supabase
                    .from("china_produto_submissoes" as any)
                    .update({
                      deleted_at: new Date().toISOString(),
                      deleted_by: user?.id || null,
                      delete_reason: "Exclusão voluntária pelo usuário",
                    } as any)
                    .eq("id", id);
                  toast.success("Submissão movida para a lixeira! 提交已移至回收站！");
                  navigate("/dashboard/fabrica-china/recebimentos");
                } catch (err: any) {
                  toast.error("Erro ao excluir 删除失败");
                } finally {
                  setDeleting(false);
                  setDeleteDialogOpen(false);
                }
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Confirmar Exclusão 确认删除
            </Button>
          </DialogFooter>
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

/** Inline component for linked projects section */
function ChinaProjetosVinculadosSection({ submissao, onVincular }: { submissao: any; onVincular?: () => void }) {
  const navigate = useNavigate();
  const { data: projetos = [], isLoading } = useChinaProjetosVinculados(submissao?.id);
  const criarProjeto = useCriarProjetoChina();
  const { auditProjeto, loading: auditing, result: auditResult, reset: resetAudit } = useAuditChinaVinculo();
  const [pendingCreate, setPendingCreate] = useState(false);

  const handleCriar = async () => {
    // Run AI audit first
    setPendingCreate(true);
    const secoes = Object.keys(TAREFAS_POR_SECAO);
    const audit = await auditProjeto({
      projeto: { nome: `Dev — ${submissao.produto_codigo}`, secoes },
      submissao: {
        produto_codigo: submissao.produto_codigo,
        produto_nome: submissao.produto_nome,
        status: submissao.status,
        formula_codigo: submissao.formula_codigo,
        ean_unidade: submissao.ean_unidade,
        ean_display: submissao.ean_display,
        ean_caixa_master: submissao.ean_caixa_master,
        peso_liquido_g: submissao.peso_liquido_g,
        peso_bruto_g: submissao.peso_bruto_g,
        qty_total: submissao.qty_total,
        observacoes_brasil: submissao.observacoes_brasil,
        observacoes_china: submissao.observacoes_china,
        numero_ordem: submissao.numero_ordem,
        numero_item: submissao.numero_item,
      },
    });

    // If low match, show warning but don't block
    if (audit?.match === "baixo") {
      toast.warning("IA identificou possível incompatibilidade — verifique os alertas antes de prosseguir.");
      setPendingCreate(false);
      return;
    }

    // Proceed with creation
    await proceedCreate();
  };

  const proceedCreate = async () => {
    try {
      const projeto = await criarProjeto.mutateAsync({
        id: submissao.id,
        produto_codigo: submissao.produto_codigo,
        produto_nome: submissao.produto_nome,
      });
      resetAudit();
      setPendingCreate(false);
      navigate(`/dashboard/projetos/${projeto.id}`);
    } catch {
      setPendingCreate(false);
    }
  };

  const forceCreate = async () => {
    resetAudit();
    await proceedCreate();
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <BilingualLabel pt="Projetos Vinculados" cn="关联项目" size="md" />
        {onVincular && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onVincular}>
            <Link2 className="h-4 w-4" /> Vincular a Projeto
          </Button>
        )}
      </div>

      {/* Vínculos via módulo */}
      <VinculoProjetoBadges modulo="ficha_china" registroId={submissao?.id} />

      {/* AI Audit result */}
      {(auditing || auditResult) && (
        <AuditChinaVinculoBadge result={auditResult} loading={auditing} />
      )}

      {/* If audit blocked creation, show force button */}
      {auditResult?.match === "baixo" && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => resetAudit()}>
            Cancelar
          </Button>
          <Button variant="destructive" size="sm" onClick={forceCreate} disabled={criarProjeto.isPending} className="gap-2">
            {criarProjeto.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            Criar mesmo assim
          </Button>
        </div>
      )}

      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

      {!isLoading && projetos.length === 0 && !auditResult && (
        <div className="flex flex-col items-center py-6 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Nenhum projeto vinculado. 没有关联项目。
          </p>
          <Button onClick={handleCriar} disabled={criarProjeto.isPending || auditing || pendingCreate} className="gap-2">
            {(criarProjeto.isPending || auditing) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
            Criar Projeto de Desenvolvimento 创建开发项目
          </Button>
        </div>
      )}

      {!isLoading && projetos.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projetos.map((p: any) => {
              const pct = p.total_tarefas > 0 ? Math.round((p.tarefas_concluidas / p.total_tarefas) * 100) : 0;
              return (
                <div
                  key={p.id}
                  className="p-4 border rounded-xl bg-card cursor-pointer hover:shadow-md transition-all"
                  onClick={() => navigate(`/dashboard/projetos/${p.id}`)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: p.cor }}>
                      <span className="text-white text-sm font-bold">{p.nome?.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.tarefas_concluidas}/{p.total_tarefas} tarefas</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <Progress value={pct} gradient className="h-2" />
                </div>
              );
            })}
          </div>
          <Button variant="outline" size="sm" onClick={handleCriar} disabled={criarProjeto.isPending || auditing} className="gap-2">
            {(criarProjeto.isPending || auditing) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
            Criar outro projeto 创建其他项目
          </Button>
        </div>
      )}
    </Card>
  );
}

// ─── Visibilidade da Ficha ───
function FichaVisibilidadeSection({ submissaoId }: { submissaoId: string }) {
  const { data: visibilidade = [], isLoading } = useFichaVisibilidade(submissaoId);
  const addVisibilidade = useAddFichaVisibilidade();
  const removeVisibilidade = useRemoveFichaVisibilidade();
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles-for-visibility"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome_completo, email")
        .eq("aprovado", true)
        .order("nome_completo");
      return (data || []) as any[];
    },
  });

  const existingUserIds = new Set(visibilidade.map((v: any) => v.user_id));
  const availableProfiles = allProfiles.filter((p: any) => !existingUserIds.has(p.id));

  const handleAdd = () => {
    if (!selectedUserId) return;
    addVisibilidade.mutate(
      { submissao_id: submissaoId, user_id: selectedUserId },
      { onSuccess: () => setSelectedUserId("") }
    );
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <BilingualLabel pt="Acesso e Visibilidade" cn="访问与可见性" size="md" />
        <Badge variant="secondary" className="ml-auto">{visibilidade.length} usuário(s)</Badge>
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Selecionar usuário..." />
          </SelectTrigger>
          <SelectContent>
            {availableProfiles.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome_completo || p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleAdd} disabled={!selectedUserId || addVisibilidade.isPending} className="gap-1">
          <UserPlus className="h-4 w-4" /> Conceder
        </Button>
      </div>

      {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      {visibilidade.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {visibilidade.map((v: any) => (
            <div key={v.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 text-xs">
              <Users className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="flex-1 truncate">{v.user_nome}</span>
              <span className="text-muted-foreground truncate">{v.user_email}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => removeVisibilidade.mutate(v.id)}
              >
                <X className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Transferências Oficiais ao Brasil ───
function TransferenciasOficiaisSection({ submissaoId, documentos, isBrasilUser, eanCaixaMaster }: {
  submissaoId: string;
  documentos: any[];
  isBrasilUser: boolean;
  eanCaixaMaster: string | null;
}) {
  const oficiais = documentos.filter(
    (d: any) => d.oficializado === true && d.assinado_por
  );

  const docTypeLabel = (tipo: string) => {
    const found = CHINA_DOCUMENT_TYPES.find(t => t.tipo === tipo);
    return found ? `${found.labelPt} ${found.labelCn}` : tipo;
  };

  if (oficiais.length === 0 && !eanCaixaMaster) {
    return (
      <Card className="p-6 border-muted/30 space-y-2">
        <BilingualLabel pt="Transferências Oficiais ao Brasil" cn="官方转交至巴西" size="md" />
        <p className="text-sm text-muted-foreground">
          Nenhum documento oficializado e assinado ainda. Após a oficialização e assinatura eletrônica no checklist, os documentos aparecerão aqui.
        </p>
        <p className="text-xs text-muted-foreground">
          目前没有正式签署的文件。在清单中完成正式化和电子签名后，文件将显示在此处。
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-success/30 bg-success/5 space-y-4">
      <div className="flex items-center gap-2">
        <PackageCheck className="h-5 w-5 text-success" />
        <BilingualLabel pt="Transferências Oficiais ao Brasil" cn="官方转交至巴西" size="md" />
        <Badge variant="success" className="ml-auto text-xs">{oficiais.length} doc(s)</Badge>
      </div>

      <div className="space-y-2">
        {oficiais.map((doc: any) => (
          <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{docTypeLabel(doc.tipo_documento)}</p>
              <p className="text-xs text-muted-foreground truncate">{doc.nome_arquivo || "—"}</p>
            </div>
            <div className="text-right shrink-0">
              {doc.assinatura_nome && (
                <p className="text-xs font-medium text-foreground">✍️ {doc.assinatura_nome}</p>
              )}
              {doc.assinado_em && (
                <p className="text-[10px] text-muted-foreground">
                  {new Date(doc.assinado_em).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
            <Badge variant="success" className="text-[10px]">Oficial</Badge>
            {doc.arquivo_url && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(doc.arquivo_url, "_blank")}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {eanCaixaMaster && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-card border">
          <Barcode className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-mono font-bold text-foreground">EAN Caixa Master: {eanCaixaMaster}</span>
        </div>
      )}
    </Card>
  );
}

import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Upload, FileSpreadsheet, Check, Loader2, ChevronRight, Scale, ImageIcon, Sparkles, X, PenLine, Save, Eye, EyeOff, Package, Send, AlertTriangle, CheckCircle2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { ChinaExcelPreview } from "@/components/china/ChinaExcelPreview";
import { ChinaDocumentSlot } from "@/components/china/ChinaDocumentSlot";
import { ChinaGradeEditor, type GradeItem } from "@/components/china/ChinaGradeEditor";
import { ChinaDataValidationDialog } from "@/components/china/ChinaDataValidationDialog";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES, MANDATORY_DOCS } from "@/lib/china-document-types";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ManualFabricaDrawer } from "@/components/fabrica/ManualFabricaDrawer";

const STEPS = [
  { labelPt: "Dados do Produto", labelCn: "产品数据", icon: FileSpreadsheet },
  { labelPt: "Documentos", labelCn: "文件", icon: Upload },
  { labelPt: "Pesos e Medidas", labelCn: "重量和尺寸", icon: Scale },
];

export default function ChinaNovaSubmissao() {
  const navigate = useNavigate();
  const { submissaoId: editId } = useParams<{ submissaoId: string }>();
  const [step, setStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [submissaoId, setSubmissaoId] = useState<string | null>(editId || null);
  const [docs, setDocs] = useState<Record<string, { fileName: string; status: "pendente" | "aprovado" | "rejeitado" }[]>>({});
  const [weights, setWeights] = useState({
    peso_bruto_g: "",
    peso_liquido_g: "",
    peso_tester_g: "",
    display_largura: "",
    display_altura: "",
    display_profundidade: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [gradeItems, setGradeItems] = useState<GradeItem[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [aiExtracted, setAiExtracted] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualData, setManualData] = useState({
    produto_codigo: "",
    produto_nome: "",
    formula_codigo: "",
    numero_item: "",
    numero_ordem: "",
    qty_total: "",
  });
  const [validationOpen, setValidationOpen] = useState(false);
  const [pendingAiData, setPendingAiData] = useState<any>(null);
  const [pendingSourceFile, setPendingSourceFile] = useState<{ file: File; type: string } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showProductPreview, setShowProductPreview] = useState(true);
  const [showFinalReview, setShowFinalReview] = useState(false);

  // Load existing submission for resume/edit
  const { data: existingSubmissao, isLoading: loadingExisting } = useQuery({
    queryKey: ["china-edit-submissao", editId],
    enabled: !!editId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_submissoes" as any)
        .select("*")
        .eq("id", editId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  // Load existing docs for resume
  const { data: existingDocs } = useQuery({
    queryKey: ["china-edit-docs", editId],
    enabled: !!editId,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_documentos" as any)
        .select("*")
        .eq("submissao_id", editId);
      return (data || []) as any[];
    },
  });

  // Load existing cores for resume
  const { data: existingCores } = useQuery({
    queryKey: ["china-edit-cores", editId],
    enabled: !!editId,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_cores" as any)
        .select("*")
        .eq("submissao_id", editId)
        .order("ordem" as any);
      return (data || []) as any[];
    },
  });

  // Determine if read-only (non-draft status)
  const isReadOnly = !!(existingSubmissao && existingSubmissao.status !== "rascunho");

  // Hydrate state from existing data when resuming
  useEffect(() => {
    if (existingSubmissao && editId) {
      setParsedData(existingSubmissao.dados_excel || { produto_codigo: existingSubmissao.produto_codigo, produto_nome: existingSubmissao.produto_nome });
      setWeights({
        peso_bruto_g: existingSubmissao.peso_bruto_g?.toString() || "",
        peso_liquido_g: existingSubmissao.peso_liquido_g?.toString() || "",
        peso_tester_g: existingSubmissao.peso_tester_g?.toString() || "",
        display_largura: existingSubmissao.medidas_display?.largura?.toString() || "",
        display_altura: existingSubmissao.medidas_display?.altura?.toString() || "",
        display_profundidade: existingSubmissao.medidas_display?.profundidade?.toString() || "",
      });
      if (existingSubmissao.produto_codigo) setStep(1);
    }
  }, [existingSubmissao, editId]);

  // Hydrate docs
  useEffect(() => {
    if (existingDocs?.length) {
      const grouped: Record<string, { fileName: string; status: "pendente" | "aprovado" | "rejeitado" }[]> = {};
      existingDocs.forEach((d: any) => {
        if (!grouped[d.tipo_documento]) grouped[d.tipo_documento] = [];
        grouped[d.tipo_documento].push({ fileName: d.nome_arquivo || "arquivo", status: d.status || "pendente" });
      });
      setDocs(grouped);
    }
  }, [existingDocs]);

  // Hydrate cores
  useEffect(() => {
    if (existingCores?.length) {
      setGradeItems(existingCores.map((c: any) => ({
        id: c.id || crypto.randomUUID(),
        cor_nome: c.cor_nome,
        cor_hex: c.cor_hex || "",
        cor_numero: c.cor_numero || "",
        codigo_produto: c.codigo_produto || "",
        codigo_barras_ean: c.codigo_barras_ean || "",
        quantidade: c.quantidade,
        grupo: c.grupo || "A",
      })));
    }
  }, [existingCores]);

  // Product info for preview (from parsedData or existingSubmissao)
  const productInfo = parsedData || existingSubmissao || null;

  // Save draft at any step
  const handleSaveDraft = useCallback(async () => {
    if (!submissaoId) {
      toast.info("Preencha os dados do produto primeiro 请先填写产品数据");
      return;
    }
    setSavingDraft(true);
    try {
      // Save grade items
      if (gradeItems.length > 0) {
        await supabase.from("china_produto_cores" as any).delete().eq("submissao_id", submissaoId);
        await supabase.from("china_produto_cores" as any).insert(
          gradeItems.map((item, i) => ({
            submissao_id: submissaoId,
            grupo: item.grupo || "A",
            cor_nome: item.cor_nome,
            cor_hex: item.cor_hex || null,
            cor_numero: item.cor_numero || null,
            codigo_produto: item.codigo_produto || null,
            codigo_barras_ean: item.codigo_barras_ean || null,
            quantidade: item.quantidade,
            ordem: i,
          }))
        );
      }

      // Save weights
      await supabase
        .from("china_produto_submissoes" as any)
        .update({
          peso_bruto_g: weights.peso_bruto_g ? parseFloat(weights.peso_bruto_g) : null,
          peso_liquido_g: weights.peso_liquido_g ? parseFloat(weights.peso_liquido_g) : null,
          peso_tester_g: weights.peso_tester_g ? parseFloat(weights.peso_tester_g) : null,
          medidas_display: {
            largura: weights.display_largura ? parseFloat(weights.display_largura) : null,
            altura: weights.display_altura ? parseFloat(weights.display_altura) : null,
            profundidade: weights.display_profundidade ? parseFloat(weights.display_profundidade) : null,
          },
          status: "rascunho",
        } as any)
        .eq("id", submissaoId);

      toast.success("Rascunho salvo! Você pode continuar depois. 草稿已保存！您可以稍后继续。");
      navigate("/dashboard/fabrica-china/recebimentos");
    } catch (err: any) {
      toast.error("Erro ao salvar rascunho 保存草稿失败");
    } finally {
      setSavingDraft(false);
    }
  }, [submissaoId, weights, gradeItems, navigate]);

  // Process AI response
  const processAiResponse = useCallback(async (data: any, sourceFile?: File, sourceType?: string) => {
    if (data.error) {
      toast.error(data.error);
      return;
    }
    setPendingAiData(data);
    setAiExtracted(!!data._ai_extracted);
    if (sourceFile && sourceType) {
      setPendingSourceFile({ file: sourceFile, type: sourceType });
    }
    setValidationOpen(true);
  }, []);

  // Called when user confirms data in validation dialog
  const handleValidationConfirm = useCallback(async (validatedData: any, photoFiles: Record<string, File[]>) => {
    try {
      if (validatedData.peso_bruto_g) setWeights(w => ({ ...w, peso_bruto_g: String(validatedData.peso_bruto_g) }));
      if (validatedData.peso_liquido_g) setWeights(w => ({ ...w, peso_liquido_g: String(validatedData.peso_liquido_g) }));

      setParsedData(validatedData);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data: sub, error } = await supabase
        .from("china_produto_submissoes" as any)
        .insert({
          produto_codigo: validatedData.produto_codigo || "UNKNOWN",
          produto_nome: validatedData.produto_nome || "UNKNOWN",
          numero_item: validatedData.numero_item || null,
          numero_ordem: validatedData.numero_ordem || null,
          formula_codigo: validatedData.formula_codigo || null,
          qty_total: validatedData.qty_total || null,
          peso_bruto_g: validatedData.peso_bruto_g || null,
          peso_liquido_g: validatedData.peso_liquido_g || null,
          tipo_material_plastico: validatedData.tipo_material_plastico || null,
          ean_display: validatedData.ean_display || null,
          ean_caixa_master: validatedData.ean_caixa_master || null,
          dados_excel: validatedData,
          created_by: session.user.id,
          status: "rascunho",
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      setSubmissaoId((sub as any).id);

      if (validatedData.cores?.length > 0) {
        const parsed: GradeItem[] = validatedData.cores.map((c: any) => ({
          id: crypto.randomUUID(),
          cor_nome: c.cor_nome || "",
          cor_hex: c.cor_hex || "",
          cor_numero: "",
          codigo_produto: "",
          codigo_barras_ean: c.codigo_barras_ean || "",
          quantidade: c.quantidade || 0,
          grupo: c.grupo || "A",
        }));
        setGradeItems(parsed);
      }

      if (pendingSourceFile) {
        const { file, type } = pendingSourceFile;
        const path = `${(sub as any).id}/${type}/${file.name}`;
        const { signedUrl } = await uploadAndGetSignedUrl("china-documentos", path, file);
        await supabase.from("china_produto_documentos" as any).insert({
          submissao_id: (sub as any).id,
          tipo_documento: type,
          arquivo_url: signedUrl,
          arquivo_path: path,
          nome_arquivo: file.name,
          status: "pendente",
        } as any);
        setDocs(d => ({ ...d, [type]: [...(d[type] || []), { fileName: file.name, status: "pendente" as const }] }));
        setPendingSourceFile(null);
      }

      if (photoFiles && Object.keys(photoFiles).length > 0) {
        const subId = (sub as any).id;
        for (const [tipo, files] of Object.entries(photoFiles)) {
          for (const file of files) {
            const path = `${subId}/${tipo}/${file.name}`;
            const { signedUrl: photoUrl } = await uploadAndGetSignedUrl("china-documentos", path, file);
            await supabase.from("china_produto_documentos" as any).insert({
              submissao_id: subId,
              tipo_documento: tipo,
              arquivo_url: photoUrl,
              arquivo_path: path,
              nome_arquivo: file.name,
              status: "pendente",
            } as any);
            setDocs(d => ({ ...d, [tipo]: [...(d[tipo] || []), { fileName: file.name, status: "pendente" as const }] }));
          }
        }
      }

      setPendingAiData(null);
      toast.success("✅ Dados validados e salvos! 数据已验证并保存！");
    } catch (err: any) {
      console.error("Validation confirm error:", err);
      toast.error(err.message || "Erro ao salvar dados validados");
    }
  }, [pendingSourceFile]);

  // Step 1: Parse Excel with AI
  const handleExcelUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("file", file);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/parse-china-excel`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      if (resp.status === 429) { toast.error("Limite de requisições excedido. 请求限制已超过"); return; }
      if (resp.status === 402) { toast.error("Créditos de IA esgotados. AI积分已用完"); return; }
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to parse");
      }

      const data = await resp.json();
      if (data.error) { toast.error(data.error); return; }
      await processAiResponse(data, file, "planilha_excel");
      toast.success("🤖 IA extraiu os dados com sucesso! AI成功提取数据！");
    } catch (err: any) {
      console.error("Excel parse error:", err);
      toast.error(err.message || "Erro ao processar 处理时出错");
    } finally {
      setParsing(false);
    }
  }, [processAiResponse]);

  // Image upload handler
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie apenas imagens. 仅上传图片"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Imagem muito grande (máx 10MB). 图片太大"); return; }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      const mimeType = file.type || "image/png";

      setParsing(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const resp = await fetch(
          `https://${projectId}.supabase.co/functions/v1/parse-china-excel`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: base64, imageMimeType: mimeType }),
          }
        );

        if (resp.status === 429) { toast.error("Limite de requisições excedido. 请求限制已超过"); return; }
        if (resp.status === 402) { toast.error("Créditos de IA esgotados. AI积分已用完"); return; }
        if (!resp.ok) throw new Error("Failed to parse image");

        const data = await resp.json();
        await processAiResponse(data, file, "foto_referencia");
        toast.success("🤖 IA analisou a imagem com sucesso! AI成功分析图片！");
      } catch (err: any) {
        console.error(err);
        toast.error("Erro ao analisar imagem 分析图片时出错");
      } finally {
        setParsing(false);
      }
    };
    reader.readAsDataURL(file);
  }, [processAiResponse]);

  // Manual entry handler
  const handleManualEntry = useCallback(async () => {
    if (!manualData.produto_codigo || !manualData.produto_nome) {
      toast.error("Código e Nome do produto são obrigatórios 产品代码和名称必填");
      return;
    }
    setParsing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data: sub, error } = await supabase
        .from("china_produto_submissoes" as any)
        .insert({
          produto_codigo: manualData.produto_codigo,
          produto_nome: manualData.produto_nome,
          numero_item: manualData.numero_item || null,
          numero_ordem: manualData.numero_ordem || null,
          formula_codigo: manualData.formula_codigo || null,
          qty_total: manualData.qty_total ? parseInt(manualData.qty_total) : null,
          dados_excel: { _manual: true, ...manualData },
          created_by: session.user.id,
          status: "rascunho",
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      setSubmissaoId((sub as any).id);
      setParsedData({ _manual: true, ...manualData });
      toast.success("Dados salvos! 数据已保存！");
      setStep(1);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar 保存错误");
    } finally {
      setParsing(false);
    }
  }, [manualData]);

  // Step 2: Upload documents
  const handleDocUpload = useCallback(async (tipo: string, file: File) => {
    if (!submissaoId) return;
    const path = `${submissaoId}/${tipo}/${file.name}`;
    const { signedUrl, error } = await uploadAndGetSignedUrl("china-documentos", path, file);
    if (error) { toast.error("Erro no upload 上传错误"); return; }
    await supabase.from("china_produto_documentos" as any).insert({
      submissao_id: submissaoId,
      tipo_documento: tipo,
      arquivo_url: signedUrl,
      arquivo_path: path,
      nome_arquivo: file.name,
      status: "pendente",
    } as any);
    setDocs(d => ({ ...d, [tipo]: [...(d[tipo] || []), { fileName: file.name, status: "pendente" as const }] }));
    toast.success("Arquivo enviado! 文件已上传！");
  }, [submissaoId]);

  // Final submit — opens review dialog
  const handleOpenFinalReview = useCallback(() => {
    setShowFinalReview(true);
  }, []);

  // Confirm send to Brazil
  const handleConfirmSend = useCallback(async () => {
    if (!submissaoId) return;
    setSubmitting(true);
    try {
      if (gradeItems.length > 0) {
        await supabase.from("china_produto_cores" as any).delete().eq("submissao_id", submissaoId);
        await supabase.from("china_produto_cores" as any).insert(
          gradeItems.map((item, i) => ({
            submissao_id: submissaoId,
            grupo: item.grupo || "A",
            cor_nome: item.cor_nome,
            cor_hex: item.cor_hex || null,
            cor_numero: item.cor_numero || null,
            codigo_produto: item.codigo_produto || null,
            codigo_barras_ean: item.codigo_barras_ean || null,
            quantidade: item.quantidade,
            ordem: i,
          }))
        );
      }

      await supabase
        .from("china_produto_submissoes" as any)
        .update({
          peso_bruto_g: weights.peso_bruto_g ? parseFloat(weights.peso_bruto_g) : null,
          peso_liquido_g: weights.peso_liquido_g ? parseFloat(weights.peso_liquido_g) : null,
          peso_tester_g: weights.peso_tester_g ? parseFloat(weights.peso_tester_g) : null,
          medidas_display: {
            largura: weights.display_largura ? parseFloat(weights.display_largura) : null,
            altura: weights.display_altura ? parseFloat(weights.display_altura) : null,
            profundidade: weights.display_profundidade ? parseFloat(weights.display_profundidade) : null,
          },
          status: "enviado",
        } as any)
        .eq("id", submissaoId);

      toast.success("✅ Submissão enviada para o Brasil! 提交已发送至巴西！");
      setShowFinalReview(false);
      navigate("/dashboard/fabrica-china/recebimentos");
    } catch (err: any) {
      toast.error("Erro ao enviar 发送错误");
    } finally {
      setSubmitting(false);
    }
  }, [submissaoId, weights, gradeItems, navigate]);

  // Review checklist computation
  const totalDocSlots = CHINA_DOCUMENT_TYPES.length;
  const filledDocSlots = Object.keys(docs).filter(k => docs[k]?.length > 0).length;
  const hasMandatoryDocs = MANDATORY_DOCS.every(tipo => docs[tipo]?.length > 0);
  const hasWeights = !!(weights.peso_bruto_g || weights.peso_liquido_g);
  const hasProductData = !!(productInfo?.produto_codigo);

  if (loadingExisting && editId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Read-only lock banner */}
        {isReadOnly && (
          <Card className="p-4 border-warning/30 bg-warning/5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                <LockKeyhole className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="font-semibold text-warning text-sm">
                  Esta submissão já foi enviada e não pode ser alterada. 此提交已发送，无法更改。
                </p>
                <p className="text-xs text-muted-foreground">
                  Para visualizar detalhes, acesse a ficha do produto. 要查看详细信息，请访问产品档案。
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => navigate(`/dashboard/fabrica-china/produto/${editId}`)}
              >
                Ver Ficha 查看档案
              </Button>
            </div>
          </Card>
        )}

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica-china")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <BilingualLabel pt={editId ? "Continuar Submissão" : "Nova Submissão"} cn={editId ? "继续提交" : "新提交"} size="lg" />
            {submissaoId && !isReadOnly && (
              <Badge variant="secondary" className="mt-1 text-xs">
                <Save className="h-3 w-3 mr-1" /> Rascunho 草稿
              </Badge>
            )}
          </div>
          <ManualFabricaDrawer screen="china-nova-submissao" />
          {/* Save Draft button — only when not read-only */}
          {submissaoId && !isReadOnly && (
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="gap-2"
            >
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden md:inline">Salvar Rascunho</span>
              <span className="md:hidden">Salvar</span>
              <span className="text-xs text-muted-foreground ml-1 hidden lg:inline">保存草稿</span>
            </Button>
          )}
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  i === step
                    ? "bg-primary text-primary-foreground shadow-md"
                    : i < step
                    ? "bg-success/10 text-success cursor-pointer hover:bg-success/20"
                    : submissaoId
                    ? "bg-muted text-muted-foreground cursor-pointer hover:bg-muted/80"
                    : "bg-muted text-muted-foreground opacity-50"
                }`}
                onClick={() => {
                  // Allow navigating to any step if we have a submission
                  if (submissaoId || i <= step) setStep(i);
                }}
                disabled={!submissaoId && i > step}
              >
                {i < step ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <s.icon className="h-4 w-4" />
                )}
                <BilingualLabel pt={s.labelPt} cn={s.labelCn} size="sm" />
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Product Preview Card — visible on steps 1 and 2 */}
        {productInfo && step > 0 && (
          <Collapsible open={showProductPreview} onOpenChange={setShowProductPreview}>
            <Card className="p-4 border-primary/20 bg-primary/5">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-3 w-full text-left">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">
                      {productInfo.produto_codigo || existingSubmissao?.produto_codigo}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {productInfo.produto_nome || existingSubmissao?.produto_nome}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {showProductPreview ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {showProductPreview ? "Ocultar 隐藏" : "Ver Produto 查看产品"}
                  </Badge>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(productInfo.numero_item || existingSubmissao?.numero_item) && (
                    <div className="p-2 bg-background rounded-lg">
                      <p className="text-[10px] text-muted-foreground">Nº Item 项目号</p>
                      <p className="text-sm font-semibold">{productInfo.numero_item || existingSubmissao?.numero_item}</p>
                    </div>
                  )}
                  {(productInfo.numero_ordem || existingSubmissao?.numero_ordem) && (
                    <div className="p-2 bg-background rounded-lg">
                      <p className="text-[10px] text-muted-foreground">Nº Ordem 订单号</p>
                      <p className="text-sm font-semibold">{productInfo.numero_ordem || existingSubmissao?.numero_ordem}</p>
                    </div>
                  )}
                  {(productInfo.formula_codigo || existingSubmissao?.formula_codigo) && (
                    <div className="p-2 bg-background rounded-lg">
                      <p className="text-[10px] text-muted-foreground">Fórmula 配方</p>
                      <p className="text-sm font-semibold">{productInfo.formula_codigo || existingSubmissao?.formula_codigo}</p>
                    </div>
                  )}
                  {(productInfo.qty_total || existingSubmissao?.qty_total) && (
                    <div className="p-2 bg-background rounded-lg">
                      <p className="text-[10px] text-muted-foreground">Qty Total 总量</p>
                      <p className="text-sm font-semibold">{(productInfo.qty_total || existingSubmissao?.qty_total)?.toLocaleString()}</p>
                    </div>
                  )}
                  {(productInfo.ean_display || existingSubmissao?.ean_display) && (
                    <div className="p-2 bg-background rounded-lg">
                      <p className="text-[10px] text-muted-foreground">EAN Display</p>
                      <p className="text-sm font-mono font-semibold">{productInfo.ean_display || existingSubmissao?.ean_display}</p>
                    </div>
                  )}
                  {(productInfo.ean_caixa_master || existingSubmissao?.ean_caixa_master) && (
                    <div className="p-2 bg-background rounded-lg">
                      <p className="text-[10px] text-muted-foreground">EAN Caixa Master</p>
                      <p className="text-sm font-mono font-semibold">{productInfo.ean_caixa_master || existingSubmissao?.ean_caixa_master}</p>
                    </div>
                  )}
                </div>
                {gradeItems.length > 0 && (
                  <div className="mt-3 p-2 bg-background rounded-lg">
                    <p className="text-[10px] text-muted-foreground mb-1">Grade 色号 ({gradeItems.length} cores)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {gradeItems.slice(0, 12).map((g) => (
                        <div key={g.id} className="flex items-center gap-1 text-xs bg-secondary/50 rounded px-1.5 py-0.5">
                          {g.cor_hex && <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: g.cor_hex }} />}
                          <span>{g.cor_nome}</span>
                          <span className="text-muted-foreground">×{g.quantidade}</span>
                        </div>
                      ))}
                      {gradeItems.length > 12 && <span className="text-xs text-muted-foreground">+{gradeItems.length - 12}</span>}
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Step 1: Excel or Image Upload */}
        {step === 0 && (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-6">
              <div className="h-24 w-24 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
              <BilingualLabel pt="Importar Dados do Produto" cn="导入产品数据" size="lg" className="text-center" />
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Envie a planilha Excel ou uma foto/print do produto. A IA irá extrair automaticamente todas as informações.
                <br />
                上传Excel表格或产品照片/截图。AI将自动提取所有信息。
              </p>

               {!parsedData && !manualMode ? (
                <div className="w-full max-w-lg space-y-4">
                  {/* Excel Upload */}
                  <div className="relative">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      disabled={parsing}
                    />
                    <div className="border-2 border-dashed border-primary/30 rounded-xl p-6 text-center hover:border-primary/60 transition-colors">
                      {parsing ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm font-medium text-primary">🤖 IA analisando... AI分析中...</p>
                        </div>
                      ) : (
                        <>
                          <FileSpreadsheet className="h-8 w-8 mx-auto text-primary mb-2" />
                          <p className="text-sm font-medium">Planilha Excel 表格</p>
                          <p className="text-xs text-muted-foreground">.xlsx, .xls</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground font-medium">OU 或</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Image Upload */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={parsing}
                  />

                  {imagePreview ? (
                    <div className="relative border rounded-xl p-3 bg-muted/30">
                      <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded object-contain" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setImagePreview(null);
                          if (imageInputRef.current) imageInputRef.current.value = "";
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      {parsing && (
                        <div className="absolute inset-0 bg-background/60 rounded-xl flex items-center justify-center">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-medium text-primary">🤖 IA analisando imagem...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-20 border-dashed border-2 gap-2"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={parsing}
                    >
                      <ImageIcon className="h-6 w-6" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Foto ou Print 照片或截图</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP (máx 10MB)</p>
                      </div>
                    </Button>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground font-medium">OU 或</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Manual Entry */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-20 border-dashed border-2 gap-2"
                    onClick={() => setManualMode(true)}
                    disabled={parsing}
                  >
                    <PenLine className="h-6 w-6" />
                    <div className="text-left">
                      <p className="text-sm font-medium">Lançamento Manual 手动输入</p>
                      <p className="text-xs text-muted-foreground">Preencher dados manualmente 手动填写数据</p>
                    </div>
                  </Button>
                </div>
              ) : manualMode && !parsedData ? (
                /* Manual entry form */
                <div className="w-full max-w-lg space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Código do Produto 产品代码 *</Label>
                      <Input
                        value={manualData.produto_codigo}
                        onChange={(e) => setManualData(d => ({ ...d, produto_codigo: e.target.value }))}
                        placeholder="Ex: HB-9900"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Nº Item 项目号</Label>
                      <Input
                        value={manualData.numero_item}
                        onChange={(e) => setManualData(d => ({ ...d, numero_item: e.target.value }))}
                        placeholder="Ex: 001"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Nome do Produto 产品名称 *</Label>
                    <Input
                      value={manualData.produto_nome}
                      onChange={(e) => setManualData(d => ({ ...d, produto_nome: e.target.value }))}
                      placeholder="Ex: Base Líquida HD Coverage"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Fórmula 配方</Label>
                      <Input
                        value={manualData.formula_codigo}
                        onChange={(e) => setManualData(d => ({ ...d, formula_codigo: e.target.value }))}
                        placeholder="Ex: F-1234"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Nº Ordem 订单号</Label>
                      <Input
                        value={manualData.numero_ordem}
                        onChange={(e) => setManualData(d => ({ ...d, numero_ordem: e.target.value }))}
                        placeholder="Ex: ORD-2026"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Quantidade Total 总数量</Label>
                    <Input
                      type="number"
                      value={manualData.qty_total}
                      onChange={(e) => setManualData(d => ({ ...d, qty_total: e.target.value }))}
                      placeholder="Ex: 15000"
                      className="mt-1"
                    />
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setManualMode(false)}>
                      Voltar 返回
                    </Button>
                    <Button onClick={handleManualEntry} disabled={parsing} className="gap-2">
                      {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Confirmar e Avançar 确认并继续
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  {aiExtracted && (
                    <div className="flex items-center gap-2 justify-center">
                      <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
                        <Sparkles className="h-3 w-3" />
                        Dados extraídos por IA · AI提取的数据
                      </Badge>
                    </div>
                  )}
                  <ChinaExcelPreview data={parsedData} />
                  <div className="flex justify-end">
                    <Button onClick={() => setStep(1)} className="gap-2">
                      Próximo 下一步 <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 2: Document Checklist */}
        {step === 1 && (
          <Card className="p-6 space-y-6">
            <BilingualLabel pt="Checklist de Documentos" cn="文件清单" size="lg" />

            {/* Grouped by category */}
            {DOCUMENT_CATEGORIES.map((cat) => {
              const catDocs = CHINA_DOCUMENT_TYPES.filter(d => cat.tipos.includes(d.tipo));
              return (
                <div key={cat.key} className="space-y-3">
                  <BilingualLabel pt={cat.labelPt} cn={cat.labelCn} size="md" className="border-b border-border pb-2" />
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {catDocs.map((config) => {
                      const typeFiles = docs[config.tipo] || [];
                      const worstStatus = typeFiles.length === 0 ? "none"
                        : typeFiles.some(f => f.status === "rejeitado") ? "rejeitado"
                        : typeFiles.some(f => f.status === "pendente") ? "pendente"
                        : "aprovado";
                      return (
                        <ChinaDocumentSlot
                          key={config.tipo}
                          config={config}
                          status={worstStatus as any}
                          files={typeFiles.map((f, i) => ({ id: `local-${i}`, name: f.fileName, status: f.status }))}
                          onUpload={isReadOnly ? undefined : (file) => handleDocUpload(config.tipo, file)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Mandatory docs warning */}
            {MANDATORY_DOCS.some(tipo => !docs[tipo]?.length) && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
                ⚠️ Foto e vídeo da amostra são obrigatórios para aprovação. 照片和视频样品是审批所必需的。
              </div>
            )}

            {/* Grade Editor */}
            {isReadOnly ? (
              <div className="opacity-60 pointer-events-none">
                <ChinaGradeEditor items={gradeItems} onChange={() => {}} />
              </div>
            ) : (
              <ChinaGradeEditor items={gradeItems} onChange={setGradeItems} />
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                Voltar 返回
              </Button>
              <Button onClick={() => setStep(2)} className="gap-2">
                Próximo 下一步 <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 3: Weights & Measures */}
        {step === 2 && (
          <Card className="p-6">
            <BilingualLabel pt="Pesos e Medidas" cn="重量和尺寸" size="lg" className="mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <BilingualLabel pt="Pesos do Produto" cn="产品重量" size="md" />
                <div>
                  <Label className="text-sm">Peso Bruto (g) 毛重</Label>
                  <Input type="number" step="0.01" value={weights.peso_bruto_g} onChange={(e) => setWeights(w => ({ ...w, peso_bruto_g: e.target.value }))} placeholder="Ex: 23.85" className="text-lg h-12" disabled={isReadOnly} />
                </div>
                <div>
                  <Label className="text-sm">Peso Líquido (g) 净重</Label>
                  <Input type="number" step="0.01" value={weights.peso_liquido_g} onChange={(e) => setWeights(w => ({ ...w, peso_liquido_g: e.target.value }))} placeholder="Ex: 6.68" className="text-lg h-12" disabled={isReadOnly} />
                </div>
                <div>
                  <Label className="text-sm">Peso Tester (g) 试用装重量</Label>
                  <Input type="number" step="0.01" value={weights.peso_tester_g} onChange={(e) => setWeights(w => ({ ...w, peso_tester_g: e.target.value }))} placeholder="Ex: 3.5" className="text-lg h-12" disabled={isReadOnly} />
                </div>
              </div>
              <div className="space-y-4">
                <BilingualLabel pt="Medidas do Display" cn="展示尺寸" size="md" />
                <div>
                  <Label className="text-sm">Largura (cm) 宽度</Label>
                  <Input type="number" step="0.1" value={weights.display_largura} onChange={(e) => setWeights(w => ({ ...w, display_largura: e.target.value }))} className="text-lg h-12" disabled={isReadOnly} />
                </div>
                <div>
                  <Label className="text-sm">Altura (cm) 高度</Label>
                  <Input type="number" step="0.1" value={weights.display_altura} onChange={(e) => setWeights(w => ({ ...w, display_altura: e.target.value }))} className="text-lg h-12" disabled={isReadOnly} />
                </div>
                <div>
                  <Label className="text-sm">Profundidade (cm) 深度</Label>
                  <Input type="number" step="0.1" value={weights.display_profundidade} onChange={(e) => setWeights(w => ({ ...w, display_profundidade: e.target.value }))} className="text-lg h-12" disabled={isReadOnly} />
                </div>
              </div>
            </div>
            {!isReadOnly && (
              <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Voltar 返回
                </Button>
                <Button
                  onClick={handleOpenFinalReview}
                  disabled={submitting}
                  variant="gradient"
                  size="lg"
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Revisar e Enviar 审核并发送
                </Button>
              </div>
            )}
            {isReadOnly && (
              <div className="flex justify-between mt-8">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Voltar 返回
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* Final Review Dialog */}
        <Dialog open={showFinalReview} onOpenChange={setShowFinalReview}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                <BilingualLabel pt="Revisão Final" cn="最终审核" size="lg" />
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground">
                Revise os itens abaixo antes de enviar ao Brasil. Após o envio, a submissão não poderá ser editada.
                <br />
                <span className="text-xs">发送前请检查以下项目。发送后将无法编辑。</span>
              </p>

              {/* Checklist */}
              <div className="space-y-2">
                <ChecklistItem ok={hasProductData} label="Dados do Produto 产品数据" />
                <ChecklistItem ok={filledDocSlots > 0} label={`Documentos (${filledDocSlots}/${totalDocSlots} tipos) 文件`} />
                <ChecklistItem ok={hasMandatoryDocs} label="Foto + Vídeo obrigatórios 必需照片+视频" warning={!hasMandatoryDocs} />
                <ChecklistItem ok={hasWeights} label="Pesos informados 重量信息" />
                <ChecklistItem ok={gradeItems.length > 0} label={`Grade de cores (${gradeItems.length} itens) 色号`} />
              </div>

              {!hasMandatoryDocs && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Documentos obrigatórios estão faltando. Você pode enviar assim mesmo, mas a aprovação poderá ser atrasada. 缺少必需文件，可能会延迟审批。</span>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setShowFinalReview(false)}>
                Voltar ao Rascunho 返回草稿
              </Button>
              <Button
                onClick={handleConfirmSend}
                disabled={submitting || !hasProductData}
                variant="gradient"
                className="gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Confirmar Envio 确认发送
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Validation Dialog */}
        {pendingAiData && (
          <ChinaDataValidationDialog
            open={validationOpen}
            onOpenChange={(open) => {
              setValidationOpen(open);
              if (!open) setPendingAiData(null);
            }}
            initialData={pendingAiData}
            onConfirm={handleValidationConfirm}
            mode="new"
          />
        )}
      </div>
    </div>
  );
}

function ChecklistItem({ ok, label, warning }: { ok: boolean; label: string; warning?: boolean }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
      {ok ? (
        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
      ) : warning ? (
        <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
      ) : (
        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
      )}
      <span className={`text-sm ${ok ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, FileSpreadsheet, Check, Loader2, ChevronRight, Scale, ImageIcon, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BilingualLabel } from "@/components/china/BilingualLabel";
import { ChinaExcelPreview } from "@/components/china/ChinaExcelPreview";
import { ChinaDocumentSlot } from "@/components/china/ChinaDocumentSlot";
import { ChinaGradeEditor, type GradeItem } from "@/components/china/ChinaGradeEditor";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES, MANDATORY_DOCS } from "@/lib/china-document-types";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl } from "@/lib/utils/storage-helper";
import { toast } from "sonner";

const STEPS = [
  { labelPt: "Dados do Produto", labelCn: "产品数据", icon: FileSpreadsheet },
  { labelPt: "Documentos", labelCn: "文件", icon: Upload },
  { labelPt: "Pesos e Medidas", labelCn: "重量和尺寸", icon: Scale },
];

export default function ChinaNovaSubmissao() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [submissaoId, setSubmissaoId] = useState<string | null>(null);
  const [docs, setDocs] = useState<Record<string, { fileName: string; status: "pendente" | "aprovado" | "rejeitado" }>>({});
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

  // Process AI response (shared between Excel and image)
  const processAiResponse = useCallback(async (data: any, sourceFile?: File, sourceType?: string) => {
    if (data.error) {
      toast.error(data.error);
      return;
    }

    setParsedData(data);
    setAiExtracted(!!data._ai_extracted);

    // Pre-fill weights
    if (data.peso_bruto_g) setWeights(w => ({ ...w, peso_bruto_g: String(data.peso_bruto_g) }));
    if (data.peso_liquido_g) setWeights(w => ({ ...w, peso_liquido_g: String(data.peso_liquido_g) }));

    // Create submission record
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const { data: sub, error } = await supabase
      .from("china_produto_submissoes" as any)
      .insert({
        produto_codigo: data.produto_codigo || "UNKNOWN",
        produto_nome: data.produto_nome || "UNKNOWN",
        numero_item: data.numero_item || null,
        numero_ordem: data.numero_ordem || null,
        formula_codigo: data.formula_codigo || null,
        qty_total: data.qty_total || null,
        peso_bruto_g: data.peso_bruto_g || null,
        peso_liquido_g: data.peso_liquido_g || null,
        dados_excel: data,
        created_by: session.user.id,
        status: "rascunho",
      } as any)
      .select("id")
      .single();

    if (error) throw error;
    setSubmissaoId((sub as any).id);

    // Populate grade items
    if (data.cores?.length > 0) {
      const parsed: GradeItem[] = data.cores.map((c: any) => ({
        id: crypto.randomUUID(),
        cor_nome: c.cor_nome || "",
        cor_hex: "",
        cor_numero: "",
        codigo_produto: "",
        codigo_barras_ean: "",
        quantidade: c.quantidade || 0,
        grupo: c.grupo || "A",
      }));
      setGradeItems(parsed);
    }

    // Upload source file as document
    if (sourceFile) {
      const tipo = sourceType || "planilha_excel";
      const path = `${(sub as any).id}/${tipo}/${sourceFile.name}`;
      const { signedUrl } = await uploadAndGetSignedUrl("china-documentos", path, sourceFile);
      await supabase.from("china_produto_documentos" as any).insert({
        submissao_id: (sub as any).id,
        tipo_documento: tipo,
        arquivo_url: signedUrl,
        arquivo_path: path,
        nome_arquivo: sourceFile.name,
        status: "pendente",
      } as any);
      setDocs(d => ({ ...d, [tipo]: { fileName: sourceFile.name, status: "pendente" } }));
    }
  }, []);

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

      if (resp.status === 429) {
        toast.error("Limite de requisições excedido. Tente novamente. 请求限制已超过");
        return;
      }
      if (resp.status === 402) {
        toast.error("Créditos de IA esgotados. AI积分已用完");
        return;
      }
      if (!resp.ok) throw new Error("Failed to parse");

      const data = await resp.json();
      await processAiResponse(data, file, "planilha_excel");
      toast.success("🤖 IA extraiu os dados com sucesso! AI成功提取数据！");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar 处理时出错");
    } finally {
      setParsing(false);
    }
  }, [processAiResponse]);

  // Image upload handler
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie apenas imagens (PNG, JPG, WEBP). 仅上传图片");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 10MB). 图片太大");
      return;
    }

    // Show preview
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
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ imageBase64: base64, imageMimeType: mimeType }),
          }
        );

        if (resp.status === 429) {
          toast.error("Limite de requisições excedido. 请求限制已超过");
          return;
        }
        if (resp.status === 402) {
          toast.error("Créditos de IA esgotados. AI积分已用完");
          return;
        }
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

  // Step 2: Upload documents
  const handleDocUpload = useCallback(async (tipo: string, file: File) => {
    if (!submissaoId) return;
    const path = `${submissaoId}/${tipo}/${file.name}`;
    const { signedUrl, error } = await uploadAndGetSignedUrl("china-documentos", path, file);
    if (error) {
      toast.error("Erro no upload 上传错误");
      return;
    }
    await supabase.from("china_produto_documentos" as any).insert({
      submissao_id: submissaoId,
      tipo_documento: tipo,
      arquivo_url: signedUrl,
      arquivo_path: path,
      nome_arquivo: file.name,
      status: "pendente",
    } as any);
    setDocs(d => ({ ...d, [tipo]: { fileName: file.name, status: "pendente" } }));
    toast.success("Arquivo enviado! 文件已上传！");
  }, [submissaoId]);

  // Step 3: Submit
  const handleSubmit = useCallback(async () => {
    if (!submissaoId) return;
    setSubmitting(true);
    try {
      // Save grade items to DB
      if (gradeItems.length > 0) {
        // Delete old cores
        await supabase.from("china_produto_cores" as any).delete().eq("submissao_id", submissaoId);
        // Insert updated ones
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

      toast.success("Submissão enviada para aprovação! 提交已发送审批！");
      navigate("/dashboard/fabrica-china/recebimentos");
    } catch (err: any) {
      toast.error("Erro ao enviar 发送错误");
    } finally {
      setSubmitting(false);
    }
  }, [submissaoId, weights, gradeItems, navigate]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/fabrica-china")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BilingualLabel pt="Nova Submissão" cn="新提交" size="lg" />
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  i === step
                    ? "bg-primary text-primary-foreground shadow-md"
                    : i < step
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <s.icon className="h-4 w-4" />
                )}
                <BilingualLabel pt={s.labelPt} cn={s.labelCn} size="sm" />
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

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

              {!parsedData ? (
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
                    {catDocs.map((config) => (
                      <ChinaDocumentSlot
                        key={config.tipo}
                        config={config}
                        status={docs[config.tipo]?.status || "none"}
                        fileName={docs[config.tipo]?.fileName}
                        onUpload={(file) => handleDocUpload(config.tipo, file)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Mandatory docs warning */}
            {MANDATORY_DOCS.some(tipo => !docs[tipo]) && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
                ⚠️ Foto e vídeo da amostra são obrigatórios para aprovação. 照片和视频样品是审批所必需的。
              </div>
            )}

            {/* Grade Editor */}
            <ChinaGradeEditor items={gradeItems} onChange={setGradeItems} />

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
                  <Input
                    type="number"
                    step="0.01"
                    value={weights.peso_bruto_g}
                    onChange={(e) => setWeights(w => ({ ...w, peso_bruto_g: e.target.value }))}
                    placeholder="Ex: 23.85"
                    className="text-lg h-12"
                  />
                </div>
                <div>
                  <Label className="text-sm">Peso Líquido (g) 净重</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={weights.peso_liquido_g}
                    onChange={(e) => setWeights(w => ({ ...w, peso_liquido_g: e.target.value }))}
                    placeholder="Ex: 6.68"
                    className="text-lg h-12"
                  />
                </div>
                <div>
                  <Label className="text-sm">Peso Tester (g) 试用装重量</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={weights.peso_tester_g}
                    onChange={(e) => setWeights(w => ({ ...w, peso_tester_g: e.target.value }))}
                    placeholder="Ex: 3.5"
                    className="text-lg h-12"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <BilingualLabel pt="Medidas do Display" cn="展示尺寸" size="md" />
                <div>
                  <Label className="text-sm">Largura (cm) 宽度</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={weights.display_largura}
                    onChange={(e) => setWeights(w => ({ ...w, display_largura: e.target.value }))}
                    className="text-lg h-12"
                  />
                </div>
                <div>
                  <Label className="text-sm">Altura (cm) 高度</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={weights.display_altura}
                    onChange={(e) => setWeights(w => ({ ...w, display_altura: e.target.value }))}
                    className="text-lg h-12"
                  />
                </div>
                <div>
                  <Label className="text-sm">Profundidade (cm) 深度</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={weights.display_profundidade}
                    onChange={(e) => setWeights(w => ({ ...w, display_profundidade: e.target.value }))}
                    className="text-lg h-12"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={() => setStep(1)}>
                Voltar 返回
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                variant="gradient"
                size="lg"
                className="gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Enviar para Aprovação 提交审批
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

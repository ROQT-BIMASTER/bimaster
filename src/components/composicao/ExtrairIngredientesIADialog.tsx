import { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sparkles, Upload, FileText, Loader2, AlertTriangle, CheckCircle2, X,
  Eye, ShieldCheck, FileSearch,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FUNCAO_OPTIONS, type Composicao } from "@/hooks/useComposicao";
import { validateFileForUpload } from "@/lib/utils/file-security";
import { auditSensitiveAction } from "@/lib/utils/sensitive-audit";
import { getSignedUrl } from "@/lib/utils/storage-helper";

interface ExtractedIngredient {
  nome_chines: string | null;
  inci_name: string;
  cas_no: string | null;
  funcao: string;
  percentual: number;
  cor_key?: string;
  selected: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissaoId: string;
  cores: string[];
  currentVersion: number;
  onIngredientesExtraidos: (items: Partial<Composicao>[]) => void;
}

type Step = "select" | "preview" | "results";

export function ExtrairIngredientesIADialog({
  open, onOpenChange, submissaoId, cores, currentVersion, onIngredientesExtraidos,
}: Props) {
  const [step, setStep] = useState<Step>("select");
  const [tab, setTab] = useState<"upload" | "processo">("upload");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedIngredient[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processoDocs, setProcessoDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [previewSource, setPreviewSource] = useState<"upload" | "processo">("upload");
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setStep("select");
      setExtractedItems([]);
      setObservacoes("");
      setSelectedFile(null);
      setProcessoDocs([]);
      setPreviewDoc(null);
      setPreviewUrl(null);
      setPreviewFileName("");
      setTermsAccepted(false);
    }
  }, [open]);

  const loadProcessoDocs = async () => {
    setLoadingDocs(true);
    try {
      // 1. Buscar vínculos com info do projeto/seção
      const { data: vinculos } = await (supabase
        .from("china_documento_tarefa_vinculos" as any)
        .select("documento_id, projeto:projetos(nome), secao:projeto_secoes(nome)") as any);

      if (!vinculos || vinculos.length === 0) {
        setProcessoDocs([]);
        return;
      }

      // Build map: documento_id -> checklist labels
      const docChecklistMap: Record<string, string[]> = {};
      (vinculos as any[]).forEach((v: any) => {
        const labels: string[] = [];
        if (v.projeto?.nome) labels.push(v.projeto.nome);
        if (v.secao?.nome) labels.push(v.secao.nome);
        const label = labels.join(" › ") || "Vinculado";
        if (!docChecklistMap[v.documento_id]) docChecklistMap[v.documento_id] = [];
        if (!docChecklistMap[v.documento_id].includes(label)) {
          docChecklistMap[v.documento_id].push(label);
        }
      });

      const docIds = Object.keys(docChecklistMap);

      // 2. Buscar documentos vinculados
      const { data } = await supabase
        .from("china_produto_documentos")
        .select("id, tipo_documento, nome_arquivo, arquivo_url, arquivo_path, status")
        .eq("submissao_id", submissaoId)
        .in("id", docIds)
        .order("created_at", { ascending: false });

      // Attach checklist info
      const docsWithChecklist = (data || []).map((doc: any) => ({
        ...doc,
        checklists: docChecklistMap[doc.id] || [],
      }));

      setProcessoDocs(docsWithChecklist);
    } catch {
      toast.error("Erro ao carregar documentos do processo");
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validateFileForUpload(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // -- Preview step --
  const openPreviewForUpload = () => {
    if (!selectedFile) return;
    setPreviewSource("upload");
    setPreviewDoc(null);
    setPreviewFileName(selectedFile.name);

    // Create object URL for preview
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    setTermsAccepted(false);
    setStep("preview");
  };

  const openPreviewForDoc = async (doc: any) => {
    setPreviewSource("processo");
    setPreviewDoc(doc);
    setPreviewFileName(doc.nome_arquivo || doc.tipo_documento);
    setTermsAccepted(false);
    setLoadingPreview(true);
    setStep("preview");

    try {
      if (doc.arquivo_path) {
        const { signedUrl } = await getSignedUrl("china-documentos", doc.arquivo_path);
        setPreviewUrl(signedUrl || doc.arquivo_url || null);
      } else {
        setPreviewUrl(doc.arquivo_url || null);
      }
    } catch {
      setPreviewUrl(doc.arquivo_url || null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const isImageFile = (name: string) => /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(name);
  const isPdfFile = (name: string) => /\.pdf$/i.test(name);

  // -- Audit logging --
  const logExtractionAudit = async (action: string, docName: string, docId?: string) => {
    await auditSensitiveAction({
      action,
      category: "ACCESS",
      entityType: "composicao_extracao_ia",
      entityId: docId || submissaoId,
      metadata: {
        submissao_id: submissaoId,
        documento_nome: docName,
        documento_id: docId || null,
        termos_aceitos: true,
        aceite_timestamp: new Date().toISOString(),
      },
    });
  };

  // -- Extraction --
  const proceedExtraction = async () => {
    if (!termsAccepted) {
      toast.error("Aceite o termo de responsabilidade para prosseguir.");
      return;
    }

    setIsExtracting(true);
    try {
      if (previewSource === "upload" && selectedFile) {
        await logExtractionAudit("extracao_ia_upload", selectedFile.name);

        let payload: any = {};
        if (selectedFile.type.startsWith("image/")) {
          const base64 = await fileToBase64(selectedFile);
          payload.document_url = base64;
        } else {
          const text = await selectedFile.text();
          payload.document_text = text;
        }
        await callExtractionAPI(payload);
      } else if (previewSource === "processo" && previewDoc) {
        await logExtractionAudit("extracao_ia_processo", previewFileName, previewDoc.id);

        let payload: any = {};
        const url = previewUrl || previewDoc.arquivo_url;
        if (url) {
          const isImage = /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(url);
          if (isImage) {
            payload.document_url = url;
          } else {
            payload.document_text = `Documento: ${previewFileName}\nURL: ${url}\n\nPor favor extraia os ingredientes deste documento.`;
            payload.document_url = url;
          }
        }
        await callExtractionAPI(payload);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao extrair ingredientes");
    } finally {
      setIsExtracting(false);
    }
  };

  const callExtractionAPI = async (payload: any) => {
    const { data, error } = await supabase.functions.invoke("extrair-ingredientes-ia", {
      body: payload,
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    const items: ExtractedIngredient[] = (data.ingredientes || []).map((ing: any) => ({
      nome_chines: ing.nome_chines || null,
      inci_name: ing.inci_name || "",
      cas_no: ing.cas_no || null,
      funcao: ing.funcao || "outros",
      percentual: ing.percentual || 0,
      cor_key: ing.cor_key || cores[0] || "1#",
      selected: true,
    }));

    setExtractedItems(items);
    setObservacoes(data.observacoes || "");
    setStep("results");
    toast.success(`${items.length} ingrediente(s) identificado(s) pela IA`);
  };

  const toggleItem = (idx: number) => {
    setExtractedItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, selected: !item.selected } : item
    ));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setExtractedItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
  };

  const handleConfirm = async () => {
    const selected = extractedItems.filter(i => i.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um ingrediente");
      return;
    }

    // Audit log for confirmation
    await auditSensitiveAction({
      action: "extracao_ia_confirmada",
      category: "ACCESS",
      entityType: "composicao_extracao_ia",
      entityId: submissaoId,
      metadata: {
        submissao_id: submissaoId,
        ingredientes_total: extractedItems.length,
        ingredientes_selecionados: selected.length,
        documento_nome: previewFileName,
      },
    });

    const newItems: Partial<Composicao>[] = selected.map(item => {
      const percs: Record<string, number> = {};
      cores.forEach(c => {
        percs[c] = (item.cor_key === c) ? item.percentual : 0;
      });
      return {
        submissao_id: submissaoId,
        versao: currentVersion,
        nome_chines: item.nome_chines || "",
        inci_name: item.inci_name,
        cas_no: item.cas_no || "",
        funcao: item.funcao,
        percentual_por_cor: percs,
        status_anvisa: "pendente",
      };
    });

    onIngredientesExtraidos(newItems);
    toast.success(`${selected.length} ingrediente(s) adicionado(s)`);
    onOpenChange(false);
  };

  const selectedCount = extractedItems.filter(i => i.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Extrair Ingredientes com IA
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Selecione um documento para análise. Você poderá validar o conteúdo antes da extração."}
            {step === "preview" && "Valide o conteúdo do documento antes de prosseguir com a extração."}
            {step === "results" && "Revise os ingredientes extraídos. Edite, selecione ou remova antes de confirmar."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground border-b pb-3">
          <span className={`flex items-center gap-1 ${step === "select" ? "text-primary font-semibold" : ""}`}>
            <FileSearch className="h-3.5 w-3.5" /> 1. Selecionar
          </span>
          <span className="text-border">→</span>
          <span className={`flex items-center gap-1 ${step === "preview" ? "text-primary font-semibold" : ""}`}>
            <Eye className="h-3.5 w-3.5" /> 2. Analisar & Aceitar
          </span>
          <span className="text-border">→</span>
          <span className={`flex items-center gap-1 ${step === "results" ? "text-primary font-semibold" : ""}`}>
            <CheckCircle2 className="h-3.5 w-3.5" /> 3. Revisar
          </span>
        </div>

        {/* ───── STEP 1: SELECT ───── */}
        {step === "select" && (
          <div className="space-y-4 flex-1 overflow-auto">
            <Tabs value={tab} onValueChange={(v) => {
              setTab(v as any);
              if (v === "processo" && processoDocs.length === 0) loadProcessoDocs();
            }}>
              <TabsList className="w-full">
                <TabsTrigger value="upload" className="flex-1 gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  Upload de Documento
                </TabsTrigger>
                <TabsTrigger value="processo" className="flex-1 gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Documento do Processo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4 space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/20 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,.xml"
                    onChange={handleFileSelect}
                  />
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Clique para selecionar um documento</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ficha técnica, especificação, rótulo, COA (PDF, imagem, Excel, etc.)
                  </p>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-3 bg-accent/30 rounded-lg px-4 py-3">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button onClick={openPreviewForUpload} className="gap-1.5">
                      <Eye className="h-4 w-4" />
                      Analisar Documento
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="processo" className="mt-4">
                {loadingDocs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : processoDocs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">Nenhum documento vinculado a este módulo</p>
                    <p className="text-xs mt-1">Use a tela <strong>Vincular China</strong> para despachar documentos para o módulo Composição.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {processoDocs.map((doc: any) => (
                        <Card key={doc.id} className="cursor-pointer hover:bg-accent/30 transition-colors">
                          <CardContent className="p-3 flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.nome_arquivo || doc.tipo_documento}</p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="text-xs text-muted-foreground">{doc.tipo_documento}</span>
                                {doc.checklists?.map((cl: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal">
                                    {cl}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">{doc.status}</Badge>
                            <Button
                              size="sm"
                              onClick={() => openPreviewForDoc(doc)}
                              className="gap-1.5"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Analisar
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* ───── STEP 2: PREVIEW + ACCEPT TERMS ───── */}
        {step === "preview" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Document preview area */}
            <div className="flex-1 min-h-0 border rounded-lg overflow-hidden bg-muted/30">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-full py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !previewUrl ? (
                <div className="flex flex-col items-center justify-center h-full py-20 gap-2">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Prévia não disponível para este tipo de arquivo</p>
                  <p className="text-xs text-muted-foreground">Você pode prosseguir com a extração mesmo sem pré-visualização.</p>
                </div>
              ) : isImageFile(previewFileName) ? (
                <div className="flex items-center justify-center h-full p-4 overflow-auto">
                  <img
                    src={previewUrl}
                    alt={previewFileName}
                    className="max-w-full max-h-[45vh] object-contain rounded shadow-sm"
                  />
                </div>
              ) : isPdfFile(previewFileName) ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full min-h-[45vh]"
                  title={previewFileName}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-20 gap-2">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium">{previewFileName}</p>
                  <p className="text-xs text-muted-foreground">Prévia visual não disponível. A IA processará o conteúdo interno.</p>
                </div>
              )}
            </div>

            {/* File info */}
            <div className="flex items-center gap-2 bg-accent/30 rounded-lg px-4 py-2">
              <FileSearch className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{previewFileName}</span>
              {selectedFile && (
                <Badge variant="outline" className="text-[10px]">{(selectedFile.size / 1024).toFixed(0)} KB</Badge>
              )}
            </div>

            {/* Terms of responsibility */}
            <div className="border border-warning/40 bg-warning/5 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Termo de Responsabilidade</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Ao prosseguir com a extração automática via IA, declaro que:
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc pl-4">
                    <li>O documento selecionado é legítimo e de fonte confiável.</li>
                    <li>Estou ciente de que os dados extraídos devem ser revisados antes da confirmação final.</li>
                    <li>Assumo responsabilidade pela veracidade das informações após a validação manual.</li>
                    <li>Esta ação será registrada em log de auditoria para fins de rastreabilidade e governança.</li>
                  </ul>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <Checkbox
                  checked={termsAccepted}
                  onCheckedChange={(v) => setTermsAccepted(!!v)}
                />
                <span className="text-sm font-medium">
                  Li e aceito o termo de responsabilidade
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-between">
              <Button variant="outline" onClick={() => { setStep("select"); setTermsAccepted(false); }} className="gap-1.5">
                ← Voltar
              </Button>
              <Button
                onClick={proceedExtraction}
                disabled={!termsAccepted || isExtracting}
                className="gap-1.5"
              >
                {isExtracting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isExtracting ? "Extraindo..." : "Extrair com IA"}
              </Button>
            </div>
          </div>
        )}

        {/* ───── STEP 3: RESULTS ───── */}
        {step === "results" && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-3">
            {observacoes && (
              <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">{observacoes}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {extractedItems.length} ingrediente(s) encontrado(s)
              </p>
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {selectedCount} selecionado(s)
              </Badge>
            </div>

            <ScrollArea className="flex-1 max-h-[400px]">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="border-b">
                      <th className="p-2 w-8"></th>
                      <th className="p-2 text-left font-medium text-muted-foreground">Nome Chinês</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">INCI Name</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">CAS NO</th>
                      <th className="p-2 text-left font-medium text-muted-foreground">Função</th>
                      <th className="p-2 text-center font-medium text-muted-foreground">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedItems.map((item, idx) => (
                      <tr key={idx} className={`border-b last:border-0 ${item.selected ? "bg-primary/5" : "opacity-50"}`}>
                        <td className="p-2">
                          <Checkbox checked={item.selected} onCheckedChange={() => toggleItem(idx)} />
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-7 text-xs"
                            value={item.nome_chines || ""}
                            onChange={e => updateItem(idx, "nome_chines", e.target.value)}
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-7 text-xs"
                            value={item.inci_name}
                            onChange={e => updateItem(idx, "inci_name", e.target.value)}
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-7 text-xs w-28"
                            value={item.cas_no || ""}
                            onChange={e => updateItem(idx, "cas_no", e.target.value)}
                          />
                        </td>
                        <td className="p-1">
                          <Select value={item.funcao} onValueChange={v => updateItem(idx, "funcao", v)}>
                            <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {FUNCAO_OPTIONS.map(f => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-7 text-xs text-center w-16"
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={item.percentual}
                            onChange={e => updateItem(idx, "percentual", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("preview"); setExtractedItems([]); }} className="gap-1.5">
                ← Voltar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step === "results" && extractedItems.length > 0 && (
            <Button onClick={handleConfirm} disabled={selectedCount === 0} className="gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Adicionar {selectedCount} Ingrediente(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
  });
}

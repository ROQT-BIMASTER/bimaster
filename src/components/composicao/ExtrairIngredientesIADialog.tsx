import { useState, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FUNCAO_OPTIONS, type Composicao } from "@/hooks/useComposicao";
import { validateFileForUpload } from "@/lib/utils/file-security";

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

export function ExtrairIngredientesIADialog({
  open, onOpenChange, submissaoId, cores, currentVersion, onIngredientesExtraidos,
}: Props) {
  const [tab, setTab] = useState<"upload" | "processo">("upload");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedIngredient[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processoDocs, setProcessoDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProcessoDocs = async () => {
    setLoadingDocs(true);
    try {
      const { data } = await (supabase
        .from("china_produto_documentos" as any)
        .select("id, tipo_documento, nome_arquivo, arquivo_url, status")
        .eq("submissao_id", submissaoId)
        .order("created_at", { ascending: false }) as any);
      setProcessoDocs(data || []);
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

  const extractFromFile = async () => {
    if (!selectedFile) return;
    setIsExtracting(true);
    try {
      // Convert file to base64 for image types, or read as text
      let payload: any = {};

      if (selectedFile.type.startsWith("image/")) {
        const base64 = await fileToBase64(selectedFile);
        payload.document_url = base64;
      } else {
        const text = await selectedFile.text();
        payload.document_text = text;
      }

      await callExtractionAPI(payload);
    } catch (err: any) {
      toast.error(err.message || "Erro ao extrair ingredientes");
    } finally {
      setIsExtracting(false);
    }
  };

  const extractFromDoc = async (doc: any) => {
    setIsExtracting(true);
    try {
      let payload: any = {};

      if (doc.arquivo_url) {
        // If it's an image URL, pass as image
        const isImage = /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(doc.arquivo_url);
        if (isImage) {
          payload.document_url = doc.arquivo_url;
        } else {
          // For PDFs and other docs, try to fetch text content
          payload.document_text = `Documento: ${doc.nome_arquivo || doc.tipo_documento}\nURL: ${doc.arquivo_url}\n\nPor favor extraia os ingredientes deste documento.`;
          payload.document_url = doc.arquivo_url;
        }
      }

      await callExtractionAPI(payload);
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

  const handleConfirm = () => {
    const selected = extractedItems.filter(i => i.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um ingrediente");
      return;
    }

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
    resetAndClose();
  };

  const resetAndClose = () => {
    setExtractedItems([]);
    setObservacoes("");
    setSelectedFile(null);
    setProcessoDocs([]);
    onOpenChange(false);
  };

  const selectedCount = extractedItems.filter(i => i.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Extrair Ingredientes com IA
          </DialogTitle>
          <DialogDescription>
            Envie um documento ou selecione um existente do processo. A IA identificará e estruturará os ingredientes automaticamente.
          </DialogDescription>
        </DialogHeader>

        {extractedItems.length === 0 ? (
          /* Step 1: Source selection */
          <div className="space-y-4 flex-1">
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
                    <Button onClick={extractFromFile} disabled={isExtracting}>
                      {isExtracting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Extrair com IA
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
                    <p className="text-sm">Nenhum documento encontrado neste processo</p>
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
                              <p className="text-xs text-muted-foreground">{doc.tipo_documento}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">{doc.status}</Badge>
                            <Button
                              size="sm"
                              onClick={() => extractFromDoc(doc)}
                              disabled={isExtracting}
                            >
                              {isExtracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                              Extrair
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
        ) : (
          /* Step 2: Review extracted ingredients */
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
              <Button variant="outline" onClick={() => setExtractedItems([])} className="gap-1.5">
                ← Voltar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
          {extractedItems.length > 0 && (
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

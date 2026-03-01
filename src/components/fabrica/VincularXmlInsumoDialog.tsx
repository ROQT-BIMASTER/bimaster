import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Check, AlertCircle, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseNFeXml, type NFeXmlData, type NFeXmlProduto } from "@/lib/fabrica/nfe-xml-parser";

interface VincularXmlInsumoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insumoNome: string;
  insumoId: string;
  onVincular: (dados: {
    fornecedor: string;
    custo_nf: number;
    nf_referencia: string;
    codigo: string;
  }) => void;
}

interface SavedXml {
  id: string;
  numero_nf: string;
  fornecedor_razao_social: string | null;
  fornecedor_nome_fantasia: string | null;
  data_emissao: string | null;
  valor_total: number | null;
  produtos: NFeXmlProduto[];
  fornecedor_cnpj: string | null;
}

export function VincularXmlInsumoDialog({
  open,
  onOpenChange,
  insumoNome,
  insumoId,
  onVincular,
}: VincularXmlInsumoDialogProps) {
  const [xmlData, setXmlData] = useState<NFeXmlData | null>(null);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("upload");
  const [savedXmls, setSavedXmls] = useState<SavedXml[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [selectedSavedXml, setSelectedSavedXml] = useState<SavedXml | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const formatarValor = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 });

  // Load saved XMLs when tab changes
  useEffect(() => {
    if (open && tab === "saved") {
      loadSavedXmls();
    }
  }, [open, tab]);

  const loadSavedXmls = async () => {
    setLoadingSaved(true);
    try {
      const { data, error } = await supabase
        .from("fabrica_nfe_xmls")
        .select("id, numero_nf, fornecedor_razao_social, fornecedor_nome_fantasia, data_emissao, valor_total, produtos, fornecedor_cnpj")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setSavedXmls((data as unknown as SavedXml[]) || []);
    } catch {
      toast.error("Erro ao carregar XMLs salvos");
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xml")) {
      setError("Apenas arquivos XML são aceitos");
      return;
    }

    try {
      const text = await file.text();
      const data = parseNFeXml(text);

      if (!data.produtos.length) {
        setError("Nenhum produto encontrado no XML");
        return;
      }

      // Save to DB and storage
      setSaving(true);
      await persistXml(data, file);

      setXmlData(data);
      setError(null);
      setSelectedItem(null);
    } catch (err) {
      setError("Erro ao ler o XML. Verifique se é um XML de NF-e válido.");
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const persistXml = async (data: NFeXmlData, file: File) => {
    try {
      // Check if already exists by chave_acesso
      if (data.chave_acesso) {
        const { data: existing } = await supabase
          .from("fabrica_nfe_xmls")
          .select("id")
          .eq("chave_acesso", data.chave_acesso)
          .maybeSingle();

        if (existing) {
          toast.info("XML já salvo anteriormente, reutilizando registro.");
          return;
        }
      }

      // Upload file to storage
      const storagePath = `${Date.now()}_${file.name}`;
      await supabase.storage.from("fabrica-nfe-xmls").upload(storagePath, file);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Insert metadata
      await (supabase.from("fabrica_nfe_xmls") as any).insert({
        numero_nf: data.numero,
        serie: data.serie,
        chave_acesso: data.chave_acesso || null,
        data_emissao: data.data_emissao || null,
        valor_total: data.valor_total,
        fornecedor_cnpj: data.fornecedor.cnpj,
        fornecedor_razao_social: data.fornecedor.razao_social,
        fornecedor_nome_fantasia: data.fornecedor.nome_fantasia,
        produtos: JSON.stringify(data.produtos),
        storage_path: storagePath,
        uploaded_by: user?.id,
      });

      toast.success("XML salvo para reutilização futura");
    } catch (err) {
      console.warn("Erro ao persistir XML:", err);
      // Non-blocking — the XML was parsed, just not saved
    }
  };

  const handleSelectSavedXml = (xml: SavedXml) => {
    setSelectedSavedXml(xml);
    // Convert saved data to NFeXmlData format for product selection
    setXmlData({
      numero: xml.numero_nf,
      serie: "",
      chave_acesso: "",
      data_emissao: xml.data_emissao || "",
      valor_total: xml.valor_total || 0,
      fornecedor: {
        cnpj: xml.fornecedor_cnpj || "",
        razao_social: xml.fornecedor_razao_social || "",
        nome_fantasia: xml.fornecedor_nome_fantasia || "",
      },
      produtos: xml.produtos,
    });
    setSelectedItem(null);
  };

  const handleConfirmar = () => {
    if (!xmlData || selectedItem === null) return;

    const produto = xmlData.produtos[selectedItem];
    const nfRef = `NF${xmlData.numero}`;
    const fornecedor =
      xmlData.fornecedor.nome_fantasia || xmlData.fornecedor.razao_social || "";

    onVincular({
      fornecedor: fornecedor.substring(0, 50),
      custo_nf: produto.valor_unitario,
      nf_referencia: nfRef,
      codigo: produto.codigo,
    });

    toast.success(`Insumo vinculado à ${nfRef}`);
    handleClose();
  };

  const handleClose = () => {
    setXmlData(null);
    setSelectedItem(null);
    setSelectedSavedXml(null);
    setError(null);
    setTab("upload");
    onOpenChange(false);
  };

  const fornecedorNome = xmlData
    ? xmlData.fornecedor.nome_fantasia || xmlData.fornecedor.razao_social
    : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Vincular XML ao Insumo
          </DialogTitle>
          <DialogDescription>
            Importe o XML da NF-e e selecione o produto correspondente ao insumo{" "}
            <strong>{insumoNome}</strong>
          </DialogDescription>
        </DialogHeader>

        {!xmlData ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="upload" className="flex-1 gap-1.5">
                <Upload className="h-4 w-4" />
                Subir novo XML
              </TabsTrigger>
              <TabsTrigger value="saved" className="flex-1 gap-1.5">
                <Database className="h-4 w-4" />
                XMLs salvos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4 mt-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                onClick={() => !saving && fileRef.current?.click()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-10 w-10 mx-auto text-muted-foreground mb-3 animate-spin" />
                    <p className="text-sm font-medium">Salvando XML...</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Clique para selecionar o XML da NF-e</p>
                    <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .xml</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleFileUpload}
              />
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </TabsContent>

            <TabsContent value="saved" className="space-y-4 mt-4">
              {loadingSaved ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : savedXmls.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum XML salvo ainda. Suba um novo XML na aba anterior.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NF</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedXmls.map((xml) => (
                        <TableRow key={xml.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleSelectSavedXml(xml)}>
                          <TableCell>
                            <Badge variant="outline">NF {xml.numero_nf}</Badge>
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">
                            {xml.fornecedor_nome_fantasia || xml.fornecedor_razao_social || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {xml.data_emissao || "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {xml.valor_total ? `R$ ${formatarValor(xml.valor_total)}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="text-xs">
                              Usar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            {/* Header da NF */}
            <div className="flex flex-wrap gap-3 items-center bg-muted/50 rounded-lg p-3">
              <Badge variant="outline">NF {xmlData.numero}</Badge>
              <span className="text-sm text-muted-foreground">{fornecedorNome}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {xmlData.data_emissao} • R$ {formatarValor(xmlData.valor_total)}
              </span>
            </div>

            {/* Tabela de produtos do XML */}
            <div className="text-sm font-medium">
              Selecione o produto que corresponde a <strong>{insumoNome}</strong>:
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Un</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Vlr Unit.</TableHead>
                    <TableHead className="text-right">Vlr Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {xmlData.produtos.map((prod, idx) => (
                    <TableRow
                      key={idx}
                      className={`cursor-pointer transition-colors ${
                        selectedItem === idx
                          ? "bg-primary/10 border-l-4 border-l-primary"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedItem(idx)}
                    >
                      <TableCell className="px-2">
                        {selectedItem === idx && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{prod.codigo}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate" title={prod.descricao}>
                        {prod.descricao}
                      </TableCell>
                      <TableCell className="text-xs">{prod.unidade}</TableCell>
                      <TableCell className="text-right text-sm">{formatarValor(prod.quantidade)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatarValor(prod.valor_unitario)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatarValor(prod.valor_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Preview do que será preenchido */}
            {selectedItem !== null && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-green-800 dark:text-green-300">Dados que serão preenchidos:</p>
                <ul className="text-green-700 dark:text-green-400 space-y-0.5 text-xs">
                  <li>
                    <strong>Fornecedor:</strong> {fornecedorNome?.substring(0, 50)}
                  </li>
                  <li>
                    <strong>Custo NF:</strong> R$ {formatarValor(xmlData.produtos[selectedItem].valor_unitario)}
                  </li>
                  <li>
                    <strong>NF Ref.:</strong> NF{xmlData.numero}
                  </li>
                  <li>
                    <strong>Código:</strong> {xmlData.produtos[selectedItem].codigo}
                  </li>
                </ul>
              </div>
            )}

            {/* Trocar XML */}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setXmlData(null);
                setSelectedItem(null);
                setSelectedSavedXml(null);
              }}
            >
              ← Selecionar outro XML
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {xmlData && (
            <Button onClick={handleConfirmar} disabled={selectedItem === null}>
              <Check className="h-4 w-4 mr-2" />
              Vincular Produto
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useRef } from "react";
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
import { Upload, FileText, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
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
  const fileRef = useRef<HTMLInputElement>(null);

  const formatarValor = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 });

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

      setXmlData(data);
      setError(null);
      setSelectedItem(null);
    } catch (err) {
      setError("Erro ao ler o XML. Verifique se é um XML de NF-e válido.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
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
    setError(null);
    onOpenChange(false);
  };

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
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Clique para selecionar o XML da NF-e</p>
              <p className="text-xs text-muted-foreground mt-1">Apenas arquivos .xml</p>
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
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header da NF */}
            <div className="flex flex-wrap gap-3 items-center bg-muted/50 rounded-lg p-3">
              <Badge variant="outline">NF {xmlData.numero}</Badge>
              <span className="text-sm text-muted-foreground">
                {xmlData.fornecedor.nome_fantasia || xmlData.fornecedor.razao_social}
              </span>
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
                    <strong>Fornecedor:</strong>{" "}
                    {(xmlData.fornecedor.nome_fantasia || xmlData.fornecedor.razao_social).substring(0, 50)}
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

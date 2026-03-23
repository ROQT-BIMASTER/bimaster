import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Upload, CheckCircle2, Lightbulb, FileText, X } from "lucide-react";
import { parseNFeXml, type NFeXmlData } from "@/lib/fabrica/nfe-xml-parser";

function formatChaveAcesso(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 44);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export interface XmlExtractedData {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  valorTotal: number;
  fornecedorCnpj: string;
  fornecedorRazaoSocial: string;
  fornecedorNomeFantasia: string;
}

interface ChaveAcessoInputProps {
  value: string;
  onChange: (chave: string) => void;
  onXmlExtracted?: (data: XmlExtractedData) => void;
  aiSuggestion?: string | null;
  error?: string;
  showXmlUpload?: boolean;
}

export function ChaveAcessoInput({
  value,
  onChange,
  onXmlExtracted,
  aiSuggestion,
  error,
  showXmlUpload = true,
}: ChaveAcessoInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [xmlPreview, setXmlPreview] = useState<XmlExtractedData | null>(null);
  const [showAiSuggestion, setShowAiSuggestion] = useState(true);

  const handleChaveChange = (rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 44);
    onChange(digits);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const xmlText = ev.target?.result as string;
        const parsed: NFeXmlData = parseNFeXml(xmlText);

        const extracted: XmlExtractedData = {
          chaveAcesso: parsed.chave_acesso,
          numero: parsed.numero,
          serie: parsed.serie,
          dataEmissao: parsed.data_emissao,
          valorTotal: parsed.valor_total,
          fornecedorCnpj: parsed.fornecedor.cnpj,
          fornecedorRazaoSocial: parsed.fornecedor.razao_social,
          fornecedorNomeFantasia: parsed.fornecedor.nome_fantasia,
        };

        setXmlPreview(extracted);

        if (extracted.chaveAcesso) {
          onChange(extracted.chaveAcesso.replace(/\D/g, "").slice(0, 44));
        }
      } catch {
        console.error("[ChaveAcessoInput] Erro ao parsear XML");
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleApplyXml = () => {
    if (xmlPreview) {
      onXmlExtracted?.(xmlPreview);
      setXmlPreview(null);
    }
  };

  const handleApplyAiSuggestion = () => {
    if (aiSuggestion) {
      const digits = aiSuggestion.replace(/\D/g, "").slice(0, 44);
      onChange(digits);
      setShowAiSuggestion(false);
    }
  };

  const suggestedDigits = aiSuggestion?.replace(/\D/g, "") || "";
  const hasSuggestion = suggestedDigits.length === 44 && suggestedDigits !== value && showAiSuggestion;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground">Chave de Acesso NF-e</Label>
        </div>
        {showXmlUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3 w-3" />
              Upload XML
            </Button>
          </>
        )}
      </div>

      <Input
        value={formatChaveAcesso(value)}
        onChange={(e) => handleChaveChange(e.target.value)}
        placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
        className={`font-mono text-xs h-8 ${error ? "border-destructive" : ""}`}
        maxLength={55}
      />

      {value && value.length > 0 && value.length < 44 && (
        <p className="text-[10px] text-muted-foreground">{value.length}/44 dígitos</p>
      )}
      {value && value.length === 44 && (
        <p className="text-[10px] text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Chave completa
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* XML Preview */}
      {xmlPreview && (
        <div className="p-3 rounded-md border border-primary/20 bg-primary/5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">Dados extraídos do XML</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setXmlPreview(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {xmlPreview.numero && (
              <>
                <span className="text-muted-foreground">Nº NF-e:</span>
                <span className="font-mono">{xmlPreview.numero}</span>
              </>
            )}
            {xmlPreview.fornecedorRazaoSocial && (
              <>
                <span className="text-muted-foreground">Fornecedor:</span>
                <span className="truncate">{xmlPreview.fornecedorRazaoSocial}</span>
              </>
            )}
            {xmlPreview.fornecedorCnpj && (
              <>
                <span className="text-muted-foreground">CNPJ:</span>
                <span className="font-mono">{xmlPreview.fornecedorCnpj}</span>
              </>
            )}
            {xmlPreview.valorTotal > 0 && (
              <>
                <span className="text-muted-foreground">Valor:</span>
                <span>R$ {xmlPreview.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </>
            )}
          </div>
          {onXmlExtracted && (
            <Button
              type="button"
              size="sm"
              onClick={handleApplyXml}
              className="w-full h-7 text-xs gap-1.5"
            >
              <CheckCircle2 className="h-3 w-3" />
              Aplicar dados do XML ao formulário
            </Button>
          )}
        </div>
      )}

      {/* AI Suggestion */}
      {hasSuggestion && (
        <div className="flex items-start gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
          <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="text-primary font-medium">Sugestão IA: Chave detectada</p>
            <p className="text-muted-foreground font-mono break-all">{formatChaveAcesso(suggestedDigits)}</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleApplyAiSuggestion}
            className="h-6 px-2 text-xs"
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}

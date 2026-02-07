import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useReceiptScanner } from "@/hooks/useExpenseAI";
import { Camera, Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface ExtractedFields {
  supplier_name?: string;
  supplier_document?: string;
  total_value?: number;
  emission_date?: string;
  document_type?: string;
  document_number?: string;
  suggested_category?: string;
  description?: string;
  confidence?: number;
}

interface ExpenseReceiptScannerProps {
  onFieldsExtracted: (fields: ExtractedFields) => void;
}

export function ExpenseReceiptScanner({ onFieldsExtracted }: ExpenseReceiptScannerProps) {
  const { scan, isScanning } = useReceiptScanner();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (foto do comprovante)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo: 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      setPreview(reader.result as string);

      try {
        const result = await scan(base64);
        if (result) {
          onFieldsExtracted({
            supplier_name: result.supplier_name,
            supplier_document: result.supplier_document,
            total_value: result.total_value,
            emission_date: result.emission_date,
            document_type: result.document_type,
            document_number: result.document_number,
            suggested_category: result.suggested_category,
            description: result.description,
            confidence: result.confidence,
          });
          toast.success(
            `Dados extraídos com ${Math.round((result.confidence || 0) * 100)}% de confiança`
          );
        }
      } catch {
        // Error already handled by hook
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {preview && (
        <div className="relative w-full h-24 rounded-lg overflow-hidden border bg-muted">
          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 border-dashed"
        onClick={() => fileInputRef.current?.click()}
        disabled={isScanning}
      >
        {isScanning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Analisando com IA...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 text-primary" />
            <Camera className="h-4 w-4" />
            <span>Escanear Comprovante com IA</span>
          </>
        )}
      </Button>

      {isScanning && (
        <Badge variant="secondary" className="w-full justify-center gap-1">
          <Sparkles className="h-3 w-3" />
          Extraindo dados do documento...
        </Badge>
      )}
    </div>
  );
}

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, FileSpreadsheet, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import ExcelJS from "exceljs";

interface BriefingField {
  categoria: string;
  campo: string;
  valor: string;
  responsabilidade?: string;
}

interface BriefingImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projetoId: string;
  secaoId: string;
  onSave: (nomeArquivo: string, campos: BriefingField[]) => void;
}

const RESP_COLORS: Record<string, string> = {
  D: "bg-blue-500/20 text-blue-400",
  C: "bg-purple-500/20 text-purple-400",
  R: "bg-red-500/20 text-red-400",
  E: "bg-amber-500/20 text-amber-400",
  COMP: "bg-emerald-500/20 text-emerald-400",
};

export function BriefingImportDialog({ open, onOpenChange, projetoId, secaoId, onSave }: BriefingImportDialogProps) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [loading, setLoading] = useState(false);
  const [campos, setCampos] = useState<BriefingField[]>([]);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setCampos([]);
    setFileName("");
    setLoading(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const extractExcelText = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`=== ${sheet.name} ===`);
      sheet.eachRow((row) => {
        const cells = (row.values as any[])
          .slice(1)
          .map((v) => (v != null ? String(v).trim() : ""))
          .filter(Boolean);
        if (cells.length > 0) lines.push(cells.join(" | "));
      });
    });
    return lines.join("\n");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);

    try {
      const textoExtraido = await extractExcelText(file);
      if (textoExtraido.length < 20) {
        toast.error("Planilha parece vazia ou não foi possível extrair dados.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("importar-briefing-ia", {
        body: { textoExtraido },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const extracted = data.campos || [];
      if (extracted.length === 0) {
        toast.error("IA não conseguiu extrair campos do briefing.");
        setLoading(false);
        return;
      }

      setCampos(extracted);
      setStep("review");
    } catch (err: any) {
      toast.error("Erro ao processar briefing: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    onSave(fileName, campos);
    handleClose(false);
  };

  // Group by categoria
  const grouped = campos.reduce<Record<string, BriefingField[]>>((acc, c) => {
    if (!acc[c.categoria]) acc[c.categoria] = [];
    acc[c.categoria].push(c);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar Briefing com IA
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            {loading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analisando planilha com IA...</p>
                {fileName && <p className="text-xs text-muted-foreground/60">{fileName}</p>}
              </>
            ) : (
              <>
                <div
                  className="border-2 border-dashed border-border/50 rounded-xl p-10 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center gap-3"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium">Clique para enviar a planilha de Briefing</p>
                  <p className="text-xs text-muted-foreground">Formatos aceitos: .xlsx, .xls</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </>
            )}
          </div>
        )}

        {step === "review" && (
          <>
            <p className="text-sm text-muted-foreground mb-2">
              {campos.length} campos extraídos de <span className="font-medium">{fileName}</span>
            </p>
            <ScrollArea className="flex-1 max-h-[55vh]">
              <div className="space-y-4 pr-2">
                {Object.entries(grouped).map(([categoria, fields]) => (
                  <div key={categoria}>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{categoria}</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Campo</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead className="w-[80px] text-center">Resp.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-xs">{f.campo}</TableCell>
                            <TableCell className="text-xs">{f.valor || "—"}</TableCell>
                            <TableCell className="text-center">
                              {f.responsabilidade && (
                                <Badge className={cn("text-[9px] border-0", RESP_COLORS[f.responsabilidade] || "bg-muted text-muted-foreground")}>
                                  {f.responsabilidade}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={reset}>Voltar</Button>
              <Button onClick={handleConfirm} className="gap-1.5">
                <Check className="h-4 w-4" />
                Salvar Briefing ({campos.length} campos)
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

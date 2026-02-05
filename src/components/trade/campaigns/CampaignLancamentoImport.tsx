import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import ExcelJS from "exceljs";

interface CampaignLancamentoImportProps {
  campaignId: string;
  campaignName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportRow {
  customerId: string;
  customerName: string;
  cnpj: string;
  valorPedido: number | null;
  tipoBrinde: string | null;
  sellOutAnterior: number | null;
  sellOutAtual: number | null;
  unonAnterior: number | null;
  unonAtual: number | null;
  observacoes: string | null;
  status: "valid" | "error" | "warning";
  errorMessage?: string;
}

export function CampaignLancamentoImport({
  campaignId,
  campaignName,
  open,
  onOpenChange,
}: CampaignLancamentoImportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  const resetState = () => {
    setParsedData([]);
    setFileName(null);
    setImportProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      
      // Find the Lancamentos sheet
      const worksheet = workbook.worksheets.find(ws => 
        ws.name.toLowerCase().includes("lançamento") || 
        ws.name.toLowerCase().includes("lancamento")
      ) || workbook.worksheets[0];
      
      // Convert worksheet to array of rows
      const rows: any[][] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip header
          const rowData: any[] = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            rowData[colNumber - 1] = cell.value;
          });
          if (rowData[0]) { // Only add rows with first column value
            rows.push(rowData);
          }
        }
      });

      // Validate customer IDs exist in the database
      const customerIds = rows.map(row => row[0]).filter(Boolean);
      const { data: existingCustomers } = await supabase
        .from("prospects")
        .select("id, nome_empresa")
        .in("id", customerIds);
      
      const existingCustomerMap = new Map(
        existingCustomers?.map(c => [c.id, c.nome_empresa]) || []
      );

      const parsed: ImportRow[] = rows.map(row => {
        const customerId = String(row[0] || "").trim();
        const customerName = String(row[1] || "").trim();
        const cnpj = String(row[2] || "").trim();
        const valorPedido = parseNumber(row[3]);
        const tipoBrinde = row[4] ? String(row[4]).trim() : null;
        const sellOutAnterior = parseNumber(row[5]);
        const sellOutAtual = parseNumber(row[6]);
        const unonAnterior = parseNumber(row[7]);
        const unonAtual = parseNumber(row[8]);
        const observacoes = row[9] ? String(row[9]).trim() : null;

        // Validation
        let status: "valid" | "error" | "warning" = "valid";
        let errorMessage: string | undefined;

        if (!customerId) {
          status = "error";
          errorMessage = "ID do cliente não informado";
        } else if (!existingCustomerMap.has(customerId)) {
          status = "error";
          errorMessage = "Cliente não encontrado no sistema";
        } else if (valorPedido === null && sellOutAnterior === null && sellOutAtual === null) {
          status = "warning";
          errorMessage = "Nenhum valor preenchido";
        }

        return {
          customerId,
          customerName: existingCustomerMap.get(customerId) || customerName,
          cnpj,
          valorPedido,
          tipoBrinde,
          sellOutAnterior,
          sellOutAtual,
          unonAnterior,
          unonAtual,
          observacoes,
          status,
          errorMessage,
        };
      });

      setParsedData(parsed);
    } catch (error) {
      console.error("Error parsing file:", error);
      toast.error("Erro ao processar arquivo. Verifique o formato.");
    } finally {
      setIsProcessing(false);
    }
  };

  const parseNumber = (value: any): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = parseFloat(String(value).replace(",", "."));
    return isNaN(parsed) ? null : parsed;
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = parsedData.filter(row => row.status !== "error");
      
      if (validRows.length === 0) {
        throw new Error("Nenhuma linha válida para importar");
      }

      let imported = 0;
      const errors: string[] = [];

      for (const row of validRows) {
        try {
          // Calculate growth if we have sell out values
          let crescimentoPercentual = null;
          if (row.sellOutAnterior && row.sellOutAnterior > 0 && row.sellOutAtual !== null) {
            crescimentoPercentual = ((row.sellOutAtual - row.sellOutAnterior) / row.sellOutAnterior) * 100;
          }

          // Calculate ROI if we have the data
          let roiPercentual = null;
          if (row.valorPedido && row.valorPedido > 0 && row.sellOutAtual !== null && row.sellOutAnterior !== null) {
            const incremento = row.sellOutAtual - row.sellOutAnterior;
            if (incremento > 0) {
              roiPercentual = (incremento / row.valorPedido) * 100;
            }
          }

          const { error } = await supabase
            .from("trade_campaign_lancamentos")
            .insert({
              campaign_id: campaignId,
              customer_id: row.customerId,
              data_lancamento: new Date().toISOString().split("T")[0],
              valor_pedido: row.valorPedido || 0,
              tipo_brinde: row.tipoBrinde,
              sell_out_anterior: row.sellOutAnterior || 0,
              sell_out_atual: row.sellOutAtual || 0,
              crescimento_percentual: crescimentoPercentual,
              roi_percentual: roiPercentual,
              observations: row.observacoes,
              status: "pending",
            });

          if (error) {
            errors.push(`${row.customerName}: ${error.message}`);
          } else {
            imported++;
          }
        } catch (err: any) {
          errors.push(`${row.customerName}: ${err.message}`);
        }

        setImportProgress(Math.round(((imported + errors.length) / validRows.length) * 100));
      }

      return { imported, errors };
    },
    onSuccess: ({ imported, errors }) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-lancamentos-selector"] });
      
      if (errors.length === 0) {
        toast.success(`${imported} lançamento(s) importado(s) com sucesso`);
      } else {
        toast.warning(`${imported} importado(s), ${errors.length} erro(s)`);
      }
      
      onOpenChange(false);
      resetState();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleImport = () => {
    importMutation.mutate();
  };

  const validCount = parsedData.filter(r => r.status === "valid").length;
  const warningCount = parsedData.filter(r => r.status === "warning").length;
  const errorCount = parsedData.filter(r => r.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Lançamentos em Massa
          </DialogTitle>
          <DialogDescription>
            Importe uma planilha preenchida para criar lançamentos automaticamente.
            Campanha: <strong>{campaignName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          {parsedData.length === 0 && (
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              {isProcessing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">Processando arquivo...</p>
                </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="font-medium">Clique para selecionar ou arraste o arquivo</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Formatos aceitos: .xlsx, .xls
                  </p>
                </>
              )}
            </div>
          )}

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <>
              {/* Summary */}
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{fileName}</span>
                </div>
                <div className="flex-1" />
                <Badge variant="default" className="bg-success">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {validCount + warningCount} válido(s)
                </Badge>
                {warningCount > 0 && (
                  <Badge variant="secondary">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {warningCount} aviso(s)
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {errorCount} erro(s)
                  </Badge>
                )}
              </div>

              {/* Data Preview */}
              <ScrollArea className="h-[350px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Valor Pedido</TableHead>
                      <TableHead>Brinde</TableHead>
                      <TableHead className="text-right">Sell Out Ant.</TableHead>
                      <TableHead className="text-right">Sell Out Atual</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, idx) => (
                      <TableRow 
                        key={idx}
                        className={
                          row.status === "error" 
                            ? "bg-destructive/10" 
                            : row.status === "warning"
                            ? "bg-accent/50"
                            : ""
                        }
                      >
                        <TableCell>
                          {row.status === "valid" && (
                            <CheckCircle className="h-4 w-4 text-success" />
                          )}
                          {row.status === "warning" && (
                            <AlertTriangle className="h-4 w-4 text-warning" />
                          )}
                          {row.status === "error" && (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.customerName || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.valorPedido !== null 
                            ? `R$ ${row.valorPedido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {row.tipoBrinde || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.sellOutAnterior !== null 
                            ? `R$ ${row.sellOutAnterior.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.sellOutAtual !== null 
                            ? `R$ ${row.sellOutAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.errorMessage || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Progress */}
              {importMutation.isPending && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Importando...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              onOpenChange(false);
              resetState();
            }}
          >
            Cancelar
          </Button>
          {parsedData.length > 0 && (
            <>
              <Button
                variant="secondary"
                onClick={resetState}
              >
                Selecionar Outro
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount + warningCount === 0 || importMutation.isPending}
                className="gap-2"
              >
                {importMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Importar {validCount + warningCount} Lançamento(s)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

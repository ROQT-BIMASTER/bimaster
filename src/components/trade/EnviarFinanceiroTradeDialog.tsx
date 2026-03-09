import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DOCUMENT_TYPES, usePortadores } from "@/hooks/useEventExpenses";
import { Loader2, Send, FileText, Building2, Check, ChevronsUpDown, AlertTriangle, Clock, CalendarCheck, SplitSquareVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FornecedorQuickAdd } from "@/components/fabrica/FornecedorQuickAdd";
import { FornecedorPaymentInfo } from "@/components/shared/FornecedorPaymentInfo";
import { FinancialFieldsSuggestion } from "@/components/ai/FinancialFieldsSuggestion";
import { useActivePaymentPolicy, isWithinCutoff, getPolicySummary, getNextPaymentDateFormatted } from "@/hooks/useFinancialPaymentPolicies";
import { useActiveCorrectionRule, getCorrectionLocks } from "@/hooks/useFinancialCorrectionRules";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";

interface Fornecedor {
  id: string;
  razao_social: string;
  cnpj: string | null;
}

interface EnviarFinanceiroTradeDialogProps {
  entry: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EnviarFinanceiroTradeDialog({
  entry,
  open,
  onOpenChange,
  onSuccess,
}: EnviarFinanceiroTradeDialogProps) {
  const { data: activePolicy } = useActivePaymentPolicy();
  const { data: correctionRule } = useActiveCorrectionRule();
  const { data: portadores } = usePortadores();
  const [loading, setLoading] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [openCombobox, setOpenCombobox] = useState(false);

  const [formData, setFormData] = useState({
    supplier_name: "",
    supplier_document: "",
    document_type: "",
    document_number: "",
    due_date: "",
    portador: "",
    payment_notes: "",
  });

  const hasAttachments = entry?.attachments && entry.attachments.length > 0;
  const isApproved = entry?.approval_status === "approved";
  const withinCutoff = activePolicy ? isWithinCutoff(activePolicy) : true;
  const isInstallment = entry?.installment_number && entry?.installment_total;
  const hasBoleto = entry?.boleto_barcode;
  const isCorrection = !!entry?.payment_queue_id;
  const locks = isCorrection ? getCorrectionLocks(correctionRule) : null;

  // Fetch suppliers when dialog opens
  useEffect(() => {
    if (open) {
      supabase
        .from("fabrica_fornecedores")
        .select("id, razao_social, cnpj")
        .eq("ativo", true)
        .order("razao_social")
        .then(({ data }) => setFornecedores(data || []));

      // Pre-fill supplier if entry already has one
      if (entry?.supplier_name) {
        setFormData((prev) => ({
          ...prev,
          supplier_name: entry.supplier_name || "",
          supplier_document: entry.supplier_document || "",
        }));
      }
    }
  }, [open, entry]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFornecedorId("");
      setFormData({
        supplier_name: "",
        supplier_document: "",
        document_type: "",
        document_number: "",
        due_date: "",
        portador: "",
        payment_notes: "",
      });
    }
  }, [open]);

  const handleSelectFornecedor = (id: string) => {
    const fornecedor = fornecedores.find((f) => f.id === id);
    if (fornecedor) {
      setFornecedorId(id);
      setFormData({
        ...formData,
        supplier_name: fornecedor.razao_social,
        supplier_document: fornecedor.cnpj || "",
      });
    }
    setOpenCombobox(false);
  };

  const handleFornecedorCriado = (novo: { id: string; nome: string }) => {
    supabase
      .from("fabrica_fornecedores")
      .select("id, razao_social, cnpj")
      .eq("id", novo.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setFornecedores((prev) => [...prev, data]);
          setFornecedorId(data.id);
          setFormData({
            ...formData,
            supplier_name: data.razao_social,
            supplier_document: data.cnpj || "",
          });
        }
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate approval status
    if (!isApproved) {
      toast.error("Lançamento precisa estar aprovado para enviar ao financeiro");
      return;
    }

    // Validate attachments
    if (!hasAttachments) {
      toast.error("Adicione pelo menos um anexo antes de enviar ao financeiro");
      return;
    }

    if (
      (!fornecedorId && !isCorrection) ||
      !formData.document_type ||
      !formData.document_number ||
      !formData.due_date
    ) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const code = `TRD-${Date.now()}`;

      const { data: queueEntry, error: queueError } = await supabase
        .from("financial_payment_queue")
        .insert({
          code,
          source_type: "trade_entry",
          source_id: entry.id,
          source_code: entry.account?.code || null,
          supplier_name: formData.supplier_name,
          supplier_document: formData.supplier_document || null,
          document_type: formData.document_type,
          document_number: formData.document_number,
          amount: parseFloat(entry.amount),
          due_date: formData.due_date,
          portador: formData.portador,
          description: entry.description || null,
          notes: [
            formData.payment_notes,
            hasBoleto ? `Linha digitável: ${entry.boleto_barcode}` : null,
            isInstallment ? `Parcela ${entry.installment_number}/${entry.installment_total}` : null,
          ].filter(Boolean).join(" | ") || null,
          department_name: "Trade Marketing",
          requested_by: user.id,
          attachments: entry.attachments || null,
          empresa_id: entry.empresa_id || null,
          empresa_nome: entry.empresa_nome || null,
        })
        .select("id")
        .single();

      if (queueError) throw queueError;

      const { error: updateError } = await supabase
        .from("trade_financial_entries")
        .update({
          send_to_financial: true,
          status: "pending_financial",
          payment_queue_id: queueEntry.id,
          document_type: formData.document_type,
          document_number: formData.document_number,
          due_date: formData.due_date,
          portador: formData.portador,
          supplier_name: formData.supplier_name,
          supplier_document: formData.supplier_document || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id);

      if (updateError) throw updateError;

      toast.success("Lançamento enviado ao financeiro com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const selectedFornecedor = fornecedores.find((f) => f.id === fornecedorId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar para Pagamento
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do fornecedor e documento para enviar ao financeiro
          </DialogDescription>
        </DialogHeader>

        {/* Installment context */}
        {isInstallment && (
          <Alert variant="info">
            <SplitSquareVertical className="h-4 w-4" />
            <AlertDescription>
              Esta é a <strong>parcela {entry.installment_number} de {entry.installment_total}</strong>
              {hasBoleto && (
                <span className="block text-xs mt-1 font-mono">
                  Boleto: {entry.boleto_barcode}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Attachment validation alert */}
        {!hasAttachments && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Este lançamento não possui anexos. Adicione pelo menos um comprovante antes de enviar ao financeiro.
            </AlertDescription>
          </Alert>
        )}

        {/* Approval status alert */}
        {!isApproved && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Este lançamento ainda não foi aprovado. Somente lançamentos aprovados podem ser enviados ao financeiro.
            </AlertDescription>
          </Alert>
        )}

        {/* Payment policy banner */}
        {activePolicy && (
          <Alert variant={withinCutoff ? "info" : "warning"}>
            {withinCutoff ? (
              <CalendarCheck className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <AlertDescription className="text-xs">
              {withinCutoff ? (
                <>
                  <strong>Dentro do corte.</strong> {getPolicySummary(activePolicy)} — Pagamento previsto: {getNextPaymentDateFormatted(activePolicy)}
                </>
              ) : (
                <>
                  <strong>Fora do corte.</strong> {getPolicySummary(activePolicy)} — Este envio será processado na próxima semana.
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* AI Suggestions */}
          {entry?.id && (
            <FinancialFieldsSuggestion
              expenseId={entry.id}
              onApplySuggestions={(fields) => {
                setFormData((prev) => ({
                  ...prev,
                  document_type: fields.document_type || prev.document_type,
                  portador: fields.portador || prev.portador,
                  due_date: fields.due_date || prev.due_date,
                }));
              }}
            />
          )}

          {/* Dados do Fornecedor */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Dados do Fornecedor
              {isCorrection && locks?.supplier_name && (
                <span className="text-xs text-amber-600 ml-auto">🔒 Bloqueado para correção</span>
              )}
            </div>

            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              <div className="flex gap-2">
                {isCorrection && locks?.supplier_name ? (
                  <Input
                    value={formData.supplier_name}
                    disabled
                    className="flex-1 bg-muted/50 cursor-not-allowed"
                  />
                ) : (
                  <>
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openCombobox}
                          className="flex-1 justify-between font-normal"
                        >
                          {selectedFornecedor ? (
                            <span className="truncate">
                              {selectedFornecedor.razao_social}
                              {selectedFornecedor.cnpj && (
                                <span className="text-muted-foreground ml-2">
                                  - {selectedFornecedor.cnpj}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Selecione um fornecedor...
                            </span>
                          )}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar fornecedor..." />
                          <CommandList>
                            <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                            <CommandGroup>
                              {fornecedores.map((fornecedor) => (
                                <CommandItem
                                  key={fornecedor.id}
                                  value={`${fornecedor.razao_social} ${fornecedor.cnpj || ""}`}
                                  onSelect={() =>
                                    handleSelectFornecedor(fornecedor.id)
                                  }
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      fornecedorId === fornecedor.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{fornecedor.razao_social}</span>
                                    {fornecedor.cnpj && (
                                      <span className="text-xs text-muted-foreground">
                                        {fornecedor.cnpj}
                                      </span>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FornecedorQuickAdd onFornecedorCriado={handleFornecedorCriado} />
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_document">CNPJ/CPF</Label>
              <Input
                id="supplier_document"
                value={formData.supplier_document}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_document: e.target.value })
                }
                disabled={isCorrection && locks?.supplier_document}
                placeholder="Preenchido automaticamente"
                className="bg-muted/50"
              />
            </div>

            {/* Supplier payment info */}
            {(fornecedorId || isCorrection) && formData.supplier_name && (
              <FornecedorPaymentInfo fornecedorId={fornecedorId || ""} />
            )}
          </div>

          {/* Dados do Documento */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Dados do Documento
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="document_type">Tipo de Documento *</Label>
                <Select
                  value={formData.document_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, document_type: value })
                  }
                  disabled={isCorrection && locks?.document_type}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_number">Número do Documento *</Label>
                <Input
                  id="document_number"
                  value={formData.document_number}
                  onChange={(e) =>
                    setFormData({ ...formData, document_number: e.target.value })
                  }
                  placeholder="Ex: 12345"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Data de Vencimento *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="portador">Portador/Forma de Pagamento *</Label>
                <Select
                  value={formData.portador}
                  onValueChange={(value) =>
                    setFormData({ ...formData, portador: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {portadores?.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                    <SelectItem value="BRADESCO">BRADESCO</SelectItem>
                    <SelectItem value="ITAU">ITAÚ</SelectItem>
                    <SelectItem value="CARTEIRA">CARTEIRA</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="DEPOSITO">DEPÓSITO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="payment_notes">Observações para Pagamento</Label>
            <Textarea
              id="payment_notes"
              value={formData.payment_notes}
              onChange={(e) =>
                setFormData({ ...formData, payment_notes: e.target.value })
              }
              placeholder="Informações adicionais para o financeiro..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || (!fornecedorId && !isCorrection) || !hasAttachments || !isApproved}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Enviar ao Financeiro
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

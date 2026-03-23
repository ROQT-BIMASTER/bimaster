import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_TYPES, usePortadores } from "@/hooks/useEventExpenses";
import {
  Loader2, Send, FileText, Building2, Check, ChevronsUpDown,
  AlertTriangle, Clock, CalendarCheck, SplitSquareVertical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FornecedorQuickAdd } from "@/components/fabrica/FornecedorQuickAdd";
import { FornecedorPaymentInfo } from "@/components/shared/FornecedorPaymentInfo";
import { FinancialFieldsSuggestion } from "@/components/ai/FinancialFieldsSuggestion";
import {
  useActivePaymentPolicy,
  isWithinCutoff,
  getPolicySummary,
  getNextPaymentDateFormatted,
} from "@/hooks/useFinancialPaymentPolicies";
import { useActiveCorrectionRule, getCorrectionLocks } from "@/hooks/useFinancialCorrectionRules";
import { cn } from "@/lib/utils";

interface Fornecedor {
  id: string;
  razao_social: string;
  cnpj: string | null;
}

export interface FinancialFormData {
  supplier_name: string;
  supplier_document: string;
  document_type: string;
  document_number: string;
  due_date: string;
  portador: string;
  payment_notes: string;
}

export interface SiblingInstallment {
  id: string;
  installment_number: number;
  installment_total: number;
  valor_realizado: number;
  valor_previsto: number;
  due_date: string | null;
  status: string;
  boleto_barcode: string | null;
}

export interface FinancialSubmissionFormProps {
  /** Expense/entry ID for AI suggestions */
  expenseId: string;
  /** Whether the source record is approved */
  isApproved: boolean;
  /** Whether the source record has attachments */
  hasAttachments: boolean;
  /** Whether this is a correction/resubmission */
  isCorrection: boolean;
  /** Installment info */
  installmentInfo?: {
    number: number;
    total: number;
    boletoBarcode?: string | null;
  } | null;
  /** Sibling installments to display */
  siblingInstallments?: SiblingInstallment[];
  /** Initial form data (for pre-fill / correction) */
  initialData?: Partial<FinancialFormData>;
  /** Loading state */
  loading: boolean;
  /** Submit handler */
  onSubmit: (data: FinancialFormData) => void;
  /** Cancel handler */
  onCancel: () => void;
}

export function FinancialSubmissionForm({
  expenseId,
  isApproved,
  hasAttachments,
  isCorrection,
  installmentInfo,
  siblingInstallments = [],
  initialData,
  loading,
  onSubmit,
  onCancel,
}: FinancialSubmissionFormProps) {
  const { data: activePolicy } = useActivePaymentPolicy();
  const { data: correctionRule } = useActiveCorrectionRule();
  const { data: portadores } = usePortadores();

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [openCombobox, setOpenCombobox] = useState(false);

  const [formData, setFormData] = useState<FinancialFormData>({
    supplier_name: "",
    supplier_document: "",
    document_type: "",
    document_number: "",
    due_date: "",
    portador: "",
    payment_notes: "",
  });

  const withinCutoff = activePolicy ? isWithinCutoff(activePolicy) : true;
  const locks = isCorrection ? getCorrectionLocks(correctionRule) : null;

  // Fetch suppliers on mount
  useEffect(() => {
    supabase
      .from("fornecedores")
      .select("id, razao_social, cnpj")
      .eq("status", "ativo")
      .order("razao_social")
      .then(({ data }) => setFornecedores(data || []));
  }, []);

  // Pre-fill form data from initialData
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        supplier_name: initialData.supplier_name || prev.supplier_name,
        supplier_document: initialData.supplier_document || prev.supplier_document,
        document_type: initialData.document_type || prev.document_type,
        document_number: initialData.document_number || prev.document_number,
        due_date: initialData.due_date || prev.due_date,
        portador: initialData.portador || prev.portador,
        payment_notes: initialData.payment_notes || prev.payment_notes,
      }));
    }
  }, [initialData]);

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
      .from("fornecedores")
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const selectedFornecedor = fornecedores.find((f) => f.id === fornecedorId);
  const canSubmit = !loading && (!!fornecedorId || isCorrection) && hasAttachments && isApproved;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge variant="success" className="text-[10px]">Aprovada</Badge>;
      case "pending":
        return <Badge variant="warning" className="text-[10px]">Pendente</Badge>;
      case "paid":
        return <Badge className="text-[10px]">Paga</Badge>;
      default:
        return <Badge variant="ghost" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Installment context */}
      {installmentInfo && (
        <Alert>
          <SplitSquareVertical className="h-4 w-4" />
          <AlertDescription>
            Esta é a <strong>parcela {installmentInfo.number} de {installmentInfo.total}</strong>.
            {installmentInfo.boletoBarcode && (
              <span className="block mt-1 font-mono text-xs break-all">
                Linha digitável: {installmentInfo.boletoBarcode}
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Sibling installments */}
      {installmentInfo && siblingInstallments.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Outras parcelas do grupo:</p>
          <div className="space-y-1.5">
            {siblingInstallments.map((sibling) => (
              <div key={sibling.id} className="flex items-center justify-between text-xs gap-2">
                <span className="font-medium">
                  {sibling.installment_number}/{sibling.installment_total}
                </span>
                <span className="text-muted-foreground">
                  {(sibling.valor_realizado || sibling.valor_previsto || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
                <span className="text-muted-foreground">
                  {sibling.due_date ? new Date(sibling.due_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
                </span>
                {getStatusBadge(sibling.status)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval status alert */}
      {!isApproved && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este registro ainda não foi aprovado. Somente registros aprovados podem ser enviados ao financeiro.
          </AlertDescription>
        </Alert>
      )}

      {/* Attachments validation alert */}
      {!hasAttachments && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este registro não possui anexos. Adicione pelo menos um documento antes de enviar ao financeiro.
          </AlertDescription>
        </Alert>
      )}

      {/* Payment policy banner */}
      {activePolicy && (
        <Alert variant={withinCutoff ? "default" : "destructive"}>
          {withinCutoff ? <CalendarCheck className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
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
        <FinancialFieldsSuggestion
          expenseId={expenseId}
          onApplySuggestions={(fields) => {
            setFormData((prev) => ({
              ...prev,
              document_type: fields.document_type || prev.document_type,
              portador: fields.portador || prev.portador,
              due_date: fields.due_date || prev.due_date,
            }));
          }}
        />

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
                          <span className="text-muted-foreground">Selecione um fornecedor...</span>
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
                                onSelect={() => handleSelectFornecedor(fornecedor.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    fornecedorId === fornecedor.id ? "opacity-100" : "opacity-0"
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
              onChange={(e) => setFormData({ ...formData, supplier_document: e.target.value })}
              disabled={isCorrection && locks?.supplier_document}
              placeholder="Preenchido automaticamente"
              className="bg-muted/50"
            />
          </div>

          {/* Supplier payment info */}
          {(fornecedorId || (isCorrection && formData.supplier_name)) && (
            <FornecedorPaymentInfo
              fornecedorId={fornecedorId || undefined}
              supplierName={formData.supplier_name}
              supplierDocument={formData.supplier_document}
            />
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
                onValueChange={(value) => setFormData({ ...formData, document_type: value })}
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
                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                disabled={isCorrection && locks?.document_number}
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
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                disabled={isCorrection && locks?.due_date}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="portador">Portador/Forma de Pagamento *</Label>
              <Select
                value={formData.portador}
                onValueChange={(value) => setFormData({ ...formData, portador: value })}
                disabled={isCorrection && locks?.portador}
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
            onChange={(e) => setFormData({ ...formData, payment_notes: e.target.value })}
            placeholder="Informações adicionais para o financeiro..."
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" />
            Enviar ao Financeiro
          </Button>
        </div>
      </form>
    </div>
  );
}

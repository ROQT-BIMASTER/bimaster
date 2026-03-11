import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_TYPES, usePortadores } from "@/hooks/useEventExpenses";
import { Loader2, Send, FileText, Building2, Check, ChevronsUpDown, SplitSquareVertical, AlertTriangle, CalendarCheck, Clock } from "lucide-react";
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

interface SiblingInstallment {
  id: string;
  installment_number: number;
  installment_total: number;
  valor_realizado: number;
  valor_previsto: number;
  due_date: string | null;
  status: string;
  boleto_barcode: string | null;
}

interface EnviarFinanceiroDialogProps {
  expenseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnviarFinanceiroDialog({ 
  expenseId, 
  open, 
  onOpenChange 
}: EnviarFinanceiroDialogProps) {
  const { data: portadores } = usePortadores();
  const { data: activePolicy } = useActivePaymentPolicy();
  const { data: correctionRule } = useActiveCorrectionRule();

  const [loading, setLoading] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [openCombobox, setOpenCombobox] = useState(false);
  const [siblingEntries, setSiblingEntries] = useState<SiblingInstallment[]>([]);
  const [expenseInfo, setExpenseInfo] = useState<{ 
    status: string | null; 
    attachments: any[] | null;
    installment_number: number | null; 
    installment_total: number | null; 
    installment_group_id: string | null;
    boleto_barcode: string | null;
    payment_queue_id: string | null;
    supplier_name: string | null;
    supplier_document: string | null;
    document_type: string | null;
    document_number: string | null;
    due_date: string | null;
    portador: string | null;
    payment_notes: string | null;
    valor_realizado: number;
    valor_previsto: number;
    description: string | null;
    event_id: string | null;
    empresa_id: number | null;
    empresa_nome: string | null;
  } | null>(null);

  const [formData, setFormData] = useState({
    supplier_name: "",
    supplier_document: "",
    document_type: "",
    document_number: "",
    due_date: "",
    portador: "",
    payment_notes: "",
  });

  const hasAttachments = expenseInfo?.attachments && expenseInfo.attachments.length > 0;
  const isApproved = expenseInfo?.status === "approved";
  const withinCutoff = activePolicy ? isWithinCutoff(activePolicy) : true;
  const isInstallment = !!(expenseInfo?.installment_number) && !!(expenseInfo?.installment_total);
  const boletoBarcode = expenseInfo?.boleto_barcode;
  const isCorrection = !!expenseInfo?.payment_queue_id;
  const locks = isCorrection ? getCorrectionLocks(correctionRule) : null;

  // Fetch suppliers + expense info + siblings when dialog opens
  useEffect(() => {
    if (!open) return;

    supabase
      .from("fabrica_fornecedores")
      .select("id, razao_social, cnpj")
      .eq("ativo", true)
      .order("razao_social")
      .then(({ data }) => setFornecedores(data || []));

    supabase
      .from("corporate_event_expenses")
      .select("status, attachments, installment_number, installment_total, installment_group_id, boleto_barcode, payment_queue_id, supplier_name, supplier_document, document_type, document_number, due_date, portador, payment_notes, valor_realizado, valor_previsto, description, event_id, empresa_id, empresa_nome")
      .eq("id", expenseId)
      .single()
      .then(({ data }) => {
        if (data) {
          const info = {
            status: data.status,
            attachments: (data.attachments as any[]) || [],
            installment_number: data.installment_number,
            installment_total: data.installment_total,
            installment_group_id: (data as any).installment_group_id || null,
            boleto_barcode: data.boleto_barcode,
            payment_queue_id: (data as any).payment_queue_id || null,
            supplier_name: (data as any).supplier_name || null,
            supplier_document: (data as any).supplier_document || null,
            document_type: (data as any).document_type || null,
            document_number: (data as any).document_number || null,
            due_date: (data as any).due_date || null,
            portador: (data as any).portador || null,
            payment_notes: (data as any).payment_notes || null,
            valor_realizado: data.valor_realizado || 0,
            valor_previsto: data.valor_previsto || 0,
            description: data.description || null,
            event_id: data.event_id || null,
            empresa_id: (data as any).empresa_id || null,
            empresa_nome: (data as any).empresa_nome || null,
          };
          setExpenseInfo(info);

          // Pre-fill form if correction or re-send
          if (info.payment_queue_id || info.supplier_name) {
            setFormData((prev) => ({
              ...prev,
              supplier_name: info.supplier_name || prev.supplier_name,
              supplier_document: info.supplier_document || prev.supplier_document,
              document_type: info.document_type || prev.document_type,
              document_number: info.document_number || prev.document_number,
              due_date: info.due_date || prev.due_date,
              portador: info.portador || prev.portador,
              payment_notes: info.payment_notes || prev.payment_notes,
            }));
          }

          // Fetch sibling installments
          if (info.installment_group_id) {
            supabase
              .from("corporate_event_expenses")
              .select("id, installment_number, installment_total, valor_realizado, valor_previsto, due_date, status, boleto_barcode")
              .eq("installment_group_id", info.installment_group_id)
              .neq("id", expenseId)
              .order("installment_number")
              .then(({ data: siblings }) => {
                setSiblingEntries((siblings || []) as unknown as SiblingInstallment[]);
              });
          }
        }
      });
  }, [open, expenseId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFornecedorId("");
      setExpenseInfo(null);
      setSiblingEntries([]);
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
    const fornecedor = fornecedores.find(f => f.id === id);
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
          setFornecedores(prev => [...prev, data]);
          setFornecedorId(data.id);
          setFormData({
            ...formData,
            supplier_name: data.razao_social,
            supplier_document: data.cnpj || "",
          });
        }
      });
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isApproved) {
      toast.error("Despesa precisa estar aprovada para enviar ao financeiro");
      return;
    }

    if (!hasAttachments) {
      toast.error("Adicione pelo menos um anexo antes de enviar ao financeiro");
      return;
    }

    if ((!fornecedorId && !isCorrection) || !formData.document_type || !formData.document_number || !formData.due_date || !formData.portador) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const code = `EVT-${Date.now()}`;
      const existingQueueId = expenseInfo?.payment_queue_id;

      // Get user name for history
      let userName = "Usuário";
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
      if (profile?.nome) userName = profile.nome;

      // Build notes with boleto and installment info
      const noteParts: string[] = [];
      if (formData.payment_notes) noteParts.push(formData.payment_notes);
      if (boletoBarcode) noteParts.push(`Linha digitável: ${boletoBarcode}`);
      if (isInstallment) noteParts.push(`Parcela ${expenseInfo!.installment_number}/${expenseInfo!.installment_total}`);
      const notes = noteParts.join(" | ") || null;

      const amount = expenseInfo?.valor_realizado || expenseInfo?.valor_previsto || 0;

      const queuePayload = {
        source_type: "event_expense" as const,
        source_id: expenseId,
        source_code: null as string | null,
        supplier_name: formData.supplier_name,
        supplier_document: formData.supplier_document || null,
        document_type: formData.document_type,
        document_number: formData.document_number,
        amount,
        due_date: formData.due_date,
        portador: formData.portador,
        description: expenseInfo?.description || null,
        notes,
        department_name: "Eventos Corporativos",
        requested_by: user.id,
        attachments: expenseInfo?.attachments || null,
        empresa_id: expenseInfo?.empresa_id || null,
        empresa_nome: expenseInfo?.empresa_nome || null,
      };

      let finalQueueId = existingQueueId;

      if (existingQueueId) {
        // CORRECTION: Update existing record
        const { error: updateQueueError } = await supabase
          .from("financial_payment_queue")
          .update({
            ...queuePayload,
            financial_status: 'pending',
            financial_notes: null,
            reviewed_at: null,
            reviewed_by: null,
            rejection_category: null,
            rejection_fields: null,
          })
          .eq("id", existingQueueId);

        if (updateQueueError) throw updateQueueError;

        // Record correction in history
        await supabase.from("financial_payment_queue_history" as any).insert({
          payment_queue_id: existingQueueId,
          changed_by: user.id,
          changed_by_name: userName,
          action: 'corrected',
          snapshot: queuePayload,
        });

        finalQueueId = existingQueueId;
      } else {
        // FIRST SUBMISSION
        const { data: queueEntry, error: queueError } = await supabase
          .from("financial_payment_queue")
          .insert({ code, ...queuePayload })
          .select("id")
          .single();

        if (queueError) throw queueError;
        finalQueueId = queueEntry.id;

        // Record submission in history
        await supabase.from("financial_payment_queue_history" as any).insert({
          payment_queue_id: queueEntry.id,
          changed_by: user.id,
          changed_by_name: userName,
          action: 'submitted',
          snapshot: queuePayload,
        });
      }

      // Update expense with financial fields
      const { error: updateError } = await supabase
        .from("corporate_event_expenses")
        .update({
          payment_queue_id: finalQueueId,
          supplier_name: formData.supplier_name,
          supplier_document: formData.supplier_document || null,
          document_type: formData.document_type,
          document_number: formData.document_number,
          due_date: formData.due_date,
          portador: formData.portador,
          payment_notes: notes,
        })
        .eq("id", expenseId);

      if (updateError) throw updateError;

      toast.success("Despesa enviada ao financeiro com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const selectedFornecedor = fornecedores.find(f => f.id === fornecedorId);

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

        {/* Installment context with siblings */}
        {isInstallment && (
          <Alert>
            <SplitSquareVertical className="h-4 w-4" />
            <AlertDescription>
              Esta é a <strong>parcela {expenseInfo!.installment_number} de {expenseInfo!.installment_total}</strong>.
              {boletoBarcode && (
                <span className="block mt-1 font-mono text-xs break-all">
                  Linha digitável: {boletoBarcode}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Sibling installments card */}
        {isInstallment && siblingEntries.length > 0 && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Outras parcelas do grupo:</p>
            <div className="space-y-1.5">
              {siblingEntries.map((sibling) => (
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
        {expenseInfo && !isApproved && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta despesa ainda não foi aprovada. Somente despesas aprovadas podem ser enviadas ao financeiro.
            </AlertDescription>
          </Alert>
        )}

        {/* Attachments validation alert */}
        {expenseInfo && !hasAttachments && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta despesa não possui anexos. Adicione pelo menos um documento antes de enviar ao financeiro.
            </AlertDescription>
          </Alert>
        )}

        {/* Payment policy banner */}
        {activePolicy && (
          <Alert variant={withinCutoff ? "default" : "destructive"}>
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
          {/* Sugestões IA */}
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
                  required
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
                  required
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || (!fornecedorId && !isCorrection) || !hasAttachments || !isApproved}
            >
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

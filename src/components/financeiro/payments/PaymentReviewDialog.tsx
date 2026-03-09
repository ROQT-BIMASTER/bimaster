import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarcarPagoDialog } from "./MarcarPagoDialog";
import { RejeicaoFinanceiraDialog, REJECTION_CATEGORY_LABELS, type RejectionData } from "./RejeicaoFinanceiraDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Wallet, Target, Calendar, Building2, FileText, ExternalLink, Loader2, AlertTriangle, Paperclip, UserCircle, ShieldCheck, MessageCircle, RotateCcw, Pencil, Save, X, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatLocalDate, parseLocalDate, getToday } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";
import { resolveStorageUrl } from "@/lib/utils/storage-url";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { PaymentQueueItem, SourceType, PaymentQueueStatus } from "@/hooks/useFinancialPaymentQueue";
import { AttachmentAcknowledgement } from "./AttachmentAcknowledgement";
import { SupplierDetailsCard } from "./SupplierDetailsCard";
import { SupplierPaymentHistory } from "./SupplierPaymentHistory";
import { ReceiptUploadSection } from "./ReceiptUploadSection";
import { PaymentChatPanel } from "./PaymentChatPanel";
import { PaymentQueueHistory } from "@/components/shared/PaymentQueueHistory";
import { usePaymentMessages } from "@/hooks/usePaymentMessages";
import { PasswordConfirmDialog } from "@/components/dre/PasswordConfirmDialog";
import { PaymentBankPrintSummary } from "./PaymentBankPrintSummary";
import { QuickDueDateChange } from "./QuickDueDateChange";

interface PaymentReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PaymentQueueItem | null;
  onAccept: (id: string, notes?: string) => void;
  onReject: (id: string, notes: string, rejectionCategory?: string, rejectionFields?: string[]) => void;
  onMarkPaid: (id: string, paymentMethod: string, paymentDetails: Record<string, string>, notes?: string) => void;
  onReopen?: (id: string) => void;
  isProcessing: boolean;
  onRefresh?: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const sourceTypeLabels: Record<SourceType, string> = {
  trade_entry: "Trade Marketing - Lançamento Financeiro",
  trade_investment: "Trade Marketing - Investimento",
  trade_campaign: "Trade Marketing - Campanha",
  event_expense: "Eventos Corporativos - Despesa",
  department_expense: "Departamento - Despesa",
};

const statusConfig: Record<PaymentQueueStatus, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-amber-500" },
  accepted: { label: "Aceito", color: "bg-emerald-500" },
  rejected: { label: "Rejeitado", color: "bg-red-500" },
  paid: { label: "Pago", color: "bg-blue-500" },
  cancelled: { label: "Cancelado", color: "bg-gray-500" },
};

export function PaymentReviewDialog({
  open,
  onOpenChange,
  item,
  onAccept,
  onReject,
  onMarkPaid,
  onReopen,
  isProcessing,
  onRefresh,
}: PaymentReviewDialogProps) {
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState<'accept' | 'reject' | 'paid' | null>(null);
  const [allAttachmentsAcknowledged, setAllAttachmentsAcknowledged] = useState(false);
  const [marcarPagoOpen, setMarcarPagoOpen] = useState(false);
  const [rejeicaoOpen, setRejeicaoOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    document_type: "",
    document_number: "",
    due_date: "",
    portador: "",
    amount: 0,
    description: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const { messages } = usePaymentMessages(item?.id || null);

  const startEdit = () => {
    if (!item) return;
    setEditForm({
      document_type: item.document_type || "",
      document_number: item.document_number || "",
      due_date: item.due_date || "",
      portador: item.portador || "",
      amount: item.amount,
      description: item.description || "",
    });
    setPasswordDialogOpen(true);
  };

  const handlePasswordConfirmed = async (justificativa: string, userInfo: { id: string; email: string; nome: string }) => {
    setEditMode(true);
    // Store userInfo for later save
    (window as any).__editUserInfo = userInfo;
    (window as any).__editJustificativa = justificativa;
  };

  const handleSaveEdit = async () => {
    if (!item) return;
    setIsSavingEdit(true);
    const userInfo = (window as any).__editUserInfo;
    const justificativa = (window as any).__editJustificativa;

    try {
      // Build snapshot of old values
      const oldSnapshot: Record<string, any> = {
        document_type: item.document_type,
        document_number: item.document_number,
        due_date: item.due_date,
        portador: item.portador,
        amount: item.amount,
        description: item.description,
      };

      // Update record
      const { error } = await supabase
        .from("financial_payment_queue")
        .update({
          document_type: editForm.document_type,
          document_number: editForm.document_number,
          due_date: editForm.due_date,
          portador: editForm.portador,
          amount: editForm.amount,
          description: editForm.description,
        })
        .eq("id", item.id);

      if (error) throw error;

      // Log history
      const changes: Record<string, { old: any; new: any }> = {};
      for (const key of Object.keys(editForm) as (keyof typeof editForm)[]) {
        if (String(editForm[key]) !== String(oldSnapshot[key])) {
          changes[key] = { old: oldSnapshot[key], new: editForm[key] };
        }
      }

      await supabase.from("financial_payment_queue_history").insert({
        payment_queue_id: item.id,
        changed_by: userInfo?.id || null,
        changed_by_name: userInfo?.nome || null,
        action: "edited_by_financial",
        snapshot: { ...editForm, justificativa },
        changes,
      });

      toast.success("Documento atualizado com sucesso");
      setEditMode(false);
      delete (window as any).__editUserInfo;
      delete (window as any).__editJustificativa;
      onRefresh?.();
    } catch (err: any) {
      toast.error("Erro ao salvar alterações: " + (err.message || ""));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    delete (window as any).__editUserInfo;
    delete (window as any).__editJustificativa;
  };

  const handleAction = (actionType: 'accept' | 'reject' | 'paid') => {
    if (!item) return;
    
    if (actionType === 'paid') {
      setMarcarPagoOpen(true);
      return;
    }

    if (actionType === 'reject') {
      setRejeicaoOpen(true);
      return;
    }

    setAction(actionType);
    
    if (actionType === 'accept') {
      onAccept(item.id, notes);
    }
  };

  const handleConfirmarRejeicao = (data: RejectionData) => {
    if (!item) return;
    const formattedNotes = data.notes
      ? `${REJECTION_CATEGORY_LABELS[data.category] || data.category}: ${data.notes}`
      : REJECTION_CATEGORY_LABELS[data.category] || data.category;
    setAction('reject');
    onReject(item.id, formattedNotes, data.category, data.fields);
    setRejeicaoOpen(false);
  };

  const handleConfirmarPago = (paymentMethod: string, paymentDetails: Record<string, string>, observacoes: string) => {
    if (!item) return;
    setAction('paid');
    onMarkPaid(item.id, paymentMethod, paymentDetails, observacoes || notes);
    setMarcarPagoOpen(false);
  };

  const handleClose = () => {
    setNotes("");
    setAction(null);
    setAllAttachmentsAcknowledged(false);
    setEditMode(false);
    onOpenChange(false);
  };

  if (!item) return null;

  const parsedDueDate = parseLocalDate(item.due_date);
  const today = getToday();
  const isOverdue = parsedDueDate ? parsedDueDate < today : false;
  const isPending = item.financial_status === 'pending';
  const isAccepted = item.financial_status === 'accepted';
  const isPaid = item.financial_status === 'paid';
  const isRejected = item.financial_status === 'rejected';
  const status = statusConfig[item.financial_status];
  const hasAttachments = item.attachments && item.attachments.length > 0;
  const canAccept = !hasAttachments || allAttachmentsAcknowledged;
  const showReceiptSection = isAccepted || isPaid;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Revisão de Pagamento
            </DialogTitle>
            <Badge className={cn("text-white", status.color)}>{status.label}</Badge>
          </div>
          <DialogDescription>
            {item.code} • {sourceTypeLabels[item.source_type]}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              Comunicação
              {messages.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
                  {messages.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Revisão de Pagamento
            </DialogTitle>
            <Badge className={cn("text-white", status.color)}>{status.label}</Badge>
          </div>
          <DialogDescription>
            {item.code} • {sourceTypeLabels[item.source_type]}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Supplier Details with enrichment */}
          <SupplierDetailsCard
            supplierName={item.supplier_name}
            supplierDocument={item.supplier_document}
          />

          {/* Payment Info Card */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-muted-foreground text-xs">Valor</Label>
                  {editMode ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                      className="text-xl font-bold w-48 mt-1"
                    />
                  ) : (
                    <p className="text-2xl font-bold text-primary">{formatCurrency(item.amount)}</p>
                  )}
                </div>
                {!editMode && !isPaid && (
                  <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                )}
                {editMode && (
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={cancelEdit} disabled={isSavingEdit}>
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit}>
                      {isSavingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Salvar
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Vencimento</Label>
                  {editMode ? (
                    <Input
                      type="date"
                      value={editForm.due_date}
                      onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <p className={cn("font-medium", isOverdue && isPending && "text-destructive")}>
                        {formatLocalDate(item.due_date, "dd/MM/yyyy")}
                        {isOverdue && isPending && <span className="text-xs block">Vencido</span>}
                      </p>
                      {!isPaid && (
                        <QuickDueDateChange
                          paymentQueueId={item.id}
                          currentDueDate={item.due_date}
                          code={item.code}
                          onChanged={() => onRefresh?.()}
                        />
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Tipo Documento</Label>
                  {editMode ? (
                    <Select value={editForm.document_type} onValueChange={(v) => setEditForm({ ...editForm, document_type: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["nfse", "nfe", "boleto", "recibo", "contrato", "orcamento", "outros"].map((t) => (
                          <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{item.document_type || "-"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Nº Documento</Label>
                  {editMode ? (
                    <Input
                      value={editForm.document_number}
                      onChange={(e) => setEditForm({ ...editForm, document_number: e.target.value })}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium">{item.document_number || "-"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Portador</Label>
                  {editMode ? (
                    <Select value={editForm.portador} onValueChange={(v) => setEditForm({ ...editForm, portador: v })}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["PIX", "Boleto", "TED", "DOC", "Cartão", "Dinheiro", "Cheque", "Depósito"].map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{item.portador || "-"}</p>
                  )}
                </div>
              </div>

              {(item.description || editMode) && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground text-xs">Descrição</Label>
                    {editMode ? (
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm">{item.description}</p>
                    )}
                  </div>
                </>
              )}

              {item.notes && !editMode && (
                <div>
                  <Label className="text-muted-foreground text-xs">Observações</Label>
                  <p className="text-sm">{item.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Origin Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                {item.source_type.startsWith('trade') ? (
                  <Target className="h-4 w-4 text-blue-500" />
                ) : (
                  <Calendar className="h-4 w-4 text-pink-500" />
                )}
                <span className="font-medium">Origem da Solicitação</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Código Origem</Label>
                  <p className="font-medium">{item.source_code || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Departamento</Label>
                  <p className="font-medium">{item.department_name || "Trade Marketing"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Solicitado em</Label>
                  <p className="font-medium">
                    {format(new Date(item.requested_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Histórico de pagamentos do fornecedor */}
          <SupplierPaymentHistory
            supplierName={item.supplier_name}
            supplierDocument={item.supplier_document}
            currentItemId={item.id}
          />

          {/* Rastreabilidade */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="font-medium">Rastreabilidade</span>
              </div>
              <div className="space-y-3">
                {/* Solicitante */}
                <div className="flex items-start gap-3">
                  <UserCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      Solicitado por: {item.requester_name || 'Usuário não identificado'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.requested_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {/* Revisor */}
                {item.reviewed_by && (
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">
                        Revisado por: {item.reviewer_name || 'Usuário não identificado'}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {item.reviewed_at && format(new Date(item.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {statusConfig[item.financial_status]?.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Empresa/Filial */}
                {item.empresa_nome && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Empresa: {item.empresa_nome}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Alterações */}
          <Card>
            <CardContent className="p-4">
              <PaymentQueueHistory paymentQueueId={item.id} />
            </CardContent>
          </Card>
          {item.attachment_url && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Documento anexado</span>
                  <Button variant="outline" size="sm" onClick={async () => {
                    const { signedUrl, error } = await resolveStorageUrl(item.attachment_url!);
                    if (error || !signedUrl) { toast.error(error || "Erro ao abrir documento"); return; }
                    window.open(signedUrl, "_blank");
                  }}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visualizar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attachments Acknowledgement - Required for approval */}
          {hasAttachments && isPending && (
            <Card className={cn(
              "border-2",
              canAccept ? "border-emerald-500/50" : "border-amber-500/50"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="h-4 w-4 text-primary" />
                  <Label className="font-medium">
                    Documentos Anexados ({item.attachments.length})
                  </Label>
                </div>
                <AttachmentAcknowledgement
                  attachments={item.attachments}
                  onAllAcknowledged={setAllAttachmentsAcknowledged}
                />
                {!canAccept && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Você deve abrir e confirmar ciência de todos os documentos antes de aprovar.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Receipt Upload Section - for accepted/paid payments */}
          {showReceiptSection && (
            <ReceiptUploadSection
              paymentId={item.id}
              receiptUrl={(item as any).receipt_url || null}
              receiptSentAt={(item as any).receipt_sent_at || null}
              requestedBy={item.requested_by}
              requesterName={item.requester_name || null}
              supplierName={item.supplier_name}
              amount={item.amount}
              code={item.code}
              onReceiptUploaded={() => onRefresh?.()}
            />
          )}

          {/* Payment Method Details - for paid items */}
          {isPaid && (item as any).payment_method && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Dados do Pagamento</Label>
                </div>
                <div className="space-y-1 text-sm">
                  <p><strong>Método:</strong> {(item as any).payment_method}</p>
                  {(item as any).payment_details && Object.entries((item as any).payment_details as Record<string, string>).map(([key, value]) => 
                    value ? (
                      <p key={key}>
                        <strong>{key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}:</strong> {value}
                      </p>
                    ) : null
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {item.financial_notes && !isPending && (
            <Card className="border-primary/30">
              <CardContent className="p-4">
                <Label className="text-muted-foreground text-xs">Observações do Financeiro</Label>
                <p className="text-sm mt-1">{item.financial_notes}</p>
                {item.reviewed_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Revisado em {format(new Date(item.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Notes - Only for pending items */}
          {(isPending || isAccepted) && (
            <div className="space-y-2">
              <Label htmlFor="notes">
                Observações do Financeiro
                {action === 'reject' && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Textarea
                id="notes"
                placeholder="Adicione observações sobre esta revisão..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <PaymentChatPanel
              paymentQueueId={item.id}
              userType="financeiro"
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 mr-auto">
            <PaymentBankPrintSummary item={item} />
          </div>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Fechar
          </Button>
          
          {isPending && (
            <>
              <Button
                variant="destructive"
                onClick={() => handleAction('reject')}
                disabled={isProcessing}
              >
                {isProcessing && action === 'reject' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Rejeitar
              </Button>
              <Button
                variant="default"
                onClick={() => handleAction('accept')}
                disabled={isProcessing || !canAccept}
                title={!canAccept ? "Confirme todos os documentos antes de aprovar" : undefined}
              >
                {isProcessing && action === 'accept' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Aceitar e Criar Conta
              </Button>
            </>
          )}

          {isAccepted && (
            <Button
              variant="default"
              onClick={() => handleAction('paid')}
              disabled={isProcessing}
            >
              {isProcessing && action === 'paid' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Wallet className="h-4 w-4 mr-2" />
              )}
              Marcar como Pago
            </Button>
          )}

          {isRejected && onReopen && (
            <Button
              variant="default"
              onClick={() => {
                onReopen(item.id);
                handleClose();
              }}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Reabrir para Reanálise
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {item && (
        <>
          <MarcarPagoDialog
            open={marcarPagoOpen}
            onOpenChange={setMarcarPagoOpen}
            supplierName={item.supplier_name}
            amount={item.amount}
            dueDate={item.due_date}
            code={item.code}
            onConfirmar={handleConfirmarPago}
            isProcessing={isProcessing}
          />
          <RejeicaoFinanceiraDialog
            open={rejeicaoOpen}
            onOpenChange={setRejeicaoOpen}
            supplierName={item.supplier_name}
            amount={item.amount}
            code={item.code}
            onConfirmar={handleConfirmarRejeicao}
            isProcessing={isProcessing}
          />
          <PasswordConfirmDialog
            open={passwordDialogOpen}
            onOpenChange={setPasswordDialogOpen}
            onConfirm={handlePasswordConfirmed}
            title="Editar Dados do Documento"
            description="Para editar os dados do documento, confirme sua senha e forneça uma justificativa para auditoria."
            actionLabel="Desbloquear Edição"
          />
        </>
      )}
    </Dialog>
  );
}

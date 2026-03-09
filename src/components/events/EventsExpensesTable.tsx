import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  EventExpense, 
  useEventExpenses, 
  EXPENSE_CATEGORIES 
} from "@/hooks/useEventExpenses";
import { EnviarFinanceiroDialog } from "@/components/events/EnviarFinanceiroDialog";
import { PaymentChatPanel } from "@/components/financeiro/payments/PaymentChatPanel";
import { FinancialRejectionBanner } from "@/components/shared/FinancialRejectionBanner";
import { useExpenseFinancialStatus } from "@/hooks/useExpenseFinancialStatus";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Send,
  Banknote,
  FileText,
  Barcode,
  Copy,
  AlertTriangle,
  MessageCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { PaymentPolicyBanner } from "@/components/financeiro/payments/PaymentPolicyBanner";
import { toast } from "sonner";

interface EventsExpensesTableProps {
  expenses: EventExpense[];
  isLoading: boolean;
  eventStatus: string;
}

export function EventsExpensesTable({ expenses, isLoading, eventStatus }: EventsExpensesTableProps) {
  const { approveExpense, rejectExpense } = useEventExpenses();
  const [sendFinancialDialogOpen, setSendFinancialDialogOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [chatExpense, setChatExpense] = useState<EventExpense | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { isAdminOrSupervisor } = useUserRole();

  // Fetch financial status for expenses with payment_queue_id
  const paymentQueueIds = expenses.map((e: any) => e.payment_queue_id);
  const { data: financialStatusMap } = useExpenseFinancialStatus(paymentQueueIds);

  const getCategoryLabel = (category: string) => {
    return EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const getStatusBadge = (status: string, paymentQueueId?: string | null) => {
    // Check if financial team rejected this expense
    const financialInfo = paymentQueueId ? financialStatusMap?.get(paymentQueueId) : null;
    if (financialInfo?.financial_status === "rejected") {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Rejeitado Financeiro
        </Badge>
      );
    }

    const config: Record<string, { variant: any; label: string; icon: any }> = {
      pending: { variant: "outline", label: "Pendente", icon: Clock },
      approved: { variant: "default", label: "Aprovada", icon: CheckCircle },
      rejected: { variant: "destructive", label: "Rejeitada", icon: XCircle },
      pending_financial: { variant: "secondary", label: "Aguardando Financeiro", icon: Banknote },
      paid: { variant: "default", label: "Pago", icon: DollarSign },
    };

    const { variant, label, icon: Icon } = config[status] || config.pending;

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = async (id: string) => {
    await approveExpense.mutateAsync(id);
  };

  const handleReject = async (id: string) => {
    await rejectExpense.mutateAsync({ id, reason: "Rejeitado pelo aprovador" });
  };

  const handleSendToFinancial = (id: string) => {
    setSelectedExpenseId(id);
    setSendFinancialDialogOpen(true);
  };

  const copyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    toast.success("Linha digitável copiada!");
  };

  const isFinanciallyRejected = (expense: any): boolean => {
    const info = expense.payment_queue_id ? financialStatusMap?.get(expense.payment_queue_id) : null;
    return info?.financial_status === "rejected";
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg bg-muted/30">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhuma despesa registrada</h3>
        <p className="text-muted-foreground">
          Adicione despesas para este evento
        </p>
      </div>
    );
  }

  const canApprove = isAdminOrSupervisor && (eventStatus === "approved" || eventStatus === "in_progress");

  return (
    <TooltipProvider>
      <PaymentPolicyBanner />
      <div className="border rounded-lg overflow-x-auto mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor Previsto</TableHead>
              <TableHead className="text-right">Valor Realizado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Boleto</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Chat</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense: any) => {
              const hasRejection = isFinanciallyRejected(expense);
              const isExpanded = expandedRows.has(expense.id);
              const financialInfo = expense.payment_queue_id ? financialStatusMap?.get(expense.payment_queue_id) : null;

              return (
                <>
                  <TableRow key={expense.id} className={hasRejection ? "bg-destructive/5 border-l-2 border-l-destructive" : ""}>
                    <TableCell className="w-[40px] px-2">
                      {hasRejection && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleRow(expense.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getCategoryLabel(expense.category)}
                      {expense.document_type === "orcamento" && expense.status !== "rejected" && (
                        <Badge variant="outline" className="ml-2 text-xs border-amber-500 text-amber-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Pendente NF
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {expense.description || "-"}
                    </TableCell>
                    <TableCell>
                      {expense.installment_number && expense.installment_total ? (
                        <Badge variant="secondary" className="text-xs">
                          {expense.installment_number}/{expense.installment_total}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {expense.expense_date 
                        ? format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {(expense.valor_previsto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      R$ {(expense.valor_realizado || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{getStatusBadge(expense.status, expense.payment_queue_id)}</TableCell>
                    <TableCell>
                      {expense.boleto_barcode ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyBarcode(expense.boleto_barcode)}
                            >
                              <Barcode className="h-4 w-4 text-primary" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-mono text-xs break-all">{expense.boleto_barcode}</p>
                            <p className="text-xs text-muted-foreground mt-1">Clique para copiar</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {expense.supplier_name || "-"}
                    </TableCell>
                    <TableCell>
                      {(expense as any).payment_queue_id ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setChatExpense(expense)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {expense.boleto_barcode && (
                            <DropdownMenuItem onClick={() => copyBarcode(expense.boleto_barcode)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar Linha Digitável
                            </DropdownMenuItem>
                          )}
                          {(expense as any).payment_queue_id && (
                            <DropdownMenuItem onClick={() => setChatExpense(expense)}>
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Comunicação Financeiro
                            </DropdownMenuItem>
                          )}
                          {hasRejection && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => toggleRow(expense.id)}>
                                <AlertTriangle className="mr-2 h-4 w-4 text-destructive" />
                                Ver Motivo da Rejeição
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendToFinancial(expense.id)}>
                                <Send className="mr-2 h-4 w-4" />
                                Corrigir e Reenviar
                              </DropdownMenuItem>
                            </>
                          )}
                          {expense.status === "pending" && canApprove && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleApprove(expense.id)}>
                                <CheckCircle className="mr-2 h-4 w-4 text-success" />
                                Aprovar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(expense.id)}>
                                <XCircle className="mr-2 h-4 w-4 text-destructive" />
                                Rejeitar
                              </DropdownMenuItem>
                            </>
                          )}
                          {expense.status === "approved" && !hasRejection && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSendToFinancial(expense.id)}>
                                <Send className="mr-2 h-4 w-4" />
                                Enviar ao Financeiro
                              </DropdownMenuItem>
                            </>
                          )}
                          {expense.status === "pending_financial" && !hasRejection && (
                            <DropdownMenuItem disabled>
                              <Banknote className="mr-2 h-4 w-4" />
                              Aguardando Pagamento
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {/* Expandable rejection details */}
                  {hasRejection && isExpanded && financialInfo && (
                    <TableRow key={`${expense.id}-rejection`}>
                      <TableCell colSpan={12} className="bg-destructive/5 p-0">
                        <div className="px-6 py-3">
                          <FinancialRejectionBanner
                            info={financialInfo}
                            onResubmit={() => handleSendToFinancial(expense.id)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedExpenseId && (
        <EnviarFinanceiroDialog
          expenseId={selectedExpenseId}
          open={sendFinancialDialogOpen}
          onOpenChange={(open) => {
            setSendFinancialDialogOpen(open);
            if (!open) setSelectedExpenseId(null);
          }}
        />
      )}

      {/* Chat Dialog */}
      <Dialog open={!!chatExpense} onOpenChange={(open) => !open && setChatExpense(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Comunicação Financeiro
            </DialogTitle>
          </DialogHeader>
          {chatExpense && (chatExpense as any).payment_queue_id && (
            <PaymentChatPanel
              paymentQueueId={(chatExpense as any).payment_queue_id}
              userType="solicitante"
            />
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

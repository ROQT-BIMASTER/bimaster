import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DepartmentExpense, DEPARTMENT_EXPENSE_CATEGORIES } from "@/hooks/useDepartmentExpenses";
import { EnviarFinanceiroDepDialog } from "@/components/departments/EnviarFinanceiroDepDialog";
import { AprovarDespesaDepartamentoDialog } from "@/components/departments/AprovarDespesaDepartamentoDialog";
import { DepartmentExpenseAttachments } from "@/components/departments/DepartmentExpenseAttachments";
import { PaymentChatPanel } from "@/components/financeiro/payments/PaymentChatPanel";
import { FinancialRejectionBanner } from "@/components/shared/FinancialRejectionBanner";
import { useExpenseFinancialStatus } from "@/hooks/useExpenseFinancialStatus";
import { toast } from "sonner";
import { 
  Search, 
  MoreHorizontal, 
  FileText, 
  Clock,
  CheckCircle,
  XCircle,
  Send,
  DollarSign,
  Paperclip,
  Building,
  Barcode,
  Copy,
  AlertTriangle,
  MessageCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface DepartmentExpensesTableProps {
  expenses: DepartmentExpense[];
  isLoading: boolean;
  isManager?: boolean;
  isFinanceiro?: boolean;
  departmentId: string;
}

export function DepartmentExpensesTable({ 
  expenses, 
  isLoading, 
  isManager,
  isFinanceiro,
  departmentId 
}: DepartmentExpensesTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [enviarFinanceiroOpen, setEnviarFinanceiroOpen] = useState(false);
  const [aprovarOpen, setAprovarOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [chatExpense, setChatExpense] = useState<DepartmentExpense | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<DepartmentExpense | null>(null);

  const filteredExpenses = expenses.filter(expense =>
    expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; label: string; icon: any }> = {
      pending: { variant: "secondary", label: "Pendente", icon: Clock },
      approved: { variant: "default", label: "Aprovado", icon: CheckCircle },
      rejected: { variant: "destructive", label: "Rejeitado", icon: XCircle },
      pending_financial: { variant: "outline", label: "Aguardando Financeiro", icon: Send },
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

  const getCategoryLabel = (value: string) => {
    const cat = DEPARTMENT_EXPENSE_CATEGORIES.find(c => c.value === value);
    return cat?.label || value;
  };

  const copyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    toast.success("Linha digitável copiada!");
  };

  const handleEnviarFinanceiro = (expense: DepartmentExpense) => {
    setSelectedExpense(expense);
    setEnviarFinanceiroOpen(true);
  };

  const handleAprovar = (expense: DepartmentExpense) => {
    setSelectedExpense(expense);
    setAprovarOpen(true);
  };

  const handleOpenAttachments = (expense: DepartmentExpense) => {
    setSelectedExpense(expense);
    setAttachmentsOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Despesas do Departamento</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar despesas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhuma despesa encontrada</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Tente ajustar sua busca" : "Crie uma nova despesa para começar"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Valor Previsto</TableHead>
                  <TableHead>Valor Realizado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Boleto</TableHead>
                  <TableHead>Anexos</TableHead>
                  <TableHead>Chat</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense: any) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-mono text-sm">{expense.code}</TableCell>
                    <TableCell>
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
                      {expense.empresa_nome || expense.empresa?.nome ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Building className="h-3 w-3 text-muted-foreground" />
                          <span>{expense.empresa_nome || expense.empresa?.nome}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      R$ {(expense.valor_previsto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      R$ {(expense.valor_realizado || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{getStatusBadge(expense.status)}</TableCell>
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
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleOpenAttachments(expense)}
                        className="gap-1"
                      >
                        <Paperclip className="h-4 w-4" />
                        {expense.attachments?.length || 0}
                      </Button>
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
                          <DropdownMenuItem onClick={() => handleOpenAttachments(expense)}>
                            <Paperclip className="mr-2 h-4 w-4" />
                            Ver Anexos
                          </DropdownMenuItem>

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
                          
                          {isManager && expense.status === "pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAprovar(expense)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Aprovar / Rejeitar
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {isManager && expense.status === "approved" && !expense.send_to_financial && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEnviarFinanceiro(expense)}>
                                <Send className="mr-2 h-4 w-4" />
                                Enviar ao Financeiro
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedExpense && (
        <>
          <EnviarFinanceiroDepDialog
            expense={selectedExpense}
            open={enviarFinanceiroOpen}
            onOpenChange={setEnviarFinanceiroOpen}
          />
          
          <AprovarDespesaDepartamentoDialog
            expense={selectedExpense}
            open={aprovarOpen}
            onOpenChange={setAprovarOpen}
            allExpenses={expenses}
          />
          
          <DepartmentExpenseAttachments
            expense={selectedExpense}
            open={attachmentsOpen}
            onOpenChange={setAttachmentsOpen}
            departmentId={departmentId}
          />
        </>
      )}

      {/* Chat Dialog */}
      <Dialog open={!!chatExpense} onOpenChange={(open) => !open && setChatExpense(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Comunicação — {chatExpense?.code}
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

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  EventExpense, 
  useEventExpenses, 
  EXPENSE_CATEGORIES 
} from "@/hooks/useEventExpenses";
import { EnviarFinanceiroDialog } from "@/components/events/EnviarFinanceiroDialog";
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
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface EventsExpensesTableProps {
  expenses: EventExpense[];
  isLoading: boolean;
  eventStatus: string;
}

export function EventsExpensesTable({ expenses, isLoading, eventStatus }: EventsExpensesTableProps) {
  const { approveExpense, rejectExpense } = useEventExpenses();
  const [sendFinancialDialogOpen, setSendFinancialDialogOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const { isAdminOrSupervisor } = useUserRole();

  const getCategoryLabel = (category: string) => {
    return EXPENSE_CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const getStatusBadge = (status: string) => {
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
    <>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Valor Previsto</TableHead>
              <TableHead className="text-right">Valor Realizado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="font-medium">
                  {getCategoryLabel(expense.category)}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {expense.description || "-"}
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
                <TableCell>{getStatusBadge(expense.status)}</TableCell>
                <TableCell>
                  {expense.supplier_name || "-"}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {expense.status === "pending" && canApprove && (
                        <>
                          <DropdownMenuItem onClick={() => handleApprove(expense.id)}>
                            <CheckCircle className="mr-2 h-4 w-4 text-success" />
                            Aprovar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleReject(expense.id)}>
                            <XCircle className="mr-2 h-4 w-4 text-destructive" />
                            Rejeitar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {expense.status === "approved" && (
                        <DropdownMenuItem onClick={() => handleSendToFinancial(expense.id)}>
                          <Send className="mr-2 h-4 w-4" />
                          Enviar ao Financeiro
                        </DropdownMenuItem>
                      )}
                      {expense.status === "pending_financial" && (
                        <DropdownMenuItem disabled>
                          <Banknote className="mr-2 h-4 w-4" />
                          Aguardando Pagamento
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
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
    </>
  );
}

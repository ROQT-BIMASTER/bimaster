import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, FileText, CheckCircle2, FileUp } from "lucide-react";
import { TRADE_EXPENSE_CATEGORIES } from "@/components/trade/tradeExpenseCategories";
import { format } from "date-fns";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import { AdicionarEvidenciaDialog } from "@/components/trade/AdicionarEvidenciaDialog";
import { NovoLancamentoDialog } from "@/components/trade/NovoLancamentoDialog";
import { EditarLancamentoDialog } from "@/components/trade/EditarLancamentoDialog";
import { PaymentPolicyBanner } from "@/components/financeiro/payments/PaymentPolicyBanner";
import { ExpenseAIChatFloat } from "@/components/ai/ExpenseAIChatFloat";

export default function TradeLancamentos() {
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId !== null && !roleLoading) {
      fetchData();
    }
  }, [currentUserId, roleLoading, isAdminOrSupervisor]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchData = async () => {
    try {
      let query = supabase
        .from("trade_financial_entries")
        .select(`
          *,
          account:trade_chart_of_accounts(name, code),
          store:stores(name, code),
          budget:trade_budgets(name, code),
          investment:trade_investments(amount, category)
        `);

      // Filtrar para não-admins/supervisores
      if (!isAdminOrSupervisor && currentUserId) {
        query = query.eq("created_by", currentUserId);
      }

      if (statusFilter !== "all") {
        query = query.eq("approval_status", statusFilter);
      }

      const { data, error } = await query.order("entry_date", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const getEntryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      budget_allocation: "Alocação de Verba",
      investment: "Investimento",
      expense: "Despesa",
      revenue: "Receita",
      adjustment: "Ajuste",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      approved: "default",
      rejected: "destructive",
      completed: "secondary",
    };
    
    const labels: Record<string, string> = {
      pending: "Pendente",
      approved: "Aprovado",
      rejected: "Rejeitado",
      completed: "Concluído",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const canAddEvidence = (entry: any) => {
    return (
      entry.created_by === currentUserId &&
      entry.approval_status === "approved" &&
      entry.status !== "completed"
    );
  };

  const handleEvidenceClick = (entry: any) => {
    setSelectedEntry(entry);
    setEvidenceDialogOpen(true);
  };

  const canEdit = (entry: any) => {
    return (
      entry.created_by === currentUserId &&
      (entry.approval_status === "pending" || entry.approval_status === "rejected")
    );
  };

  const handleEditClick = (entry: any) => {
    setSelectedEntry(entry);
    setEditDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard/trade/financeiro">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Lançamentos Financeiros</h1>
              <p className="text-muted-foreground mt-1">
                Histórico completo de todos os lançamentos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NovoLancamentoDialog onSuccess={fetchData} />
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
                <SelectItem value="rejected">Rejeitados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <PaymentPolicyBanner />

        <Card>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando lançamentos...
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum lançamento financeiro encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor Previsto</TableHead>
                  <TableHead className="text-right">Valor Realizado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      {format(new Date(entry.entry_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {getEntryTypeLabel(entry.entry_type)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.account ? (
                        <span className="font-mono text-xs">
                          {entry.account.code} - {entry.account.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.category ? (
                        <Badge variant="outline" className="text-xs">
                          {TRADE_EXPENSE_CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {entry.valor_previsto ? (
                        <>R$ {parseFloat(entry.valor_previsto).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2, maximumFractionDigits: 2,
                        })}</>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      R$ {parseFloat(entry.amount).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.approval_status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit(entry) && (
                          <Button
                            size="sm"
                            variant={entry.approval_status === "rejected" ? "default" : "outline"}
                            onClick={() => handleEditClick(entry)}
                          >
                            {entry.approval_status === "rejected" ? "Editar e Resubmeter" : "Editar"}
                          </Button>
                        )}
                        {canAddEvidence(entry) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEvidenceClick(entry)}
                          >
                            <FileUp className="h-4 w-4 mr-1" />
                            Adicionar Evidência
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {selectedEntry && (
        <>
          <AdicionarEvidenciaDialog
            open={evidenceDialogOpen}
            onOpenChange={setEvidenceDialogOpen}
            entry={selectedEntry}
            onSuccess={fetchData}
          />
          <EditarLancamentoDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            entryId={selectedEntry.id}
            onSuccess={fetchData}
          />
        </>
      )}
      <ExpenseAIChatFloat
        context={{ screen: "trade_lancamentos", totalEntries: entries.length }}
        contextLabel="Lançamentos Trade"
      />
    </DashboardLayout>
  );
}

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, FileText, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import { useUserRole } from "@/hooks/useUserRole";
import { AprovarLancamentoDialog } from "@/components/trade/AprovarLancamentoDialog";
import { useNavigate } from "react-router-dom";

export default function TradeAprovacoes() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    // Aguarda o carregamento do role antes de verificar
    if (roleLoading) return;
    
    if (!isAdminOrSupervisor) {
      toast.error("Acesso negado. Apenas supervisores e administradores podem aprovar lançamentos.");
      navigate("/dashboard");
      return;
    }
    fetchData();
  }, [isAdminOrSupervisor, roleLoading, navigate]);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("trade_financial_entries")
        .select(`
          *,
          account:trade_chart_of_accounts(name, code),
          store:stores(name, code),
          budget:trade_budgets(name, code)
        `)
        .eq("approval_status", "pending")
        .order("entry_date", { ascending: false });

      if (error) throw error;

      // Buscar informações dos criadores separadamente
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(entry => entry.created_by))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        const enrichedData = data.map(entry => ({
          ...entry,
          created_by_profile: profileMap.get(entry.created_by)
        }));

        setEntries(enrichedData);
      } else {
        setEntries(data || []);
      }
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

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

  const handleApproveClick = (entry: any) => {
    setSelectedEntry(entry);
    setApprovalDialogOpen(true);
  };

  const pendingCount = entries.length;
  const totalAmount = entries.reduce((sum, entry) => sum + parseFloat(entry.amount), 0);

  // Mostra loading enquanto verifica permissões
  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-muted-foreground">Verificando permissões...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/trade/financeiro">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Aprovação de Lançamentos</h1>
            <p className="text-muted-foreground mt-1">
              Revise e aprove os lançamentos financeiros pendentes
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <FileText className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">
                  R$ {totalAmount.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ação Necessária</p>
                <p className="text-xl font-semibold">
                  {pendingCount > 0 ? "Revisar agora" : "Tudo em dia"}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              Carregando lançamentos pendentes...
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
              <p className="text-lg font-semibold mb-2">Nenhum lançamento pendente</p>
              <p className="text-sm">Todos os lançamentos foram processados</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(entry.entry_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {entry.created_by_profile?.nome || "N/A"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {entry.created_by_profile?.email || ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {getEntryTypeLabel(entry.entry_type)}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={entry.description}>
                        {entry.description}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.account ? (
                        <span className="font-mono text-xs">
                          {entry.account.code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.store ? (
                        <span className="text-xs">
                          {entry.store.code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      R$ {parseFloat(entry.amount).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleApproveClick(entry)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {selectedEntry && (
        <AprovarLancamentoDialog
          open={approvalDialogOpen}
          onOpenChange={setApprovalDialogOpen}
          entry={selectedEntry}
          onSuccess={fetchData}
        />
      )}
    </DashboardLayout>
  );
}

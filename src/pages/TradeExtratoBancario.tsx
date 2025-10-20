import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { sanitizeText, getSafeErrorMessage } from "@/lib/utils/sanitize";

export default function TradeExtratoBancario() {
  const { accountId } = useParams();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (accountId) {
      fetchData();
    }
  }, [accountId]);

  const fetchData = async () => {
    try {
      const [accountRes, transactionsRes] = await Promise.all([
        supabase
          .from("trade_bank_accounts")
          .select(`
            *,
            store:stores(name, code, city)
          `)
          .eq("id", accountId)
          .single(),
        supabase
          .from("trade_bank_transactions")
          .select("*")
          .eq("bank_account_id", accountId)
          .order("transaction_date", { ascending: false }),
      ]);

      if (accountRes.data) setAccount(accountRes.data);
      if (transactionsRes.data) setTransactions(transactionsRes.data);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const transactionData = {
        bank_account_id: accountId,
        transaction_date: formData.get("transaction_date") as string,
        transaction_type: formData.get("transaction_type") as string,
        amount: parseFloat(formData.get("amount") as string),
        description: sanitizeText(formData.get("description") as string),
        reference_number: sanitizeText(formData.get("reference_number") as string || ""),
        balance_after: 0, // Será calculado pelo trigger
      };

      const { error } = await supabase
        .from("trade_bank_transactions")
        .insert([transactionData]);

      if (error) throw error;

      toast.success("Transação registrada com sucesso!");
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    }
  };

  if (loading || !account) {
    return (
      <DashboardLayout>
        <div>Carregando...</div>
      </DashboardLayout>
    );
  }

  const totalCredits = transactions
    .filter((t) => t.transaction_type === "credit")
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const totalDebits = transactions
    .filter((t) => t.transaction_type === "debit")
    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/dashboard/trade/financeiro/contas">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Extrato Bancário</h1>
            <p className="text-muted-foreground mt-1">
              {account.store?.name} - {account.bank_name} ({account.account_number})
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Transação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Transação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTransaction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="transaction_type">Tipo</Label>
                  <Select name="transaction_type" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Crédito (Entrada)</SelectItem>
                      <SelectItem value="debit">Débito (Saída)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transaction_date">Data</Label>
                  <Input
                    id="transaction_date"
                    name="transaction_date"
                    type="date"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Valor</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Descrição da transação..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference_number">Número de Referência</Label>
                  <Input
                    id="reference_number"
                    name="reference_number"
                    placeholder="Opcional"
                  />
                </div>

                <Button type="submit" className="w-full">
                  Registrar Transação
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Saldo Inicial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R${" "}
                {parseFloat(account.initial_balance).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Créditos
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R${" "}
                {totalCredits.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Débitos
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                R${" "}
                {totalDebits.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Saldo Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R${" "}
                {parseFloat(account.current_balance).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo Após</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {format(new Date(transaction.transaction_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transaction.transaction_type === "credit"
                            ? "default"
                            : "destructive"
                        }
                      >
                        {transaction.transaction_type === "credit"
                          ? "Crédito"
                          : "Débito"}
                      </Badge>
                    </TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {transaction.reference_number || "-"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${
                        transaction.transaction_type === "credit"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.transaction_type === "credit" ? "+" : "-"}
                      R${" "}
                      {parseFloat(transaction.amount).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      R${" "}
                      {parseFloat(transaction.balance_after).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 }
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, DollarSign, TrendingUp, AlertCircle, Calendar, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { EditarInvestimentoDialog } from "@/components/trade/EditarInvestimentoDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function TradeFinanceiro() {
  const { hasPermission } = useScreenPermissions();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string>("");
  const [newBudgetOpen, setNewBudgetOpen] = useState(false);
  const [newInvestmentOpen, setNewInvestmentOpen] = useState(false);
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(null);
  const [deletingInvestmentId, setDeletingInvestmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission("trade_marketing")) {
      navigate("/dashboard");
    }
  }, [hasPermission, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [budgetsRes, accountsRes, investmentsRes, storesRes] = await Promise.all([
        supabase.from("trade_budgets").select("*").order("period_start", { ascending: false }),
        supabase.from("trade_chart_of_accounts").select("*").eq("is_active", true).order("code"),
        supabase.from("trade_investments").select(`
          *,
          store:stores(name, code, city)
        `).order("investment_date", { ascending: false }),
        supabase.from("stores").select("id, name, code, city").eq("status", "active").order("name"),
      ]);

      if (budgetsRes.data) setBudgets(budgetsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (investmentsRes.data) setInvestments(investmentsRes.data);
      if (storesRes.data) setStores(storesRes.data);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("trade_budgets").insert({
        name: formData.get("name") as string,
        code: formData.get("code") as string,
        total_amount: parseFloat(formData.get("total_amount") as string),
        period_start: formData.get("period_start") as string,
        period_end: formData.get("period_end") as string,
        account_id: formData.get("account_id") as string || null,
        description: formData.get("description") as string,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success("Verba criada com sucesso!");
      setNewBudgetOpen(false);
      fetchData();
    } catch (error) {
      console.error("Erro ao criar verba:", error);
      toast.error("Erro ao criar verba");
    }
  };

  const handleCreateInvestment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("trade_investments").insert({
        store_id: formData.get("store_id") as string,
        investment_date: formData.get("investment_date") as string,
        amount: parseFloat(formData.get("amount") as string),
        category: formData.get("category") as string,
        description: formData.get("description") as string,
        payment_method: formData.get("payment_method") as string,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success("Investimento registrado com sucesso!");
      setNewInvestmentOpen(false);
      fetchData();
    } catch (error) {
      console.error("Erro ao criar investimento:", error);
      toast.error("Erro ao registrar investimento");
    }
  };

  const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
  const totalSpent = budgets.reduce((sum, b) => sum + parseFloat(b.spent_amount || 0), 0);
  const totalAvailable = totalBudget - totalSpent;

  const handleDeleteInvestment = async () => {
    if (!deletingInvestmentId) return;

    try {
      const { error } = await supabase
        .from("trade_investments")
        .delete()
        .eq("id", deletingInvestmentId);

      if (error) throw error;

      toast.success("Investimento excluído com sucesso!");
      fetchData();
      setDeletingInvestmentId(null);
    } catch (error: any) {
      console.error("Erro ao excluir investimento:", error);
      toast.error("Erro ao excluir investimento: " + error.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Financeiro Trade Marketing</h1>
          <p className="text-muted-foreground mt-1">
            Gestão de verbas, investimentos e plano de contas
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Verbas</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalAvailable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="budgets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="budgets">Verbas</TabsTrigger>
            <TabsTrigger value="investments">Investimentos por PDV</TabsTrigger>
            <TabsTrigger value="accounts">Plano de Contas</TabsTrigger>
          </TabsList>

          <TabsContent value="budgets" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Controle de Verbas</h2>
              <Dialog open={newBudgetOpen} onOpenChange={setNewBudgetOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Verba
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Adicionar Nova Verba</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateBudget} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome da Verba</Label>
                        <Input id="name" name="name" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="code">Código</Label>
                        <Input id="code" name="code" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="total_amount">Valor Total</Label>
                      <Input id="total_amount" name="total_amount" type="number" step="0.01" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="period_start">Data Início</Label>
                        <Input id="period_start" name="period_start" type="date" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="period_end">Data Fim</Label>
                        <Input id="period_end" name="period_end" type="date" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="account_id">Conta Contábil (Opcional)</Label>
                      <Select name="account_id">
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea id="description" name="description" />
                    </div>
                    <Button type="submit" className="w-full">Criar Verba</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Gasto</TableHead>
                    <TableHead>Disponível</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((budget) => {
                    const available = parseFloat(budget.total_amount) - parseFloat(budget.spent_amount || 0);
                    const percentUsed = (parseFloat(budget.spent_amount || 0) / parseFloat(budget.total_amount)) * 100;
                    
                    return (
                      <TableRow key={budget.id}>
                        <TableCell className="font-mono">{budget.code}</TableCell>
                        <TableCell className="font-medium">{budget.name}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(budget.period_start), "dd/MM/yyyy")} -{" "}
                          {format(new Date(budget.period_end), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          R$ {parseFloat(budget.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          R$ {parseFloat(budget.spent_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          R$ {available.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={budget.status === "active" ? "default" : "secondary"}>
                            {budget.status === "active" ? "Ativa" : budget.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="investments" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Investimentos por PDV</h2>
              <Dialog open={newInvestmentOpen} onOpenChange={setNewInvestmentOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Investimento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Registrar Investimento em PDV</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateInvestment} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="store_id">PDV</Label>
                      <Select name="store_id" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o PDV" />
                        </SelectTrigger>
                        <SelectContent>
                          {stores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.code} - {store.name} ({store.city})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="investment_date">Data</Label>
                        <Input id="investment_date" name="investment_date" type="date" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="amount">Valor</Label>
                        <Input id="amount" name="amount" type="number" step="0.01" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Categoria</Label>
                        <Select name="category" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Material POP">Material POP</SelectItem>
                            <SelectItem value="Promotores">Promotores</SelectItem>
                            <SelectItem value="Brindes">Brindes e Prêmios</SelectItem>
                            <SelectItem value="Eventos">Eventos</SelectItem>
                            <SelectItem value="Logística">Logística</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment_method">Forma de Pagamento</Label>
                        <Select name="payment_method">
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="Transferência">Transferência</SelectItem>
                            <SelectItem value="Cartão">Cartão</SelectItem>
                            <SelectItem value="Boleto">Boleto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea id="description" name="description" required />
                    </div>
                    <Button type="submit" className="w-full">Registrar Investimento</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>PDV</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((investment) => (
                    <TableRow key={investment.id}>
                      <TableCell>{format(new Date(investment.investment_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{investment.store?.name || "N/A"}</div>
                          <div className="text-sm text-muted-foreground">{investment.store?.city}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{investment.category}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        R$ {parseFloat(investment.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={investment.status === "pending" ? "secondary" : "default"}>
                          {investment.status === "pending" ? "Pendente" : "Aprovado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{investment.description}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingInvestmentId(investment.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingInvestmentId(investment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Plano de Contas</h2>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono font-medium">{account.code}</TableCell>
                      <TableCell>{account.name}</TableCell>
                      <TableCell>
                        <Badge variant={account.account_type === "expense" ? "destructive" : "default"}>
                          {account.account_type === "expense" ? "Despesa" : account.account_type === "budget" ? "Verba" : account.account_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{account.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {editingInvestmentId && (
          <EditarInvestimentoDialog
            open={!!editingInvestmentId}
            onOpenChange={(open) => !open && setEditingInvestmentId(null)}
            investmentId={editingInvestmentId}
            onSuccess={() => {
              fetchData();
              setEditingInvestmentId(null);
            }}
          />
        )}

        <AlertDialog open={!!deletingInvestmentId} onOpenChange={(open) => !open && setDeletingInvestmentId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este investimento? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteInvestment} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

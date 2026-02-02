import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
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
import { Plus, DollarSign, TrendingUp, AlertCircle, Calendar, Pencil, Trash2, BookOpen, Receipt, Wallet, CheckCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { EditarInvestimentoDialog } from "@/components/trade/EditarInvestimentoDialog";
import { NovaLojaDialog } from "@/components/trade/NovaLojaDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TradeFilters } from "@/components/trade/TradeFilters";
import { budgetSchema, chartOfAccountsSchema } from "@/lib/validations/budget";
import { sanitizeText, sanitizeCode, getSafeErrorMessage } from "@/lib/utils/sanitize";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { BudgetFormData } from "@/lib/validations/budget";

export default function TradeFinanceiro() {
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
  const [allInvestments, setAllInvestments] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);
  const [isNovaLojaOpen, setIsNovaLojaOpen] = useState(false);
  const [selectedStoreForInvestment, setSelectedStoreForInvestment] = useState<string>("");

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
      if (investmentsRes.data) {
        setAllInvestments(investmentsRes.data);
        setInvestments(investmentsRes.data);
      }
      if (storesRes.data) setStores(storesRes.data);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allInvestments];

    if (selectedStore) {
      filtered = filtered.filter(inv => inv.store_id === selectedStore);
    }

    if (aiCriteria) {
      if (aiCriteria.status) {
        filtered = filtered.filter(inv => aiCriteria.status.includes(inv.status));
      }
      if (aiCriteria.category) {
        filtered = filtered.filter(inv => inv.category === aiCriteria.category);
      }
      if (aiCriteria.timeframe === "hoje") {
        const today = new Date().toISOString().split('T')[0];
        filtered = filtered.filter(inv => inv.investment_date === today);
      }
      if (aiCriteria.timeframe === "semana") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(inv => new Date(inv.investment_date) >= weekAgo);
      }
    }

    setInvestments(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedStore, aiCriteria, allInvestments]);

  const handleCreateBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      // Sanitizar dados
      const name = sanitizeText(formData.get("name") as string);
      const code = sanitizeCode(formData.get("code") as string);
      const total_amount = parseFloat(formData.get("total_amount") as string);
      const period_start = formData.get("period_start") as string;
      const period_end = formData.get("period_end") as string;
      const account_id = formData.get("account_id") as string || null;
      const description = sanitizeText(formData.get("description") as string || "");
      
      // Validações básicas
      if (!name || name.length < 3) throw new Error("Nome deve ter no mínimo 3 caracteres");
      if (!code || code.length < 2) throw new Error("Código deve ter no mínimo 2 caracteres");
      if (!total_amount || total_amount <= 0) throw new Error("Valor deve ser maior que zero");
      if (total_amount > 10000000) throw new Error("Valor não pode exceder R$ 10.000.000");
      if (!period_start || !period_end) throw new Error("Período é obrigatório");
      if (new Date(period_end) <= new Date(period_start)) {
        throw new Error("Data de fim deve ser posterior à data de início");
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase.from("trade_budgets").insert({
        name,
        code,
        total_amount,
        period_start,
        period_end,
        account_id,
        description,
        status: "active",
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Verba criada com sucesso!");
      setNewBudgetOpen(false);
      fetchData();
    } catch (error: any) {
      if (error.name === "ZodError") {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error(getSafeErrorMessage(error));
      }
    }
  };

  const handleCreateInvestment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      const storeId = formData.get("store_id") as string;
      
      if (!storeId) {
        toast.error("Selecione uma loja antes de criar o investimento");
        return;
      }
      
      // Sanitizar dados
      const sanitizedData = {
        store_id: storeId,
        investment_date: formData.get("investment_date") as string,
        amount: parseFloat(formData.get("amount") as string),
        category: formData.get("category") as string,
        description: sanitizeText(formData.get("description") as string),
        payment_method: formData.get("payment_method") as string,
        created_by: user.id,
        approval_status: "pending" as const,
        status: "pending" as const,
      };

      // Validação básica
      if (!sanitizedData.investment_date || !sanitizedData.amount) {
        throw new Error("Campos obrigatórios não preenchidos");
      }

      if (sanitizedData.amount <= 0) {
        throw new Error("Valor deve ser maior que zero");
      }

      if (sanitizedData.amount > 1000000) {
        throw new Error("Valor não pode exceder R$ 1.000.000");
      }
      
      const { error } = await supabase.from("trade_investments").insert(sanitizedData);

      if (error) throw error;

      toast.success("Investimento criado! Aguardando aprovação.");
      setNewInvestmentOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
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
      toast.error(getSafeErrorMessage(error));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb 
          moduleName="Trade Marketing" 
          moduleHref="/dashboard/trade" 
          currentPage="Financeiro" 
        />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financeiro Trade Marketing</h1>
            <p className="text-muted-foreground mt-1">
              Gestão de verbas, investimentos e plano de contas
            </p>
          </div>
          <Link to="/dashboard/financeiro">
            <Button variant="outline">
              <DollarSign className="h-4 w-4 mr-2" />
              Módulo Financeiro Completo
            </Button>
          </Link>
        </div>
        
        <div className="grid gap-4 md:grid-cols-4">
          <Link to="/dashboard/trade/financeiro/extrato">
            <Card className="hover:border-primary cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Meu Extrato</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Histórico de lançamentos e aprovações
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/dashboard/trade/financeiro/campanhas">
            <Card className="hover:border-primary cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Campanhas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Gestão administrativa de campanhas
                </p>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/dashboard/trade/financeiro/lancamentos-campanhas">
            <Card className="hover:border-primary cursor-pointer transition-colors border-primary/30 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Painel de Lançamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Resultados e execução de campanhas
                </p>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/dashboard/trade/financeiro/contas">
            <Card className="hover:border-primary cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contas Correntes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Gestão de contas correntes por cliente
                </p>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/dashboard/trade/financeiro/verbas">
            <Card className="hover:border-primary cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Verbas Semestrais</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Planejamento e acompanhamento semestral
                </p>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/dashboard/trade/financeiro/lancamentos">
            <Card className="hover:border-primary cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lançamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Todos os lançamentos financeiros
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/dashboard/trade/financeiro/aprovacoes">
            <Card className="hover:border-orange-500 cursor-pointer transition-colors border-orange-500/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Aprovações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Revisar e aprovar lançamentos pendentes
                </p>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/dashboard/contas-a-pagar">
            <Card className="hover:border-primary cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Gestão de contas e orçamentos
                </p>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/dashboard/plano-contas">
            <Card className="hover:border-primary cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Plano de Contas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Estrutura contábil hierárquica
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <TradeFilters
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
        />

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
                    <TableHead>Reservado</TableHead>
                    <TableHead>Gasto</TableHead>
                    <TableHead>Disponível</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((budget) => {
                    const reserved = parseFloat(budget.reserved_amount || 0);
                    const spent = parseFloat(budget.spent_amount || 0);
                    const available = parseFloat(budget.available_amount || 0);
                    const percentUsed = ((spent + reserved) / parseFloat(budget.total_amount)) * 100;
                    
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
                        <TableCell className="text-amber-600">
                          R$ {reserved.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          R$ {spent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="font-bold">
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
                      <Label htmlFor="store_id">PDV / Loja *</Label>
                      <div className="flex gap-2">
                        <Select 
                          name="store_id" 
                          required 
                          value={selectedStoreForInvestment}
                          onValueChange={setSelectedStoreForInvestment}
                        >
                          <SelectTrigger className="flex-1">
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
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsNovaLojaOpen(true)}
                          title="Cadastrar nova loja"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A loja deve estar cadastrada antes de criar o investimento
                      </p>
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Conta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Criar Conta Contábil</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    
                    try {
                      const { error } = await supabase
                        .from("trade_chart_of_accounts")
                        .insert({
                          code: sanitizeCode(formData.get("account_code") as string),
                          name: sanitizeText(formData.get("account_name") as string),
                          account_type: formData.get("account_type") as string,
                          centro_custo: sanitizeText(formData.get("centro_custo") as string || ""),
                          departamento: sanitizeText(formData.get("departamento") as string || ""),
                          description: sanitizeText(formData.get("account_description") as string || ""),
                          is_active: true,
                        });

                      if (error) throw error;

                      toast.success("Conta contábil criada com sucesso!");
                      e.currentTarget.reset();
                      fetchData();
                    } catch (error: any) {
                      toast.error(getSafeErrorMessage(error));
                    }
                  }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="account_code">Código *</Label>
                        <Input
                          id="account_code"
                          name="account_code"
                          placeholder="Ex: 1.01.001"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="account_type">Tipo *</Label>
                        <Select name="account_type" defaultValue="expense">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asset">Ativo</SelectItem>
                            <SelectItem value="liability">Passivo</SelectItem>
                            <SelectItem value="equity">Patrimônio Líquido</SelectItem>
                            <SelectItem value="revenue">Receita</SelectItem>
                            <SelectItem value="expense">Despesa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account_name">Nome *</Label>
                      <Input
                        id="account_name"
                        name="account_name"
                        placeholder="Ex: Material de Marketing"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="centro_custo">Centro de Custo</Label>
                        <Input
                          id="centro_custo"
                          name="centro_custo"
                          placeholder="Ex: CC-01 Marketing"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="departamento">Departamento</Label>
                        <Input
                          id="departamento"
                          name="departamento"
                          placeholder="Ex: Marketing"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account_description">Descrição</Label>
                      <Textarea
                        id="account_description"
                        name="account_description"
                        placeholder="Informações adicionais sobre esta conta..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline">
                          Cancelar
                        </Button>
                      </DialogTrigger>
                      <Button type="submit">
                        Criar Conta
                      </Button>
                    </div>
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
                    <TableHead>Tipo</TableHead>
                    <TableHead>Centro de Custo</TableHead>
                    <TableHead>Departamento</TableHead>
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
                          {account.account_type === "expense" ? "Despesa" : 
                           account.account_type === "revenue" ? "Receita" :
                           account.account_type === "asset" ? "Ativo" :
                           account.account_type === "liability" ? "Passivo" :
                           account.account_type === "equity" ? "Patrimônio" :
                           account.account_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{account.centro_custo || "-"}</TableCell>
                      <TableCell className="text-sm">{account.departamento || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">
                        {account.description || "-"}
                      </TableCell>
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

        <NovaLojaDialog
          open={isNovaLojaOpen}
          onOpenChange={setIsNovaLojaOpen}
          onSuccess={(newStoreId) => {
            if (newStoreId) {
              setSelectedStoreForInvestment(newStoreId);
            }
            fetchData();
          }}
        />
      </div>
    </DashboardLayout>
  );
}

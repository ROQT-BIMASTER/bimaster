import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Calendar, DollarSign, FileText, Filter, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { sanitizeText, getSafeErrorMessage } from "@/lib/utils/sanitize";

export default function TradeFinanceiroLancamentos() {
  const { hasPermission } = useScreenPermissions();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

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
      const [entriesRes, accountsRes, budgetsRes, storesRes] = await Promise.all([
        supabase
          .from("trade_financial_entries")
          .select(`
            *,
            account:trade_chart_of_accounts(name, code),
            budget:trade_budgets(name, code),
            store:stores(name, code)
          `)
          .order("entry_date", { ascending: false }),
        supabase.from("trade_chart_of_accounts").select("*").eq("is_active", true).order("code"),
        supabase.from("trade_budgets").select("*").eq("status", "active").order("name"),
        supabase.from("stores").select("id, name, code").eq("status", "active").order("name"),
      ]);

      if (entriesRes.data) setEntries(entriesRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (budgetsRes.data) setBudgets(budgetsRes.data);
      if (storesRes.data) setStores(storesRes.data);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const sanitizedData = {
        entry_date: formData.get("entry_date") as string,
        account_id: formData.get("account_id") as string,
        entry_type: formData.get("entry_type") as string,
        amount: parseFloat(formData.get("amount") as string),
        description: sanitizeText(formData.get("description") as string),
        reference_number: sanitizeText(formData.get("reference_number") as string || ""),
        store_id: formData.get("store_id") as string || null,
        budget_id: formData.get("budget_id") as string || null,
        status: "pending",
        notes: sanitizeText(formData.get("notes") as string || ""),
        created_by: user.id,
      };

      // Validações
      if (!sanitizedData.entry_date || !sanitizedData.account_id || !sanitizedData.entry_type) {
        throw new Error("Campos obrigatórios não preenchidos");
      }

      if (sanitizedData.amount <= 0) {
        throw new Error("Valor deve ser maior que zero");
      }

      if (sanitizedData.amount > 10000000) {
        throw new Error("Valor não pode exceder R$ 10.000.000");
      }

      if (sanitizedData.description.length < 5) {
        throw new Error("Descrição deve ter no mínimo 5 caracteres");
      }

      const { error } = await supabase.from("trade_financial_entries").insert(sanitizedData);

      if (error) throw error;

      toast.success("Lançamento criado com sucesso!");
      setNewEntryOpen(false);
      fetchData();
      (e.target as HTMLFormElement).reset();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    }
  };

  const getEntryTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      budget_allocation: "Alocação de Verba",
      investment: "Investimento",
      expense: "Despesa",
      revenue: "Receita",
      adjustment: "Ajuste",
    };
    return types[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", label: "Pendente" },
      approved: { variant: "default", label: "Aprovado" },
      rejected: { variant: "destructive", label: "Rejeitado" },
      completed: { variant: "outline", label: "Completo" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredEntries = filterStatus === "all" 
    ? entries 
    : entries.filter(e => e.status === filterStatus);

  const totalAmount = filteredEntries.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard/trade/financeiro")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Lançamentos Financeiros</h1>
              <p className="text-muted-foreground mt-1">
                Registre e gerencie todos os lançamentos do Trade Marketing
              </p>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Lançamentos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredEntries.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(totalAmount)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {entries.filter(e => e.status === "pending").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Novo Lançamento */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="completed">Completo</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={newEntryOpen} onOpenChange={setNewEntryOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Lançamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Lançamento Financeiro</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateEntry} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="entry_date">Data do Lançamento *</Label>
                    <Input 
                      id="entry_date" 
                      name="entry_date" 
                      type="date" 
                      required 
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="entry_type">Tipo de Lançamento *</Label>
                    <Select name="entry_type" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="budget_allocation">Alocação de Verba</SelectItem>
                        <SelectItem value="investment">Investimento</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="revenue">Receita</SelectItem>
                        <SelectItem value="adjustment">Ajuste</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account_id">Conta Contábil *</Label>
                    <Select name="account_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
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
                    <Label htmlFor="amount">Valor (R$) *</Label>
                    <Input 
                      id="amount" 
                      name="amount" 
                      type="number" 
                      step="0.01" 
                      required 
                      min="0.01"
                      max="10000000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Textarea 
                    id="description" 
                    name="description" 
                    required 
                    minLength={5}
                    maxLength={500}
                    placeholder="Descreva o lançamento..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reference_number">Número de Referência</Label>
                    <Input 
                      id="reference_number" 
                      name="reference_number" 
                      placeholder="Ex: NF-12345"
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget_id">Verba Associada</Label>
                    <Select name="budget_id">
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {budgets.map((budget) => (
                          <SelectItem key={budget.id} value={budget.id}>
                            {budget.code} - {budget.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store_id">PDV Associado</Label>
                  <Select name="store_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.code} - {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea 
                    id="notes" 
                    name="notes" 
                    placeholder="Informações adicionais..."
                    maxLength={1000}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setNewEntryOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Criar Lançamento</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabela de Lançamentos */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{format(new Date(entry.entry_date), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getEntryTypeLabel(entry.entry_type)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{entry.account?.code}</div>
                      <div className="text-muted-foreground">{entry.account?.name}</div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="truncate">{entry.description}</div>
                  </TableCell>
                  <TableCell>
                    {entry.reference_number && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {entry.reference_number}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(parseFloat(entry.amount))}
                  </TableCell>
                  <TableCell>{getStatusBadge(entry.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
}

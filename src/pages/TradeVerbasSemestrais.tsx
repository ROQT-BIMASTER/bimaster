import { useState, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Calendar, DollarSign, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { sanitizeText, sanitizeCode, getSafeErrorMessage } from "@/lib/utils/sanitize";

export default function TradeVerbasSemestrais() {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [budgetsRes, accountsRes] = await Promise.all([
        supabase
          .from("trade_budgets")
          .select("*")
          .order("period_start", { ascending: false }),
        supabase
          .from("trade_chart_of_accounts")
          .select("*")
          .eq("is_active", true)
          .order("code"),
      ]);

      if (budgetsRes.data) setBudgets(budgetsRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const name = sanitizeText(formData.get("name") as string);
      const code = sanitizeCode(formData.get("code") as string);
      const total_amount = parseFloat(formData.get("total_amount") as string);
      const period_start = formData.get("period_start") as string;
      const period_end = formData.get("period_end") as string;
      const account_id = formData.get("account_id") as string || null;
      const description = sanitizeText(formData.get("description") as string || "");

      if (!name || name.length < 3) throw new Error("Nome deve ter no mínimo 3 caracteres");
      if (!code || code.length < 2) throw new Error("Código deve ter no mínimo 2 caracteres");
      if (!total_amount || total_amount <= 0) throw new Error("Valor deve ser maior que zero");
      if (total_amount > 10000000) throw new Error("Valor não pode exceder R$ 10.000.000");
      if (new Date(period_end) <= new Date(period_start)) {
        throw new Error("Data de fim deve ser posterior à data de início");
      }

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
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    }
  };

  // Calcular semestres disponíveis
  const currentYear = new Date().getFullYear();
  const semesters = [
    { value: `${currentYear}-1`, label: `1º Semestre ${currentYear}`, start: `${currentYear}-01-01`, end: `${currentYear}-06-30` },
    { value: `${currentYear}-2`, label: `2º Semestre ${currentYear}`, start: `${currentYear}-07-01`, end: `${currentYear}-12-31` },
    { value: `${currentYear + 1}-1`, label: `1º Semestre ${currentYear + 1}`, start: `${currentYear + 1}-01-01`, end: `${currentYear + 1}-06-30` },
  ];

  const filteredBudgets = selectedSemester
    ? budgets.filter((b) => {
        const semester = semesters.find((s) => s.value === selectedSemester);
        if (!semester) return false;
        return b.period_start >= semester.start && b.period_end <= semester.end;
      })
    : budgets;

  const totalBudget = filteredBudgets.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
  const totalSpent = filteredBudgets.reduce((sum, b) => sum + parseFloat(b.spent_amount || 0), 0);
  const totalAvailable = totalBudget - totalSpent;
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Verbas Semestrais</h1>
            <p className="text-muted-foreground mt-1">
              Planejamento e acompanhamento de verbas por semestre
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Verba
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Adicionar Verba Semestral</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateBudget} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Verba</Label>
                    <Input id="name" name="name" placeholder="Ex: Marketing Digital" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Código</Label>
                    <Input id="code" name="code" placeholder="Ex: MD-2025-01" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total_amount">Valor Total</Label>
                  <Input
                    id="total_amount"
                    name="total_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    required
                  />
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
                  <Textarea id="description" name="description" placeholder="Detalhes da verba..." />
                </div>

                <Button type="submit" className="w-full">
                  Criar Verba
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4 items-center">
          <Label htmlFor="semester-filter">Filtrar por Semestre:</Label>
          <Select value={selectedSemester || undefined} onValueChange={setSelectedSemester}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Todos os semestres" />
            </SelectTrigger>
            <SelectContent>
              {semesters.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedSemester && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedSemester("")}
            >
              Limpar filtro
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verbas Ativas</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredBudgets.length}</div>
              <p className="text-xs text-muted-foreground">
                {selectedSemester
                  ? semesters.find((s) => s.value === selectedSemester)?.label
                  : "Todos os períodos"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Planejado</CardTitle>
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
              <CardTitle className="text-sm font-medium">Total Utilizado</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <Progress value={percentUsed} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {percentUsed.toFixed(1)}% utilizado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalAvailable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Verbas do Período</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Utilizado</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead>Utilização</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBudgets.map((budget) => {
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
                      <TableCell className="text-right">
                        R$ {parseFloat(budget.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {parseFloat(budget.spent_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        R$ {available.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={percentUsed} className="w-[60px]" />
                          <span className="text-xs text-muted-foreground">{percentUsed.toFixed(0)}%</span>
                        </div>
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Plus, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  RefreshCw, 
  MoreHorizontal,
  Edit,
  Power,
  PowerOff,
  Trash2,
  AlertTriangle,
  FileText
} from "lucide-react";
import { BudgetDocumentUpload } from "@/components/trade/budgets/BudgetDocumentUpload";
import { format } from "date-fns";
import { sanitizeText, sanitizeCode, getSafeErrorMessage } from "@/lib/utils/sanitize";
import { logBudgetInactivate, logBudgetReactivate, logBudgetDelete, logBudgetEdit } from "@/lib/auditLog";

export default function TradeVerbasSemestrais() {
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);
  
  // Estados para ações
  const [selectedBudget, setSelectedBudget] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inactivateDialogOpen, setInactivateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Array<{
    name: string;
    path: string;
    url: string;
    type: string;
    size: number;
  }>>([]);

  useEffect(() => {
    fetchData();
  }, [showInactive]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let budgetsQuery = supabase
        .from("trade_budgets")
        .select("*")
        .order("period_start", { ascending: false });
      
      // Se não mostrar inativas, filtrar apenas as ativas
      if (!showInactive) {
        budgetsQuery = budgetsQuery.is("inactivated_at", null);
      }

      const [budgetsRes, accountsRes] = await Promise.all([
        budgetsQuery,
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

      const { data: budgetData, error } = await supabase.from("trade_budgets").insert({
        name,
        code,
        total_amount,
        period_start,
        period_end,
        account_id,
        description,
        status: "active",
        created_by: user.id,
      }).select().single();

      if (error) throw error;

      // Salvar documentos anexados
      if (uploadedDocs.length > 0 && budgetData) {
        const docsToInsert = uploadedDocs.map(doc => ({
          budget_id: budgetData.id,
          file_name: doc.name,
          file_path: doc.path,
          file_url: doc.url,
          file_type: doc.type,
          file_size: doc.size,
          uploaded_by: user.id,
        }));

        const { error: docsError } = await supabase
          .from("trade_budget_documents")
          .insert(docsToInsert);

        if (docsError) {
          console.error("Erro ao salvar documentos:", docsError);
        }
      }

      toast.success("Verba criada com sucesso!");
      setDialogOpen(false);
      setUploadedDocs([]);
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    }
  };

  const handleEditBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBudget) return;
    
    const formData = new FormData(e.currentTarget);
    setActionLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const newName = sanitizeText(formData.get("name") as string);
      const newCode = sanitizeCode(formData.get("code") as string);
      const newAmount = parseFloat(formData.get("total_amount") as string);
      const newDescription = sanitizeText(formData.get("description") as string || "");

      // Rastrear mudanças
      const changes: { field: string; oldValue: any; newValue: any }[] = [];
      if (newName !== selectedBudget.name) {
        changes.push({ field: "name", oldValue: selectedBudget.name, newValue: newName });
      }
      if (newCode !== selectedBudget.code) {
        changes.push({ field: "code", oldValue: selectedBudget.code, newValue: newCode });
      }
      if (newAmount !== parseFloat(selectedBudget.total_amount)) {
        changes.push({ field: "total_amount", oldValue: selectedBudget.total_amount, newValue: newAmount });
      }
      if (newDescription !== (selectedBudget.description || "")) {
        changes.push({ field: "description", oldValue: selectedBudget.description, newValue: newDescription });
      }

      const { error } = await supabase
        .from("trade_budgets")
        .update({
          name: newName,
          code: newCode,
          total_amount: newAmount,
          description: newDescription,
        })
        .eq("id", selectedBudget.id);

      if (error) throw error;

      // Registrar no audit log
      if (changes.length > 0) {
        await logBudgetEdit(selectedBudget.id, changes);
      }

      toast.success("Verba atualizada com sucesso!");
      setEditDialogOpen(false);
      setSelectedBudget(null);
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleInactivateBudget = async () => {
    if (!selectedBudget || !actionReason.trim()) {
      toast.error("Informe o motivo da inativação");
      return;
    }
    
    setActionLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("trade_budgets")
        .update({
          status: "inactive",
          inactivated_at: new Date().toISOString(),
          inactivated_by: user.id,
          inactivated_reason: actionReason.trim(),
        })
        .eq("id", selectedBudget.id);

      if (error) throw error;

      // Registrar no audit log
      await logBudgetInactivate(selectedBudget.id, selectedBudget.name, actionReason.trim());

      toast.success("Verba inativada com sucesso!");
      setInactivateDialogOpen(false);
      setSelectedBudget(null);
      setActionReason("");
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateBudget = async (budget: any) => {
    setActionLoading(true);

    try {
      const { error } = await supabase
        .from("trade_budgets")
        .update({
          status: "active",
          inactivated_at: null,
          inactivated_by: null,
          inactivated_reason: null,
        })
        .eq("id", budget.id);

      if (error) throw error;

      // Registrar no audit log
      await logBudgetReactivate(budget.id, budget.name);

      toast.success("Verba reativada com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBudget = async () => {
    if (!selectedBudget || !actionReason.trim()) {
      toast.error("Informe o motivo da exclusão");
      return;
    }
    
    setActionLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Soft delete - apenas marca como excluída
      const { error } = await supabase
        .from("trade_budgets")
        .update({
          status: "deleted",
          inactivated_at: new Date().toISOString(),
          inactivated_by: user.id,
          inactivated_reason: `EXCLUÍDA: ${actionReason.trim()}`,
        })
        .eq("id", selectedBudget.id);

      if (error) throw error;

      // Registrar no audit log
      await logBudgetDelete(selectedBudget.id, selectedBudget.name, actionReason.trim());

      toast.success("Verba excluída com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedBudget(null);
      setActionReason("");
      fetchData();
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setActionLoading(false);
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

  // Apenas contar verbas ativas para métricas
  const activeBudgets = filteredBudgets.filter(b => !b.inactivated_at);
  const totalBudget = activeBudgets.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0);
  const totalSpent = activeBudgets.reduce((sum, b) => sum + parseFloat(b.spent_amount || 0), 0);
  const totalAvailable = totalBudget - totalSpent;
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const isInactive = (budget: any) => budget.inactivated_at !== null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb 
          moduleName="Financeiro Trade" 
          moduleHref="/dashboard/trade/financeiro" 
          currentPage="Verbas Semestrais" 
        />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Verbas Semestrais</h1>
            <p className="text-muted-foreground mt-1">
              Planejamento e acompanhamento de verbas por semestre
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
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

                <BudgetDocumentUpload
                  files={uploadedDocs}
                  onFilesChange={setUploadedDocs}
                  maxFiles={5}
                />

                <Button type="submit" className="w-full">
                  Criar Verba
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
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
          
          <div className="flex items-center gap-2 ml-auto">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
              Mostrar verbas inativas
            </Label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verbas Ativas</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeBudgets.length}</div>
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
                  <TableHead className="w-[60px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBudgets.map((budget) => {
                  const available = parseFloat(budget.total_amount) - parseFloat(budget.spent_amount || 0);
                  const percentUsed = (parseFloat(budget.spent_amount || 0) / parseFloat(budget.total_amount)) * 100;
                  const inactive = isInactive(budget);

                  return (
                    <TableRow 
                      key={budget.id} 
                      className={inactive ? "opacity-50" : ""}
                    >
                      <TableCell className={`font-mono ${inactive ? "line-through text-destructive" : ""}`}>
                        {budget.code}
                      </TableCell>
                      <TableCell className={`font-medium ${inactive ? "line-through text-destructive" : ""}`}>
                        {budget.name}
                      </TableCell>
                      <TableCell className={`text-sm ${inactive ? "line-through text-destructive" : ""}`}>
                        {format(new Date(budget.period_start), "dd/MM/yyyy")} -{" "}
                        {format(new Date(budget.period_end), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className={`text-right ${inactive ? "line-through text-destructive" : ""}`}>
                        R$ {parseFloat(budget.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right ${inactive ? "line-through text-destructive" : ""}`}>
                        R$ {parseFloat(budget.spent_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${inactive ? "line-through text-destructive" : ""}`}>
                        R$ {available.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={percentUsed} className="w-[60px]" />
                          <span className="text-xs text-muted-foreground">{percentUsed.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {inactive ? (
                          <Badge variant="destructive">
                            {budget.status === "deleted" ? "Excluída" : "Inativa"}
                          </Badge>
                        ) : (
                          <Badge variant={budget.status === "active" ? "default" : "secondary"}>
                            {budget.status === "active" ? "Ativa" : budget.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!inactive && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedBudget(budget);
                                    setEditDialogOpen(true);
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedBudget(budget);
                                    setActionReason("");
                                    setInactivateDialogOpen(true);
                                  }}
                                  className="text-amber-600"
                                >
                                  <PowerOff className="mr-2 h-4 w-4" />
                                  Inativar
                                </DropdownMenuItem>
                              </>
                            )}
                            {inactive && budget.status !== "deleted" && (
                              <DropdownMenuItem
                                onClick={() => handleReactivateBudget(budget)}
                                className="text-green-600"
                              >
                                <Power className="mr-2 h-4 w-4" />
                                Reativar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedBudget(budget);
                                setActionReason("");
                                setDeleteDialogOpen(true);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Verba</DialogTitle>
            <DialogDescription>
              Altere os dados da verba. Todas as alterações serão registradas no histórico.
            </DialogDescription>
          </DialogHeader>
          {selectedBudget && (
            <form onSubmit={handleEditBudget} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome da Verba</Label>
                  <Input 
                    id="edit-name" 
                    name="name" 
                    defaultValue={selectedBudget.name} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Código</Label>
                  <Input 
                    id="edit-code" 
                    name="code" 
                    defaultValue={selectedBudget.code} 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-total_amount">Valor Total</Label>
                <Input
                  id="edit-total_amount"
                  name="total_amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={selectedBudget.total_amount}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição</Label>
                <Textarea 
                  id="edit-description" 
                  name="description" 
                  defaultValue={selectedBudget.description || ""} 
                />
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={actionLoading}>
                  {actionLoading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog de Inativação */}
      <AlertDialog open={inactivateDialogOpen} onOpenChange={setInactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Inativar Verba
            </AlertDialogTitle>
            <AlertDialogDescription>
              A verba "{selectedBudget?.name}" será inativada e não aparecerá mais nos controles financeiros.
              Ela poderá ser reativada posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="inactivate-reason">Motivo da inativação *</Label>
            <Textarea
              id="inactivate-reason"
              placeholder="Informe o motivo da inativação..."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="mt-2"
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActionReason("")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleInactivateBudget}
              disabled={actionLoading || !actionReason.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {actionLoading ? "Inativando..." : "Inativar Verba"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir Verba
            </AlertDialogTitle>
            <AlertDialogDescription>
              A verba "{selectedBudget?.name}" será excluída permanentemente e não poderá ser recuperada.
              Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-reason">Motivo da exclusão *</Label>
            <Textarea
              id="delete-reason"
              placeholder="Informe o motivo da exclusão..."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="mt-2"
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActionReason("")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBudget}
              disabled={actionLoading || !actionReason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionLoading ? "Excluindo..." : "Excluir Verba"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

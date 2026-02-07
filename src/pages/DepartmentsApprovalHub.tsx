import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerPendingExpenses } from "@/hooks/useManagerPendingExpenses";
import { usePendingDepartmentBudgets, DepartmentBudget } from "@/hooks/useDepartmentBudgets";
import { AprovarDespesaDepartamentoDialog } from "@/components/departments/AprovarDespesaDepartamentoDialog";
import { AprovarVerbaDepartamentoDialog } from "@/components/departments/AprovarVerbaDepartamentoDialog";
import { DepartmentExpense, DEPARTMENT_EXPENSE_CATEGORIES } from "@/hooks/useDepartmentExpenses";
import { exportDepartmentExpensesToExcel } from "@/lib/exportExpenses";
import { toast } from "sonner";
import { DespesasFocoModeDialog } from "@/components/departments/DespesasFocoModeDialog";
import { PaymentPolicyBanner } from "@/components/financeiro/payments/PaymentPolicyBanner";
import { 
  Clock, 
  Building2, 
  CheckCircle2, 
  DollarSign, 
  Search,
  FileText,
  ArrowLeft,
  RefreshCw,
  Download,
  Loader2,
  Wallet,
  Receipt,
  Calendar,
  User,
  Paperclip,
  Maximize2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DepartmentsApprovalHub() {
  const navigate = useNavigate();
  const { data, isLoading: loadingExpenses, refetch: refetchExpenses } = useManagerPendingExpenses();
  const { data: pendingBudgets, isLoading: loadingBudgets, refetch: refetchBudgets } = usePendingDepartmentBudgets();
  
  const [selectedExpense, setSelectedExpense] = useState<DepartmentExpense | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<DepartmentBudget | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [focoModeOpen, setFocoModeOpen] = useState(false);

  const expenses = data?.expenses || [];
  const departments = data?.departments || [];
  const metrics = data?.metrics || { totalPending: 0, totalValue: 0, departmentsCount: 0 };
  const isManager = data?.isManager || false;

  const isLoading = loadingExpenses || loadingBudgets;

  const totalPendingBudgets = pendingBudgets?.length || 0;
  const totalBudgetValue = pendingBudgets?.reduce((sum, b) => sum + b.total_amount, 0) || 0;

  // Apply filters to expenses
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.creator?.nome.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = filterDepartment === "all" || expense.department_id === filterDepartment;
    const matchesCategory = filterCategory === "all" || expense.category === filterCategory;
    
    return matchesSearch && matchesDepartment && matchesCategory;
  });

  const getCategoryLabel = (value: string) => {
    const cat = DEPARTMENT_EXPENSE_CATEGORIES.find(c => c.value === value);
    return cat?.label || value;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportDepartmentExpensesToExcel(filteredExpenses, "despesas-pendentes-aprovacao");
      toast.success("Exportação concluída com sucesso!");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar dados");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    refetchExpenses();
    refetchBudgets();
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isManager && totalPendingBudgets === 0) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Acesso Restrito</h3>
            <p className="text-muted-foreground mt-2">
              Você precisa ser gerente de pelo menos um departamento para acessar esta central.
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate("/dashboard/departamentos")}
            >
              Voltar aos Departamentos
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName="Departamentos"
          moduleHref="/dashboard/departamentos"
          currentPage="Central de Aprovações"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/dashboard/departamentos")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Central de Aprovações de Departamentos</h1>
              <p className="text-muted-foreground">
                Revise e aprove solicitações de verbas e despesas
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleExport}
              disabled={isExporting || filteredExpenses.length === 0}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar Excel
            </Button>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Payment Policy Banner */}
        <PaymentPolicyBanner />

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totalPendingBudgets}</div>
                <div className="text-sm text-muted-foreground">Verbas Pendentes</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.totalPending}</div>
                <div className="text-sm text-muted-foreground">Despesas Pendentes</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  R$ {(totalBudgetValue + metrics.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-muted-foreground">Valor Total Pendente</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                <Building2 className="h-6 w-6 text-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.departmentsCount}</div>
                <div className="text-sm text-muted-foreground">Departamentos</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ==================== SEÇÃO 1: SOLICITAÇÕES DE VERBA ==================== */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Solicitações de Verba</CardTitle>
                <CardDescription>
                  Verbas departamentais aguardando aprovação do gestor
                </CardDescription>
              </div>
              {totalPendingBudgets > 0 && (
                <Badge className="ml-auto" variant="default">
                  {totalPendingBudgets} pendente{totalPendingBudgets > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {totalPendingBudgets === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-sm font-medium">Nenhuma verba pendente</h3>
                <p className="text-xs text-muted-foreground">
                  Todas as solicitações de verba foram processadas
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingBudgets?.map((budget) => (
                  <Card
                    key={budget.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary"
                    onClick={() => setSelectedBudget(budget)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">
                              {budget.code}
                            </Badge>
                            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                              <Wallet className="h-3 w-3 mr-1" />
                              Solicitação de Verba
                            </Badge>
                          </div>
                          <p className="font-semibold">{budget.name}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            {budget.department?.nome && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {budget.department.nome}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(budget.period_start), "dd/MM/yyyy", { locale: ptBR })}
                              {" — "}
                              {format(new Date(budget.period_end), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            {budget.creator && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {budget.creator.nome}
                              </span>
                            )}
                          </div>
                          {budget.notes && (
                            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mt-1">
                              {budget.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold text-primary">
                            R$ {budget.total_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                          <Button size="sm" className="mt-2">
                            Revisar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ==================== SEÇÃO 2: DESPESAS LANÇADAS ==================== */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg">Despesas Lançadas</CardTitle>
                <CardDescription>
                  Despesas individuais criadas pelos colaboradores, aguardando aprovação
                </CardDescription>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {metrics.totalPending > 0 && (
                  <Badge variant="destructive">
                    {metrics.totalPending} pendente{metrics.totalPending > 1 ? "s" : ""}
                  </Badge>
                )}
                {expenses.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFocoModeOpen(true)}
                    className="gap-1.5"
                  >
                    <Maximize2 className="h-4 w-4" />
                    Modo Foco
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          {/* Filters */}
          {metrics.totalPending > 0 && (
            <div className="px-6 pb-4">
              <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por código, descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todos Departamentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Departamentos</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Todas Categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Categorias</SelectItem>
                    {DEPARTMENT_EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <CardContent>
            {filteredExpenses.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-sm font-medium">Nenhuma despesa pendente</h3>
                <p className="text-xs text-muted-foreground">
                  Todas as despesas foram revisadas
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredExpenses.map((expense) => {
                  const valor = expense.valor_realizado || expense.valor_previsto || 0;
                  const hasAttachments = expense.attachments && expense.attachments.length > 0;

                  return (
                    <Card
                      key={expense.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-destructive"
                      onClick={() => setSelectedExpense(expense)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="font-mono text-xs">
                                {expense.code}
                              </Badge>
                              <Badge variant="secondary">
                                {getCategoryLabel(expense.category)}
                              </Badge>
                              <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">
                                <Receipt className="h-3 w-3 mr-1" />
                                Despesa
                              </Badge>
                              {hasAttachments && (
                                <Badge variant="outline" className="gap-1">
                                  <Paperclip className="h-3 w-3" />
                                  {expense.attachments.length}
                                </Badge>
                              )}
                            </div>

                            {expense.description && (
                              <p className="font-medium text-sm">{expense.description}</p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                              {expense.department?.nome && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {expense.department.nome}
                                </span>
                              )}
                              {(expense.empresa_nome || expense.empresa?.nome) && (
                                <span className="text-xs">
                                  Filial: {expense.empresa?.nome || expense.empresa_nome}
                                </span>
                              )}
                              {expense.expense_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              )}
                              {expense.creator?.nome && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {expense.creator.nome}
                                </span>
                              )}
                            </div>

                            {/* Valores detalhados */}
                            {expense.valor_previsto > 0 && expense.valor_realizado > 0 && expense.valor_previsto !== expense.valor_realizado && (
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span>Previsto: R$ {expense.valor_previsto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                <span>•</span>
                                <span>Realizado: R$ {expense.valor_realizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold text-primary">
                              R$ {valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </div>
                            <Button size="sm" className="mt-2">
                              Revisar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        {selectedExpense && (
          <AprovarDespesaDepartamentoDialog
            open={!!selectedExpense}
            onOpenChange={(open) => !open && setSelectedExpense(null)}
            expense={selectedExpense}
          />
        )}

        {selectedBudget && (
          <AprovarVerbaDepartamentoDialog
            open={!!selectedBudget}
            onOpenChange={(open) => {
              if (!open) setSelectedBudget(null);
            }}
            budget={selectedBudget}
          />
        )}

        {/* Focus Mode Dialog */}
        <DespesasFocoModeDialog
          open={focoModeOpen}
          onOpenChange={setFocoModeOpen}
          expenses={expenses}
          departments={departments}
        />
      </div>
    </DashboardLayout>
  );
}

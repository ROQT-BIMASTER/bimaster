import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartmentById } from "@/hooks/useUserDepartments";
import { useDepartmentExpenses, usePendingDepartmentExpenses } from "@/hooks/useDepartmentExpenses";
import { useDepartmentBudgets } from "@/hooks/useDepartmentBudgets";
import { DepartmentExpensesTable } from "@/components/departments/DepartmentExpensesTable";
import { DepartmentBudgetsTable } from "@/components/departments/DepartmentBudgetsTable";
import { NovaDespesaDepartamentoDialog } from "@/components/departments/NovaDespesaDepartamentoDialog";
import { SolicitarVerbaDepartamentoDialog } from "@/components/departments/SolicitarVerbaDepartamentoDialog";
import {
  ArrowLeft,
  Plus,
  DollarSign,
  TrendingUp,
  FileText,
  Wallet,
  FileCheck,
  Building2,
  User
} from "lucide-react";

export default function DepartmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: department, isLoading: loadingDept } = useDepartmentById(id!);
  const { expenses, isLoading: loadingExpenses } = useDepartmentExpenses(id);
  const { budgets, isLoading: loadingBudgets } = useDepartmentBudgets(id);
  const { data: pendingExpenses } = usePendingDepartmentExpenses(id);
  
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);

  if (loadingDept) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!department) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Departamento não encontrado</h2>
          <Button variant="link" onClick={() => navigate("/dashboard/departamentos")}>
            Voltar para lista
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Calcular KPIs
  const activeBudgets = budgets.filter(b => b.status === "active" && b.approval_status === "approved");
  const totalBudget = activeBudgets.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const totalSpent = activeBudgets.reduce((sum, b) => sum + (b.spent_amount || 0), 0);
  const available = totalBudget - totalSpent;
  const usagePercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const pendingCount = pendingExpenses?.length || 0;
  const totalPrevisto = expenses.reduce((sum, e) => sum + (e.valor_previsto || 0), 0);
  const totalRealizado = expenses.reduce((sum, e) => sum + (e.valor_realizado || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName={department.nome}
          moduleHref={`/dashboard/departamentos/${id}`}
          currentPage="Visão Geral"
        />

        {/* Header */}
        <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">{department.nome}</h1>
                {department.responsavel && (
                    <p className="text-muted-foreground flex items-center gap-1">
                      <User className="h-4 w-4" />
                      Responsável: {(department.responsavel as any).nome}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate(`/dashboard/departamentos/${id}/dashboard`)}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            {department.isManager && pendingCount > 0 && (
              <Button 
                variant="outline" 
                onClick={() => navigate(`/dashboard/departamentos/${id}/aprovacoes`)}
                className="relative"
              >
                <FileCheck className="mr-2 h-4 w-4" />
                Aprovações
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              </Button>
            )}
            <Button variant="outline" onClick={() => setBudgetDialogOpen(true)}>
              <Wallet className="mr-2 h-4 w-4" />
              Solicitar Verba
            </Button>
            <Button onClick={() => setExpenseDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Despesa
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Verba Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                R$ {totalBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Utilizado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Disponível
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${available < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                R$ {available.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{expenses.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Budget Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Utilização do Orçamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Orçamento: R$ {totalBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              <span>Realizado: R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <Progress 
              value={Math.min(usagePercent, 100)} 
              className={usagePercent > 100 ? "[&>div]:bg-destructive" : ""} 
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{usagePercent.toFixed(1)}% utilizado</span>
              <span>Disponível: R$ {Math.max(0, available).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="expenses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="expenses" className="gap-2">
              <FileText className="h-4 w-4" />
              Despesas ({expenses.length})
            </TabsTrigger>
            <TabsTrigger value="budgets" className="gap-2">
              <Wallet className="h-4 w-4" />
              Verbas ({budgets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            {/* Expense KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Total Previsto</div>
                  <div className="text-xl font-bold">
                    R$ {totalPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Total Realizado</div>
                  <div className="text-xl font-bold">
                    R$ {totalRealizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Pendentes de Aprovação</div>
                  <div className="text-xl font-bold text-amber-600">{pendingCount}</div>
                </CardContent>
              </Card>
            </div>

            <DepartmentExpensesTable 
              expenses={expenses} 
              isLoading={loadingExpenses}
              isManager={department.isManager}
              isFinanceiro={department.isFinanceiro}
              departmentId={id!}
            />
          </TabsContent>

          <TabsContent value="budgets">
            <DepartmentBudgetsTable 
              budgets={budgets} 
              isLoading={loadingBudgets}
              isManager={department.isManager}
              isFinanceiro={department.isFinanceiro}
            />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <NovaDespesaDepartamentoDialog 
          departmentId={id!}
          open={expenseDialogOpen} 
          onOpenChange={setExpenseDialogOpen}
        />
        
        <SolicitarVerbaDepartamentoDialog 
          departmentId={id!}
          open={budgetDialogOpen} 
          onOpenChange={setBudgetDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
}

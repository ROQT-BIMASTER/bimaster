import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useManagerPendingExpenses } from "@/hooks/useManagerPendingExpenses";
import { AprovarDespesaDepartamentoDialog } from "@/components/departments/AprovarDespesaDepartamentoDialog";
import { DepartmentExpense, DEPARTMENT_EXPENSE_CATEGORIES } from "@/hooks/useDepartmentExpenses";
import { 
  Clock, 
  Building2, 
  CheckCircle2, 
  DollarSign, 
  Search,
  FileText,
  ArrowLeft
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DepartmentsApprovalHub() {
  const navigate = useNavigate();
  const { data, isLoading } = useManagerPendingExpenses();
  
  const [selectedExpense, setSelectedExpense] = useState<DepartmentExpense | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const expenses = data?.expenses || [];
  const departments = data?.departments || [];
  const metrics = data?.metrics || { totalPending: 0, totalValue: 0, departmentsCount: 0 };
  const isManager = data?.isManager || false;

  // Apply filters
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

  if (!isManager) {
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
                Revise e aprove despesas de todos os seus departamentos
              </p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.totalPending}</div>
                <div className="text-sm text-muted-foreground">Despesas Pendentes</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  R$ {metrics.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-muted-foreground">Valor Total Pendente</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{metrics.departmentsCount}</div>
                <div className="text-sm text-muted-foreground">Departamentos</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-success/50 bg-success/5">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold">Gerente</div>
                <div className="text-sm text-muted-foreground">Você pode aprovar</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
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

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Despesas Aguardando Aprovação
            </CardTitle>
            <CardDescription>
              {filteredExpenses.length} despesa{filteredExpenses.length !== 1 ? 's' : ''} pendente{filteredExpenses.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-4" />
                <h3 className="text-lg font-medium">Nenhuma despesa pendente</h3>
                <p className="text-muted-foreground mt-1">
                  Todas as despesas foram revisadas
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Filial</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{expense.code}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {expense.department?.nome || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {expense.empresa?.nome || expense.empresa_nome || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getCategoryLabel(expense.category)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {expense.description || "-"}
                      </TableCell>
                      <TableCell>{expense.creator?.nome || "Usuário"}</TableCell>
                      <TableCell>
                        {expense.expense_date && format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        R$ {(expense.valor_realizado || expense.valor_previsto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm"
                          onClick={() => setSelectedExpense(expense)}
                        >
                          Revisar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Approval Dialog */}
        {selectedExpense && (
          <AprovarDespesaDepartamentoDialog
            open={!!selectedExpense}
            onOpenChange={(open) => !open && setSelectedExpense(null)}
            expense={selectedExpense}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

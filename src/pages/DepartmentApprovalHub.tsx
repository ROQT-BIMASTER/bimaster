import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartmentById } from "@/hooks/useUserDepartments";
import { usePendingDepartmentExpenses, DepartmentExpense } from "@/hooks/useDepartmentExpenses";
import { AprovarDespesaDepartamentoDialog } from "@/components/departments/AprovarDespesaDepartamentoDialog";
import { 
  ArrowLeft,
  Clock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Calendar,
  User,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

export default function DepartmentApprovalHub() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: department, isLoading: loadingDept } = useDepartmentById(id || "");
  const { data: pendingExpenses, isLoading: loadingExpenses } = usePendingDepartmentExpenses(id || "");
  
  const [selectedExpense, setSelectedExpense] = useState<DepartmentExpense | null>(null);

  const isLoading = loadingDept || loadingExpenses;

  // Calcular totais
  const totalPending = pendingExpenses?.reduce((sum, e) => sum + (e.valor_realizado || e.valor_previsto || 0), 0) || 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  if (!department) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Departamento não encontrado</h3>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate("/dashboard/departamentos")}
            >
              Voltar
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (!department.isManager) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-warning mb-4" />
            <h3 className="text-lg font-medium">Acesso Restrito</h3>
            <p className="text-muted-foreground mt-2">
              Apenas gerentes do departamento podem acessar a central de aprovações.
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate(`/dashboard/departamentos/${id}`)}
            >
              Voltar
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
          moduleName={department.nome}
          moduleHref={`/dashboard/departamentos/${id}`}
          currentPage="Aprovações"
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(`/dashboard/departamentos/${id}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Central de Aprovações</h1>
              <p className="text-muted-foreground">{department.nome}</p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {pendingExpenses?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  Despesas Pendentes
                </div>
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
                  R$ {totalPending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-muted-foreground">
                  Valor Total Pendente
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-success/50 bg-success/5">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  Gerente
                </div>
                <div className="text-sm text-muted-foreground">
                  Você pode aprovar
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Pendentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              Despesas Aguardando Aprovação
            </CardTitle>
            <CardDescription>
              Revise e aprove ou rejeite as despesas dos funcionários
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!pendingExpenses || pendingExpenses.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-4" />
                <h3 className="text-lg font-medium">Nenhuma despesa pendente</h3>
                <p className="text-muted-foreground mt-1">
                  Todas as despesas foram revisadas
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingExpenses.map((expense) => (
                  <Card 
                    key={expense.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedExpense(expense)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{expense.code}</Badge>
                            <Badge>{expense.category}</Badge>
                          </div>
                          <p className="font-medium">{expense.description}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {expense.creator?.nome || "Usuário"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {expense.expense_date && format(new Date(expense.expense_date), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            {expense.attachments && expense.attachments.length > 0 && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {expense.attachments.length} anexo(s)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            R$ {(expense.valor_realizado || expense.valor_previsto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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

        {/* Dialog de Aprovação */}
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserDepartments, useAllDepartments } from "@/hooks/useUserDepartments";
import { useDepartmentExpenses, usePendingDepartmentExpenses } from "@/hooks/useDepartmentExpenses";
import { useDepartmentBudgets } from "@/hooks/useDepartmentBudgets";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  Building2, 
  Search, 
  DollarSign, 
  Clock,
  TrendingUp,
  FileCheck,
  Plus,
  ChevronRight,
  Users,
  Wallet,
  ClipboardCheck
} from "lucide-react";
import { useManagerPendingExpenses } from "@/hooks/useManagerPendingExpenses";

export default function DepartmentHub() {
  const navigate = useNavigate();
  const { data: userDepartments, isLoading: loadingUserDepts } = useUserDepartments();
  const { data: allDepartments, isLoading: loadingAllDepts } = useAllDepartments();
  const { isAdminOrSupervisor } = useUserRole();
  const { data: managerData } = useManagerPendingExpenses();
  const [searchTerm, setSearchTerm] = useState("");

  // Mostrar todos departamentos para admin/supervisor, ou apenas os do usuário
  const departments = isAdminOrSupervisor ? allDepartments : userDepartments;
  const isLoading = isAdminOrSupervisor ? loadingAllDepts : loadingUserDepts;

  // Show unified approval hub button only for managers
  const showApprovalHub = managerData?.isManager || false;
  const pendingApprovals = managerData?.metrics.totalPending || 0;

  const filteredDepartments = (departments || []).filter(dept =>
    dept.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName="Departamentos"
          moduleHref="/dashboard/departamentos"
          currentPage="Hub de Departamentos"
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestão de Departamentos</h1>
            <p className="text-muted-foreground mt-1">
              Controle de despesas e verbas por departamento
            </p>
          </div>
          
          {showApprovalHub && (
            <Button 
              onClick={() => navigate("/dashboard/departamentos/aprovacoes")}
              className="gap-2"
            >
              <ClipboardCheck className="h-4 w-4" />
              Central de Aprovações
              {pendingApprovals > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingApprovals}
                </Badge>
              )}
            </Button>
          )}
        </div>

        {/* Filtro */}
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar departamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Grid de Departamentos */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : filteredDepartments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum departamento encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? "Tente ajustar sua busca" 
                  : "Você não está vinculado a nenhum departamento"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartments.map((dept) => {
              // Handle responsavel being array or single object
              const responsavel = Array.isArray((dept as any).responsavel) 
                ? (dept as any).responsavel[0] 
                : (dept as any).responsavel;
              
              return (
                <DepartmentCard 
                  key={dept.id} 
                  department={{
                    ...dept,
                    responsavel: responsavel || undefined,
                  }}
                  onClick={() => navigate(`/dashboard/departamentos/${dept.id}`)}
                />
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

interface DepartmentCardProps {
  department: {
    id: string;
    nome: string;
    descricao?: string | null;
    responsavel_id?: string | null;
    isManager?: boolean;
    responsavel?: { id: string; nome: string } | null;
  };
  onClick: () => void;
}

function DepartmentCard({ department, onClick }: DepartmentCardProps) {
  const { budgets } = useDepartmentBudgets(department.id);
  const { data: pendingExpenses } = usePendingDepartmentExpenses(department.id);
  
  // Calcular verbas ativas
  const activeBudgets = budgets.filter(b => b.status === "active" && b.approval_status === "approved");
  const totalBudget = activeBudgets.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const totalSpent = activeBudgets.reduce((sum, b) => sum + (b.spent_amount || 0), 0);
  const available = totalBudget - totalSpent;
  
  const pendingCount = pendingExpenses?.length || 0;

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow group"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{department.nome}</CardTitle>
              {department.responsavel && (
                <CardDescription className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {department.responsavel.nome}
                </CardDescription>
              )}
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {department.isManager && (
          <Badge variant="outline" className="gap-1">
            <FileCheck className="h-3 w-3" />
            Gerente
          </Badge>
        )}
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <div>
              <div className="text-muted-foreground text-xs">Verba Disponível</div>
              <div className="font-semibold">
                R$ {available.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            <div>
              <div className="text-muted-foreground text-xs">Utilizado</div>
              <div className="font-semibold">
                R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {pendingCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-md px-2 py-1">
            <Clock className="h-4 w-4" />
            <span>{pendingCount} despesa{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

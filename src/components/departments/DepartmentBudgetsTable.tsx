import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DepartmentBudget } from "@/hooks/useDepartmentBudgets";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Wallet, 
  Clock,
  CheckCircle,
  XCircle,
  Calendar
} from "lucide-react";

interface DepartmentBudgetsTableProps {
  budgets: DepartmentBudget[];
  isLoading: boolean;
  isManager?: boolean;
  isFinanceiro?: boolean;
}

export function DepartmentBudgetsTable({ 
  budgets, 
  isLoading, 
  isManager,
  isFinanceiro
}: DepartmentBudgetsTableProps) {
  const getStatusBadge = (status: string, approvalStatus: string) => {
    if (approvalStatus === "pending") {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Aguardando Aprovação
        </Badge>
      );
    }
    if (approvalStatus === "rejected") {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Rejeitada
        </Badge>
      );
    }
    
    const config: Record<string, { variant: any; label: string; icon: any }> = {
      active: { variant: "default", label: "Ativa", icon: CheckCircle },
      pending: { variant: "secondary", label: "Pendente", icon: Clock },
      closed: { variant: "outline", label: "Encerrada", icon: XCircle },
    };

    const { variant, label, icon: Icon } = config[status] || config.pending;

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (budgets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhuma verba encontrada</h3>
          <p className="text-muted-foreground">
            Solicite uma verba para começar a controlar o orçamento
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verbas do Departamento</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Utilizado</TableHead>
              <TableHead>Disponível</TableHead>
              <TableHead>Utilização</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgets.map((budget) => {
              const available = budget.total_amount - budget.spent_amount;
              const usagePercent = budget.total_amount > 0 
                ? (budget.spent_amount / budget.total_amount) * 100 
                : 0;

              return (
                <TableRow key={budget.id}>
                  <TableCell className="font-mono text-sm">{budget.code}</TableCell>
                  <TableCell className="font-medium">{budget.name}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(budget.period_start), "dd/MM/yy", { locale: ptBR })}
                      {" - "}
                      {format(new Date(budget.period_end), "dd/MM/yy", { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell>
                    R$ {budget.total_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    R$ {budget.spent_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <span className={available < 0 ? "text-destructive font-medium" : "text-emerald-600"}>
                      R$ {available.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="w-24">
                      <Progress 
                        value={Math.min(usagePercent, 100)} 
                        className={`h-2 ${usagePercent > 100 ? "[&>div]:bg-destructive" : ""}`} 
                      />
                      <span className="text-xs text-muted-foreground">{usagePercent.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(budget.status, budget.approval_status)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

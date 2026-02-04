import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCorporateEvents } from "@/hooks/useCorporateEvents";
import { useEventExpenses } from "@/hooks/useEventExpenses";
import { NovaDespesaEventoDialog } from "@/components/events/NovaDespesaEventoDialog";
import { EventsExpensesTable } from "@/components/events/EventsExpensesTable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Plus,
  Calendar,
  MapPin,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Lock,
  Building,
  TrendingUp,
  FileText,
  Send,
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

export default function CorporateEventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getEventById, updateEvent } = useCorporateEvents();
  const { data: event, isLoading } = getEventById(id!);
  const { expenses, isLoading: loadingExpenses } = useEventExpenses(id);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const { isAdminOrSupervisor } = useUserRole();

  if (isLoading) {
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

  if (!event) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Evento não encontrado</h2>
          <Button variant="link" onClick={() => navigate("/dashboard/eventos")}>
            Voltar para lista
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: any; label: string; icon: any }> = {
      draft: { variant: "outline", label: "Rascunho", icon: Clock },
      pending_approval: { variant: "secondary", label: "Aguardando Aprovação", icon: Clock },
      approved: { variant: "default", label: "Aprovado", icon: CheckCircle },
      in_progress: { variant: "default", label: "Em Andamento", icon: TrendingUp },
      completed: { variant: "secondary", label: "Concluído", icon: CheckCircle },
      cancelled: { variant: "destructive", label: "Cancelado", icon: XCircle },
    };

    const { variant, label, icon: Icon } = config[status] || config.draft;

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const budgetUsagePercent = event.budget_amount > 0 
    ? Math.min((event.actual_cost / event.budget_amount) * 100, 100) 
    : 0;

  const handleSubmitForApproval = async () => {
    await updateEvent.mutateAsync({
      id: event.id,
      status: "pending_approval",
    });
  };

  const handleStartEvent = async () => {
    await updateEvent.mutateAsync({
      id: event.id,
      status: "in_progress",
    });
  };

  const handleCompleteEvent = async () => {
    await updateEvent.mutateAsync({
      id: event.id,
      status: "completed",
    });
  };

  // Métricas das despesas
  const totalPrevisto = expenses.reduce((sum, e) => sum + (e.valor_previsto || 0), 0);
  const totalRealizado = expenses.reduce((sum, e) => sum + (e.valor_realizado || 0), 0);
  const despesasPendentes = expenses.filter(e => e.status === "pending").length;
  const despesasAprovadas = expenses.filter(e => e.status === "approved" || e.status === "paid").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName="Eventos Corporativos"
          moduleHref="/dashboard/eventos"
          currentPage={event.name}
        />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/eventos")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{event.name}</h1>
                {event.confidential && (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" />
                    Confidencial
                  </Badge>
                )}
                {getStatusBadge(event.status)}
              </div>
              <p className="text-muted-foreground mt-1">
                {event.code} • {event.event_type}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {event.status === "draft" && (
              <Button onClick={handleSubmitForApproval} disabled={updateEvent.isPending}>
                <Send className="mr-2 h-4 w-4" />
                Enviar para Aprovação
              </Button>
            )}
            {event.status === "approved" && (
              <Button onClick={handleStartEvent} disabled={updateEvent.isPending}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Iniciar Evento
              </Button>
            )}
            {event.status === "in_progress" && (
              <Button onClick={handleCompleteEvent} disabled={updateEvent.isPending}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Concluir Evento
              </Button>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data do Evento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">
                {event.event_date 
                  ? format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })
                  : "Não definida"}
                {event.end_date && event.end_date !== event.event_date && (
                  <span className="text-muted-foreground">
                    {" - "}{format(new Date(event.end_date), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Local
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{event.location || "Não definido"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Responsável
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{event.responsible?.nome || "Não definido"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building className="h-4 w-4" />
                Verba Vinculada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">
                {event.budget ? `${event.budget.code} - ${event.budget.name}` : "Sem verba"}
              </p>
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
              <span>Orçamento: R$ {(event.budget_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              <span>Realizado: R$ {(event.actual_cost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <Progress 
              value={budgetUsagePercent} 
              className={budgetUsagePercent > 100 ? "[&>div]:bg-destructive" : ""} 
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{budgetUsagePercent.toFixed(1)}% utilizado</span>
              <span>
                Disponível: R$ {Math.max(0, (event.budget_amount || 0) - (event.actual_cost || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="expenses" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="expenses" className="gap-2">
                <FileText className="h-4 w-4" />
                Despesas ({expenses.length})
              </TabsTrigger>
              <TabsTrigger value="details" className="gap-2">
                <Building className="h-4 w-4" />
                Detalhes
              </TabsTrigger>
            </TabsList>

            {(event.status === "approved" || event.status === "in_progress") && (
              <NovaDespesaEventoDialog 
                eventId={event.id} 
                open={expenseDialogOpen} 
                onOpenChange={setExpenseDialogOpen}
              >
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Despesa
                </Button>
              </NovaDespesaEventoDialog>
            )}
          </div>

          <TabsContent value="expenses" className="space-y-4">
            {/* Expense KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <div className="text-sm text-muted-foreground">Despesas Pendentes</div>
                  <div className="text-xl font-bold text-warning">{despesasPendentes}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">Despesas Aprovadas</div>
                  <div className="text-xl font-bold text-success">{despesasAprovadas}</div>
                </CardContent>
              </Card>
            </div>

            <EventsExpensesTable 
              expenses={expenses} 
              isLoading={loadingExpenses}
              eventStatus={event.status}
            />
          </TabsContent>

          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Evento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {event.description && (
                  <div>
                    <h4 className="font-medium mb-1">Descrição</h4>
                    <p className="text-muted-foreground">{event.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-1">Criado por</h4>
                    <p className="text-muted-foreground">{event.creator?.nome || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Data de Criação</h4>
                    <p className="text-muted-foreground">
                      {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {event.approved_by && (
                    <>
                      <div>
                        <h4 className="font-medium mb-1">Aprovado por</h4>
                        <p className="text-muted-foreground">{event.approved_by}</p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-1">Data de Aprovação</h4>
                        <p className="text-muted-foreground">
                          {event.approved_at && format(new Date(event.approved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
